import { createHmac, timingSafeEqual } from "node:crypto";
import { GetObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { ServiceError } from "./errors";

export interface UploadTokenPayload {
  fileId: string;
  organizationId: string;
  uploaderUserId: string;
  storageKey: string;
  originalName: string;
  contentType: string;
  sizeBytes: number;
  sha256: string;
  expiresAt: number;
}

export interface PresignedUploadResult {
  uploadUrl: string;
  headers: Record<string, string>;
}

export interface StorageProvider {
  createPresignedUploadUrl(
    storageKey: string,
    contentType: string,
    sizeBytes: number,
    sha256: string,
  ): Promise<PresignedUploadResult>;
  createPresignedDownloadUrl(
    storageKey: string,
    originalName: string,
    expiresInSeconds: number,
  ): Promise<string>;
  verifyUploadedObject(
    storageKey: string,
    expectedSizeBytes: number,
    expectedSha256: string,
  ): Promise<void>;
}

// In-memory mock storage for development/tests when R2 credentials are unset.
class MemoryStorageProvider implements StorageProvider {
  private static store = new Map<string, { sizeBytes: number; sha256: string; contentType: string }>();

  static put(key: string, data: { sizeBytes: number; sha256: string; contentType: string }) {
    this.store.set(key, data);
  }

  static clear() {
    this.store.clear();
  }

  async createPresignedUploadUrl(
    storageKey: string,
    contentType: string,
    sizeBytes: number,
    sha256: string,
  ): Promise<PresignedUploadResult> {
    // In mock mode, pre-seed or register the key for local test verification
    MemoryStorageProvider.put(storageKey, { sizeBytes, sha256, contentType });
    const apiUrl = process.env.API_URL ?? "http://localhost:4000";
    return {
      uploadUrl: `${apiUrl}/v1/files/mock-storage/${encodeURIComponent(storageKey)}`,
      headers: { "Content-Type": contentType },
    };
  }

  async createPresignedDownloadUrl(
    storageKey: string,
    originalName: string,
    expiresInSeconds: number,
  ): Promise<string> {
    const apiUrl = process.env.API_URL ?? "http://localhost:4000";
    return `${apiUrl}/v1/files/mock-storage/${encodeURIComponent(storageKey)}?download=${encodeURIComponent(originalName)}&expires=${expiresInSeconds}`;
  }

  async verifyUploadedObject(
    storageKey: string,
    expectedSizeBytes: number,
    expectedSha256: string,
  ): Promise<void> {
    const item = MemoryStorageProvider.store.get(storageKey);
    if (!item) {
      throw new ServiceError("invalid", "The uploaded file was not found in storage.");
    }
    if (item.sizeBytes !== expectedSizeBytes) {
      throw new ServiceError(
        "invalid",
        `File size mismatch: received ${item.sizeBytes} bytes, expected ${expectedSizeBytes} bytes.`,
      );
    }
    if (item.sha256.toLowerCase() !== expectedSha256.toLowerCase()) {
      throw new ServiceError(
        "invalid",
        `Checksum mismatch: received ${item.sha256}, expected ${expectedSha256}.`,
      );
    }
  }
}

// Real Cloudflare R2 S3 provider.
class R2StorageProvider implements StorageProvider {
  private s3: S3Client;
  private bucket: string;

  constructor(bucket: string, accountId?: string, accessKeyId?: string, secretAccessKey?: string, endpoint?: string) {
    this.bucket = bucket;
    const resolvedEndpoint = endpoint ?? (accountId ? `https://${accountId}.r2.cloudflarestorage.com` : undefined);
    this.s3 = new S3Client({
      region: "auto",
      endpoint: resolvedEndpoint,
      credentials: {
        accessKeyId: accessKeyId ?? "",
        secretAccessKey: secretAccessKey ?? "",
      },
    });
  }

  async createPresignedUploadUrl(
    storageKey: string,
    contentType: string,
    sizeBytes: number,
    sha256: string,
  ): Promise<PresignedUploadResult> {
    const base64Sha = Buffer.from(sha256, "hex").toString("base64");
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: storageKey,
      ContentType: contentType,
      ContentLength: sizeBytes,
      ChecksumSHA256: base64Sha,
    });
    const uploadUrl = await getSignedUrl(this.s3, command, { expiresIn: 3600 });
    return {
      uploadUrl,
      headers: {
        "Content-Type": contentType,
        "x-amz-checksum-sha256": base64Sha,
      },
    };
  }

  async createPresignedDownloadUrl(
    storageKey: string,
    originalName: string,
    expiresInSeconds: number,
  ): Promise<string> {
    const sanitizedName = originalName.replace(/["\r\n\\]/g, "_");
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: storageKey,
      ResponseContentDisposition: `inline; filename="${sanitizedName}"; filename*=UTF-8''${encodeURIComponent(originalName)}`,
    });
    return getSignedUrl(this.s3, command, { expiresIn: expiresInSeconds });
  }

  async verifyUploadedObject(
    storageKey: string,
    expectedSizeBytes: number,
    expectedSha256: string,
  ): Promise<void> {
    try {
      const command = new HeadObjectCommand({
        Bucket: this.bucket,
        Key: storageKey,
        ChecksumMode: "ENABLED",
      });
      const response = await this.s3.send(command);
      if (response.ContentLength !== expectedSizeBytes) {
        throw new ServiceError(
          "invalid",
          `File size mismatch: storage reported ${response.ContentLength} bytes, expected ${expectedSizeBytes} bytes.`,
        );
      }
      if (response.ChecksumSHA256) {
        const expectedBase64 = Buffer.from(expectedSha256, "hex").toString("base64");
        if (response.ChecksumSHA256 !== expectedBase64) {
          throw new ServiceError(
            "invalid",
            `Checksum mismatch: storage reported ${response.ChecksumSHA256}, expected ${expectedBase64}.`,
          );
        }
      }
    } catch (err: any) {
      if (err instanceof ServiceError) throw err;
      if (err?.$metadata?.httpStatusCode === 404 || err?.name === "NotFound") {
        throw new ServiceError("invalid", "The uploaded file was not found in the storage bucket.");
      }
      throw new Error(`Could not verify file in storage: ${err.message}`);
    }
  }
}

