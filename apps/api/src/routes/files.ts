import { randomUUID } from "node:crypto";
import { createRoute, OpenAPIHono } from "@hono/zod-openapi";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@entrust/db";
import type { AppEnv } from "../app";
import {
  DownloadUrlResponse,
  FileIdParam,
  FileResponse,
  FinaliseUploadBody,
  RequestUploadUrlBody,
  UploadUrlResponse,
} from "../schemas/files";
import { Problem } from "../schemas/problem";
import { actorFor, loadPrincipal } from "../services/access";
import { ServiceError } from "../services/errors";
import {
  getStorageProvider,
  signUploadToken,
  verifyUploadToken,
} from "../services/storage";

const tags = ["Files"];

const problem = (description: string) => ({
  description,
  content: { "application/json": { schema: Problem } },
});

const fileErrors = {
  400: problem("Invalid input parameters"),
  401: problem("Not signed in"),
  403: problem("Insufficient permissions for this organisation"),
  404: problem("File not found or access denied"),
};

const router = new OpenAPIHono<AppEnv>({
  defaultHook: (result, c) => {
    if (result.success) return;
    const error = result.error.issues
      .map((i) => `${i.path.join(".") || "request"}: ${i.message}`)
      .join("; ");
    return c.json({ error, code: "invalid" as const }, 400);
  },
});

// Require signed-in session for all file endpoints
router.use("*", async (c, next) => {
  if (!c.get("user")) {
    throw new ServiceError("unauthenticated", "Not signed in.");
  }
  await next();
});

const uploadUrlRoute = createRoute({
  method: "post",
  path: "/files/upload-url",
  tags,
  summary: "Request presigned file upload URL",
  description:
    "Generates a presigned Cloudflare R2 upload URL and a signed upload token for two-phase file upload. Requires organisation membership.",
  request: {
    body: {
      required: true,
      content: { "application/json": { schema: RequestUploadUrlBody } },
    },
  },
  responses: {
    200: {
      description: "Presigned upload URL and authorization token",
      content: { "application/json": { schema: UploadUrlResponse } },
    },
    ...fileErrors,
  },
});

const finaliseRoute = createRoute({
  method: "post",
  path: "/files/finalise",
  tags,
  summary: "Finalise file upload",
  description:
    "Verifies that the file exists in Cloudflare R2 with matching size and checksum, then registers it in core.file.",
  request: {
    body: {
      required: true,
      content: { "application/json": { schema: FinaliseUploadBody } },
    },
  },
  responses: {
    201: {
      description: "File successfully finalised and registered",
      content: { "application/json": { schema: FileResponse } },
    },
    ...fileErrors,
  },
});

const getFileRoute = createRoute({
  method: "get",
  path: "/files/{fileId}",
  tags,
  summary: "Get file metadata",
  description: "Retrieves metadata for a registered file. Requires organisation membership or Entrust staff role.",
  request: {
    params: FileIdParam,
  },
  responses: {
    200: {
      description: "File metadata",
      content: { "application/json": { schema: FileResponse } },
    },
    ...fileErrors,
  },
});

const downloadUrlRoute = createRoute({
  method: "get",
  path: "/files/{fileId}/download-url",
  tags,
  summary: "Get private download URL",
  description:
    "Generates a short-lived (15-minute) presigned GET URL for securely downloading the file from the private R2 bucket.",
  request: {
    params: FileIdParam,
  },
  responses: {
    200: {
      description: "Presigned download URL",
      content: { "application/json": { schema: DownloadUrlResponse } },
    },
    ...fileErrors,
  },
});

