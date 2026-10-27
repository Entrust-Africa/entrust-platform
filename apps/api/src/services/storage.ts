import { createHash, createHmac, timingSafeEqual } from "node:crypto";
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
    contentType?: string,
  ): Promise<string>;
  verifyUploadedObject(
    storageKey: string,
    expectedSizeBytes: number,
    expectedSha256: string,
    expectedContentType: string,
  ): Promise<void>;
}

/** Formats Content-Disposition header conforming to RFC 5987 / RFC 6266 with ASCII fallback. */
export function formatContentDisposition(
  originalName: string,
  disposition: "attachment" | "inline" = "attachment",
): string {
  const asciiFallback =
    originalName
      .replace(/[^\x20-\x7E]/g, "_")
      .replace(/["\r\n\\]/g, "_")
      .trim() || "file";
  const encodedName = encodeURIComponent(originalName).replace(
    /['()*]/g,
    (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`,
  );
  return `${disposition}; filename="${asciiFallback}"; filename*=UTF-8''${encodedName}`;
}

export interface StoredMockFile {
  data: Buffer;
  sizeBytes: number;
  sha256: string;
  contentType: string;
}

// In-memory mock storage for development/tests when FILE_STORAGE=memory.
class MemoryStorageProvider implements StorageProvider {
  private static store = new Map<string, StoredMockFile>();

  static put(key: string, data: { data?: Buffer; sizeBytes: number; sha256: string; contentType: string }) {
    this.store.set(key, {
      data: data.data ?? Buffer.alloc(data.sizeBytes),
      sizeBytes: data.sizeBytes,
      sha256: data.sha256.toLowerCase(),
      contentType: data.contentType,
    });
  }

  static get(key: string): StoredMockFile | undefined {
    return this.store.get(key);
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
    // In mock mode, do not pre-seed the object. The client or test must actually PUT to uploadUrl.
    const apiUrl = process.env.API_URL ?? "http://localhost:4000";
    return {
      uploadUrl: `${apiUrl}/v1/files/mock-storage/${encodeURIComponent(storageKey)}`,
      headers: {
        "Content-Type": contentType,
        "x-amz-checksum-sha256": Buffer.from(sha256, "hex").toString("base64"),
      },
    };
  }

  async createPresignedDownloadUrl(
    storageKey: string,
    originalName: string,
    expiresInSeconds: number,
    contentType?: string,
  ): Promise<string> {
    const apiUrl = process.env.API_URL ?? "http://localhost:4000";
    const ct = contentType ? `&contentType=${encodeURIComponent(contentType)}` : "";
    return `${apiUrl}/v1/files/mock-storage/${encodeURIComponent(storageKey)}?download=${encodeURIComponent(originalName)}&expires=${expiresInSeconds}${ct}`;
  }

  async verifyUploadedObject(
    storageKey: string,
    expectedSizeBytes: number,
    expectedSha256: string,
    expectedContentType: string,
  ): Promise<void> {
    const item = MemoryStorageProvider.store.get(storageKey);
    if (!item) {
      throw new ServiceError("invalid", "The uploaded file was not found in storage.");
    }
    if (item.sizeBytes !== expectedSizeBytes) {
      throw new ServiceError(
        "invalid",
        `File size mismatch: storage reported ${item.sizeBytes} bytes, expected ${expectedSizeBytes} bytes.`,
      );
    }
    if (item.contentType !== expectedContentType) {
      throw new ServiceError(
        "invalid",
        `Content-Type mismatch: storage reported ${item.contentType}, expected ${expectedContentType}.`,
      );
    }
    if (item.sha256.toLowerCase() !== expectedSha256.toLowerCase()) {
      throw new ServiceError(
        "invalid",
        `Checksum mismatch: storage reported ${item.sha256}, expected ${expectedSha256}.`,
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
    // Explicitly add content-type and x-amz-checksum-sha256 to signableHeaders
    const uploadUrl = await getSignedUrl(this.s3, command, {
      expiresIn: 3600,
      signableHeaders: new Set(["content-type", "x-amz-checksum-sha256"]),
    });
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
    contentType?: string,
  ): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: storageKey,
      ResponseContentType: contentType,
      ResponseContentDisposition: formatContentDisposition(originalName, "attachment"),
    });
    return getSignedUrl(this.s3, command, { expiresIn: expiresInSeconds });
  }

  async verifyUploadedObject(
    storageKey: string,
    expectedSizeBytes: number,
    expectedSha256: string,
    expectedContentType: string,
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
      if (response.ContentType && response.ContentType !== expectedContentType) {
        throw new ServiceError(
          "invalid",
          `Content-Type mismatch: storage reported ${response.ContentType}, expected ${expectedContentType}.`,
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
      } else {
        // Fallback: HeadObject did not return ChecksumSHA256. Stream object to calculate SHA-256 hash.
        const getCommand = new GetObjectCommand({
          Bucket: this.bucket,
          Key: storageKey,
        });
        const getRes = await this.s3.send(getCommand);
        if (!getRes.Body) {
          throw new ServiceError("invalid", "Failed to retrieve uploaded file content for checksum verification.");
        }
        const stream = getRes.Body as NodeJS.ReadableStream;
        const hash = createHash("sha256");
        for await (const chunk of stream) {
          hash.update(chunk);
        }
        const computedSha = hash.digest("hex");
        if (computedSha.toLowerCase() !== expectedSha256.toLowerCase()) {
          throw new ServiceError(
            "invalid",
            `Checksum mismatch: storage content hash ${computedSha}, expected ${expectedSha256}.`,
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
  if (!secret) {
    throw new Error("BETTER_AUTH_SECRET is required to sign upload tokens.");
  }
  return secret;
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
  if (process.env.FILE_STORAGE === "memory") {
    return new MemoryStorageProvider();
  }

  const bucket = process.env.R2_BUCKET_NAME;
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const endpoint = process.env.R2_ENDPOINT;

  if (!bucket) {
    throw new Error(
      "R2_BUCKET_NAME is required for Cloudflare R2 file storage (or set FILE_STORAGE=memory for local development).",
    );
  }

  if (accessKeyId && secretAccessKey && (accountId || endpoint)) {
    return new R2StorageProvider(bucket, accountId, accessKeyId, secretAccessKey, endpoint);
  }

  throw new Error(
    "Cloudflare R2 storage credentials (R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_ACCOUNT_ID) are missing (or set FILE_STORAGE=memory for local development).",
  );
}

export { MemoryStorageProvider, R2StorageProvider };