function getSecretKey(): string {
  const secret = process.env.BETTER_AUTH_SECRET;
  if (!secret && process.env.NODE_ENV === "production") {
    throw new Error("BETTER_AUTH_SECRET is required to sign upload tokens in production.");
  }
  return secret || "entrust-internal-file-upload-secret";
}

/** Signs an upload token with HMAC SHA-256 so client cannot tamper with parameters during finalise. */
export function signUploadToken(payload: UploadTokenPayload): string {
  const data = JSON.stringify(payload);
  const hmac = createHmac("sha256", getSecretKey()).update(data).digest("hex");
  const encoded = Buffer.from(data, "utf8").toString("base64url");
  return `${encoded}.${hmac}`;
}

/** Verifies and parses an upload token. Throws ServiceError on tampering or expiration. */
export function verifyUploadToken(token: string): UploadTokenPayload {
  const parts = token.split(".");
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    throw new ServiceError("invalid", "Malformed upload token.");
  }
  const [encoded, signature] = parts;
  const jsonStr = Buffer.from(encoded, "base64url").toString("utf8");
  const expectedHmac = createHmac("sha256", getSecretKey()).update(jsonStr).digest("hex");

  const sigBuf = Buffer.from(signature, "hex");
  const expBuf = Buffer.from(expectedHmac, "hex");

  if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) {
    throw new ServiceError("invalid", "Invalid upload token signature.");
  }

  try {
    const payload = JSON.parse(jsonStr) as UploadTokenPayload;
    if (Date.now() > payload.expiresAt) {
      throw new ServiceError("invalid", "Upload token has expired. Please initiate a new upload.");
    }
    return payload;
  } catch (err: any) {
    if (err instanceof ServiceError) throw err;
    throw new ServiceError("invalid", "Invalid upload token contents.");
  }
}

/** Resolves the configured storage provider. */
export function getStorageProvider(): StorageProvider {
  const bucket = process.env.R2_BUCKET_NAME ?? "entrust-files-dev";
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const endpoint = process.env.R2_ENDPOINT;

  if (accessKeyId && secretAccessKey && (accountId || endpoint)) {
    return new R2StorageProvider(bucket, accountId, accessKeyId, secretAccessKey, endpoint);
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error("Cloudflare R2 storage credentials are not configured in production.");
  }

  return new MemoryStorageProvider();
}

export { MemoryStorageProvider };