export const files = router
  .openapi(uploadUrlRoute, async (c) => {
    const user = c.get("user")!;
    const body = c.req.valid("json");
    const db = getDb();

    // Check that caller belongs to the organisation or is Entrust staff
    const principal = await loadPrincipal(db, user.id);
    const actor = actorFor(principal, body.organizationId);
    if (!actor) {
      throw new ServiceError("forbidden", "You do not have permission to upload files for this organisation.");
    }

    const fileId = randomUUID();
    const basename = body.originalName.split(/[/\\]/).pop() ?? "file";
    const cleanName = basename.replace(/[^a-zA-Z0-9._-]/g, "_").replace(/^\.+/, "") || "file";
    const storageKey = `orgs/${body.organizationId}/${fileId}/${cleanName}`;

    const storage = getStorageProvider();
    const { uploadUrl, headers } = await storage.createPresignedUploadUrl(
      storageKey,
      body.contentType,
      body.sizeBytes,
      body.sha256,
    );

    const uploadToken = signUploadToken({
      fileId,
      organizationId: body.organizationId,
      uploaderUserId: user.id,
      storageKey,
      originalName: body.originalName,
      contentType: body.contentType,
      sizeBytes: body.sizeBytes,
      sha256: body.sha256.toLowerCase(),
      expiresAt: Date.now() + 2 * 3600 * 1000, // 2 hours
    });

    return c.json(
      {
        fileId,
        storageKey,
        uploadUrl,
        uploadToken,
        headers,
      },
      200,
    );
  })
  .openapi(finaliseRoute, async (c) => {
    const user = c.get("user")!;
    const body = c.req.valid("json");
    const payload = verifyUploadToken(body.uploadToken);
    const db = getDb();

    // Verify caller still has access to the organisation
    const principal = await loadPrincipal(db, user.id);
    const actor = actorFor(principal, payload.organizationId);
    if (!actor) {
      throw new ServiceError("forbidden", "You do not have permission to finalise files for this organisation.");
    }

    // Verify S3/R2 storage object existence and byte integrity
    const storage = getStorageProvider();
    await storage.verifyUploadedObject(payload.storageKey, payload.sizeBytes, payload.sha256);

    // Ensure file is not already finalised
    const [existing] = await db.select().from(schema.file).where(eq(schema.file.id, payload.fileId));
    if (existing) {
      throw new ServiceError("invalid_transition", "This file has already been finalised.");
    }

    // Insert into core.file
    const [inserted] = await db
      .insert(schema.file)
      .values({
        id: payload.fileId,
        organizationId: payload.organizationId,
        uploaderUserId: payload.uploaderUserId,
        storageKey: payload.storageKey,
        originalName: payload.originalName,
        contentType: payload.contentType as any,
        sizeBytes: payload.sizeBytes,
        sha256: payload.sha256.toLowerCase(),
        createdAt: new Date(),
      })
      .returning();

    if (!inserted) {
      throw new ServiceError("invalid", "Failed to insert file record.");
    }

    // Write audit trail
    await db.insert(schema.auditLog).values({
      actorUserId: user.id,
      organizationId: payload.organizationId,
      action: "file.uploaded",
      entityType: "file",
      entityId: payload.fileId,
      after: {
        originalName: payload.originalName,
        contentType: payload.contentType,
        sizeBytes: payload.sizeBytes,
        sha256: payload.sha256,
      },
    });

    return c.json(
      {
        file: {
          id: inserted.id,
          organizationId: inserted.organizationId,
          uploaderUserId: inserted.uploaderUserId,
          storageKey: inserted.storageKey,
          originalName: inserted.originalName,
          contentType: inserted.contentType,
          sizeBytes: inserted.sizeBytes,
          sha256: inserted.sha256,
          createdAt: inserted.createdAt.toISOString(),
        },
      },
      201,
    );
  })
  .openapi(getFileRoute, async (c) => {
    const user = c.get("user")!;
    const { fileId } = c.req.valid("param");
    const db = getDb();

    const [row] = await db.select().from(schema.file).where(eq(schema.file.id, fileId));
    if (!row) {
      throw new ServiceError("not_found", "File not found.");
    }

    const principal = await loadPrincipal(db, user.id);
    const actor = actorFor(principal, row.organizationId);
    if (!actor) {
      throw new ServiceError("not_found", "File not found.");
    }

    return c.json(
      {
        file: {
          id: row.id,
          organizationId: row.organizationId,
          uploaderUserId: row.uploaderUserId,
          storageKey: row.storageKey,
          originalName: row.originalName,
          contentType: row.contentType,
          sizeBytes: row.sizeBytes,
          sha256: row.sha256,
          createdAt: row.createdAt.toISOString(),
        },
      },
      200,
    );
  })
  .openapi(downloadUrlRoute, async (c) => {
    const user = c.get("user")!;
    const { fileId } = c.req.valid("param");
    const db = getDb();

    const [row] = await db.select().from(schema.file).where(eq(schema.file.id, fileId));
    if (!row) {
      throw new ServiceError("not_found", "File not found.");
    }

    const principal = await loadPrincipal(db, user.id);
    const actor = actorFor(principal, row.organizationId);
    if (!actor) {
      throw new ServiceError("not_found", "File not found.");
    }

    const expiresInSeconds = 900; // 15 minutes
    const storage = getStorageProvider();
    const downloadUrl = await storage.createPresignedDownloadUrl(row.storageKey, row.originalName, expiresInSeconds);

    return c.json(
      {
        downloadUrl,
        expiresInSeconds,
        fileName: row.originalName,
        contentType: row.contentType,
        sizeBytes: row.sizeBytes,
      },
      200,
    );
  });
