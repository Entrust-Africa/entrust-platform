import { z } from "@hono/zod-openapi";
import { ALLOWED_FILE_TYPES, MAX_FILE_SIZE_BYTES } from "@entrust/db";

export const RequestUploadUrlBody = z
  .object({
    organizationId: z.string().trim().min(1, "Organization ID is required").openapi({
      description: "Organisation owning the file",
      example: "org_123456",
    }),
    originalName: z.string().trim().min(1).max(255).openapi({
      description: "Original filename with extension",
      example: "commercial_invoice.pdf",
    }),
    contentType: z.enum(ALLOWED_FILE_TYPES).openapi({
      description: "MIME type (PDF, JPEG, or PNG)",
      example: "application/pdf",
    }),
    sizeBytes: z
      .number()
      .int()
      .min(1, "File must not be empty")
      .max(MAX_FILE_SIZE_BYTES, `File size cannot exceed ${MAX_FILE_SIZE_BYTES} bytes (20 MB)`)
      .openapi({
        description: "Exact byte size of the file",
        example: 1048576,
      }),
    sha256: z
      .string()
      .regex(/^[a-fA-F0-9]{64}$/, "Must be a 64-character hex SHA-256 hash")
      .openapi({
        description: "SHA-256 hash in lowercase hex",
        example: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
      }),
  })
  .openapi("RequestUploadUrlBody");

export const UploadUrlResponse = z
  .object({
    fileId: z.string().uuid().openapi({ example: "550e8400-e29b-41d4-a716-446655440000" }),
    storageKey: z.string().openapi({ example: "orgs/org_123/550e8400-e29b-41d4-a716-446655440000/invoice.pdf" }),
    uploadUrl: z.string().url().openapi({ example: "https://entrust-files-dev.r2.cloudflarestorage.com/..." }),
    uploadToken: z.string().openapi({ description: "Signed token to pass into /v1/files/finalise" }),
    headers: z.record(z.string(), z.string()).openapi({ description: "Headers required during binary PUT upload" }),
  })
  .openapi("UploadUrlResponse");

export const FinaliseUploadBody = z
  .object({
    uploadToken: z.string().min(10, "Upload token is required").openapi({
      description: "The signed token received from /v1/files/upload-url",
    }),
  })
  .openapi("FinaliseUploadBody");

export const FileRecord = z
  .object({
    id: z.string().uuid().openapi({ example: "550e8400-e29b-41d4-a716-446655440000" }),
    organizationId: z.string().openapi({ example: "org_123" }),
    uploaderUserId: z.string().nullable().openapi({ example: "user_456" }),
    storageKey: z.string().openapi({ example: "orgs/org_123/550e8400-e29b-41d4-a716-446655440000/invoice.pdf" }),
    originalName: z.string().openapi({ example: "invoice.pdf" }),
    contentType: z.string().openapi({ example: "application/pdf" }),
    sizeBytes: z.number().int().openapi({ example: 1048576 }),
    sha256: z.string().openapi({ example: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855" }),
    createdAt: z.string().datetime().openapi({ example: "2026-10-25T12:00:00Z" }),
  })
  .openapi("FileRecord");

export const FileResponse = z
  .object({
    file: FileRecord,
  })
  .openapi("FileResponse");

export const DownloadUrlResponse = z
  .object({
    downloadUrl: z.string().url().openapi({ example: "https://entrust-files-dev.r2.cloudflarestorage.com/..." }),
    expiresInSeconds: z.number().int().openapi({ example: 900 }),
    fileName: z.string().openapi({ example: "invoice.pdf" }),
    contentType: z.string().openapi({ example: "application/pdf" }),
    sizeBytes: z.number().int().openapi({ example: 1048576 }),
  })
  .openapi("DownloadUrlResponse");

export const FileIdParam = z.object({
  fileId: z.string().uuid().openapi({
    param: { name: "fileId", in: "path" },
    description: "UUID of the file",
    example: "550e8400-e29b-41d4-a716-446655440000",
  }),
});
