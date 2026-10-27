import { createHash, randomUUID } from "node:crypto";
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
  formatContentDisposition,
  getStorageProvider,
  MemoryStorageProvider,
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
  404: problem("File or organisation not found or access denied"),
};

const finaliseErrors = {
  ...fileErrors,
  409: problem("File has already been finalised"),
  422: problem("Upload token invalid, expired, or size/checksum mismatch"),
};

function requireUser(c: { get: (key: "user") => AppEnv["Variables"]["user"] }) {
  const user = c.get("user");
  if (!user) throw new ServiceError("unauthenticated", "Not signed in.");
  return user;
}

const router = new OpenAPIHono<AppEnv>({
  defaultHook: (result, c) => {
    if (result.success) return;
    const error = result.error.issues
      .map((i) => `${i.path.join(".") || "request"}: ${i.message}`)
      .join("; ");
    return c.json({ error, code: "invalid" as const }, 400);
  },
});

// Require signed-in session for file endpoints (scoped so it does not leak into other /v1/* routes)
router.use("/files/*", async (c, next) => {
  // Allow unauthenticated local mock storage PUT/GET
  if (c.req.path.startsWith("/v1/files/mock-storage/") || c.req.path.startsWith("/files/mock-storage/")) {
    return next();
  }
  requireUser(c);
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
    ...finaliseErrors,
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
  summary: "Get presigned download URL",
  description:
    "Generates a short-lived presigned Cloudflare R2 GET URL for downloading the file. Requires organisation membership or Entrust staff role.",
  request: {
    params: FileIdParam,
  },
  responses: {
    200: {
      description: "Presigned download URL with metadata",
      content: { "application/json": { schema: DownloadUrlResponse } },
    },
    ...fileErrors,
  },
});

export const files = router
  .openapi(uploadUrlRoute, async (c) => {
    const user = requireUser(c);
    const body = c.req.valid("json");
    const db = getDb();

    // Verify organization exists (prevents mistyped orgId orphaned storage uploads)
    const [org] = await db
      .select({ id: schema.organization.id })
      .from(schema.organization)
      .where(eq(schema.organization.id, body.organizationId));
    if (!org) {
      throw new ServiceError("not_found", "Organisation not found.");
    }

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
    const user = requireUser(c);
    const { uploadToken } = c.req.valid("json");
    const db = getDb();

    // Validate token integrity and expiry
    const payload = verifyUploadToken(uploadToken);

    // Enforce that only the user who initiated the upload can finalise it
    if (payload.uploaderUserId !== user.id) {
      throw new ServiceError("forbidden", "Only the user who initiated the upload can finalise it.");
    }

    // Verify caller still has access to the organisation
    const principal = await loadPrincipal(db, user.id);
    const actor = actorFor(principal, payload.organizationId);
    if (!actor) {
      throw new ServiceError("forbidden", "You do not have permission to finalise files for this organisation.");
    }

    // Verify storage object existence, Content-Type, size and sha256 checksum
    const storage = getStorageProvider();
    await storage.verifyUploadedObject(
      payload.storageKey,
      payload.sizeBytes,
      payload.sha256,
      payload.contentType,
    );

    // Atomic insert and audit log in a single transaction
    const inserted = await db.transaction(async (tx) => {
      const [row] = await tx
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
        .onConflictDoNothing()
        .returning();

      if (!row) {
        throw new ServiceError("invalid_transition", "This file has already been finalised.");
      }

      await tx.insert(schema.auditLog).values({
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

      return row;
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
    const user = requireUser(c);
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
    const user = requireUser(c);
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
    const downloadUrl = await storage.createPresignedDownloadUrl(
      row.storageKey,
      row.originalName,
      expiresInSeconds,
      row.contentType,
    );

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

// Mock storage PUT & GET endpoints for local development and testing
router.put("/files/mock-storage/:key{.+}", async (c) => {
  const key = decodeURIComponent(c.req.param("key"));
  const contentType = c.req.header("content-type") ?? "application/octet-stream";
  const bodyBuffer = Buffer.from(await c.req.arrayBuffer());
  const sha256 = createHash("sha256").update(bodyBuffer).digest("hex");
  MemoryStorageProvider.put(key, {
    data: bodyBuffer,
    sizeBytes: bodyBuffer.length,
    sha256,
    contentType,
  });
  return c.text("OK", 200);
});

router.get("/files/mock-storage/:key{.+}", async (c) => {
  const key = decodeURIComponent(c.req.param("key"));
  const item = MemoryStorageProvider.get(key);
  if (!item) return c.text("Not Found", 404);
  const downloadName = c.req.query("download");
  const disposition = downloadName
    ? formatContentDisposition(downloadName, "attachment")
    : "inline";
  return new Response(new Uint8Array(item.data), {
    headers: {
      "Content-Type": item.contentType,
      "Content-Length": String(item.sizeBytes),
      "Content-Disposition": disposition,
    },
  });
});
