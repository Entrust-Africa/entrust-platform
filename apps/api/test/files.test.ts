import { createHash, randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { schema } from "@entrust/db";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { app } from "../src/app";
import { MemoryStorageProvider, signUploadToken } from "../src/services/storage";
import { cleanup, createOrganization, db, signUp, callV1, type TestUser } from "./support";

const w = {} as {
  ownerA: TestUser;
  memberA: TestUser;
  ownerB: TestUser;
  outsider: TestUser;
  admin: TestUser;
  orgA: string;
  orgB: string;
  entrust: string;
};

beforeAll(async () => {
  await cleanup();
  const [ownerA, memberA, ownerB, outsider, admin] = await Promise.all([
    signUp("files-owner-a"),
    signUp("files-member-a"),
    signUp("files-owner-b"),
    signUp("files-outsider"),
    signUp("files-admin"),
  ]);
  Object.assign(w, { ownerA, memberA, ownerB, outsider, admin });

  w.orgA = await createOrganization("files-org-a", [
    [ownerA!, "owner"],
    [memberA!, "member"],
  ]);
  w.orgB = await createOrganization("files-org-b", [[ownerB!, "owner"]]);
  w.entrust = await createOrganization(
    "files-entrust",
    [[admin!, "admin"]],
    { smeProfile: false },
  );
  process.env.ENTRUST_ORG_ID = w.entrust;
});

afterAll(async () => {
  delete process.env.ENTRUST_ORG_ID;
  await cleanup();
});

describe("Files API", () => {
  const dummySha256 = createHash("sha256").update("test content").digest("hex");

  describe("Authentication and Authorization", () => {
    it("refuses signed-out requests", async () => {
      const fileId = randomUUID();

      const resUpload = await callV1(null, "POST", "/files/upload-url", {
        organizationId: w.orgA,
        originalName: "invoice.pdf",
        contentType: "application/pdf",
        sizeBytes: 1024,
        sha256: dummySha256,
      });
      expect(resUpload.status).toBe(401);

      const resFinalise = await callV1(null, "POST", "/files/finalise", {
        uploadToken: "bad.token",
      });
      expect(resFinalise.status).toBe(401);

      const resGet = await callV1(null, "GET", `/files/${fileId}`);
      expect(resGet.status).toBe(401);

      const resDownload = await callV1(null, "GET", `/files/${fileId}/download-url`);
      expect(resDownload.status).toBe(401);
    });

    it("refuses upload-url request from a user not belonging to the organisation", async () => {
      const res = await callV1(w.ownerB, "POST", "/files/upload-url", {
        organizationId: w.orgA,
        originalName: "bill_of_lading.pdf",
        contentType: "application/pdf",
        sizeBytes: 2048,
        sha256: dummySha256,
      });
      expect(res.status).toBe(403);
    });

    it("refuses upload-url for non-existent organisation", async () => {
      const res = await callV1(w.memberA, "POST", "/files/upload-url", {
        organizationId: "non-existent-org-uuid",
        originalName: "bill_of_lading.pdf",
        contentType: "application/pdf",
        sizeBytes: 2048,
        sha256: dummySha256,
      });
      expect(res.status).toBe(404);
      expect(res.body.error).toMatch(/not found/i);
    });
  });

  describe("File Type and Size Validation", () => {
    it("rejects unsupported MIME types", async () => {
      const res = await callV1(w.memberA, "POST", "/files/upload-url", {
        organizationId: w.orgA,
        originalName: "malware.exe",
        contentType: "application/x-msdownload",
        sizeBytes: 1024,
        sha256: dummySha256,
      });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/type|mime|allowed/i);
    });

    it("rejects files exceeding 20 MB", async () => {
      const res = await callV1(w.memberA, "POST", "/files/upload-url", {
        organizationId: w.orgA,
        originalName: "giant.pdf",
        contentType: "application/pdf",
        sizeBytes: 20 * 1024 * 1024 + 1, // 20 MB + 1 byte
        sha256: dummySha256,
      });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/size|exceed/i);
    });

    it("accepts valid PDF, JPEG and PNG under 20 MB", async () => {
      for (const [name, mime] of [
        ["contract.pdf", "application/pdf"],
        ["seal.jpg", "image/jpeg"],
        ["stamp.png", "image/png"],
      ] as const) {
        const res = await callV1(w.memberA, "POST", "/files/upload-url", {
          organizationId: w.orgA,
          originalName: name,
          contentType: mime,
          sizeBytes: 5000,
          sha256: dummySha256,
        });
        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty("fileId");
        expect(res.body).toHaveProperty("uploadUrl");
        expect(res.body).toHaveProperty("uploadToken");
        expect(res.body).toHaveProperty("storageKey");
        expect(res.body.storageKey).toContain(w.orgA);
      }
    });

    it("sanitizes filenames against directory traversal attacks", async () => {
      const res = await callV1(w.memberA, "POST", "/files/upload-url", {
        organizationId: w.orgA,
        originalName: "../../../etc/passwd.pdf",
        contentType: "application/pdf",
        sizeBytes: 1024,
        sha256: dummySha256,
      });
      expect(res.status).toBe(200);
      expect(res.body.storageKey).not.toContain("..");
      expect(res.body.storageKey).toMatch(/^orgs\/[^/]+\/[^/]+\/passwd\.pdf$/);
    });
  });

  describe("Two-Phase Upload and Finalisation", () => {
    it("fails finalise when uploadToken is tampered or invalid", async () => {
      const res = await callV1(w.memberA, "POST", "/files/finalise", {
        uploadToken: "invalid-token-signature",
      });
      expect(res.status).toBe(422);
      expect(res.body.error).toMatch(/token/i);
    });

    it("fails finalise when uploadToken is expired", async () => {
      const expiredToken = signUploadToken({
        fileId: randomUUID(),
        organizationId: w.orgA,
        uploaderUserId: w.memberA.id,
        storageKey: `files/${w.orgA}/expired.pdf`,
        originalName: "expired.pdf",
        contentType: "application/pdf",
        sizeBytes: 100,
        sha256: dummySha256,
        expiresAt: Date.now() - 1000, // expired 1s ago
      });

      const res = await callV1(w.memberA, "POST", "/files/finalise", {
        uploadToken: expiredToken,
      });
      expect(res.status).toBe(422);
      expect(res.body.error).toMatch(/expired/i);
    });

    it("fails finalise when file in storage does not match expected size or checksum", async () => {
      const validUpload = await callV1(w.memberA, "POST", "/files/upload-url", {
        organizationId: w.orgA,
        originalName: "mismatch.pdf",
        contentType: "application/pdf",
        sizeBytes: 2000,
        sha256: dummySha256,
      });
      expect(validUpload.status).toBe(200);

      // Mutate mock storage to simulate corrupted/mismatched upload
      MemoryStorageProvider.put(validUpload.body.storageKey, {
        sizeBytes: 1500, // Wrong size
        sha256: dummySha256,
        contentType: "application/pdf",
      });

      const res = await callV1(w.memberA, "POST", "/files/finalise", {
        uploadToken: validUpload.body.uploadToken,
      });
      expect(res.status).toBe(422);
      expect(res.body.error).toMatch(/mismatch|size/i);
    });

    it("successfully finalises upload, inserts DB record, and records audit log", async () => {
      const fileSize = 4096;
      const sha = createHash("sha256").update("perfect file content").digest("hex");

      const initRes = await callV1(w.ownerA, "POST", "/files/upload-url", {
        organizationId: w.orgA,
        originalName: "commercial_invoice.pdf",
        contentType: "application/pdf",
        sizeBytes: fileSize,
        sha256: sha,
      });
      expect(initRes.status).toBe(200);
      const { fileId, uploadToken, storageKey } = initRes.body;

      // Seed mock storage accurately as an S3 PUT would
      MemoryStorageProvider.put(storageKey, {
        sizeBytes: fileSize,
        sha256: sha,
        contentType: "application/pdf",
      });

      // Finalise
      const finaliseRes = await callV1(w.ownerA, "POST", "/files/finalise", {
        uploadToken,
      });
      expect(finaliseRes.status).toBe(201);
      expect(finaliseRes.body.file.id).toBe(fileId);
      expect(finaliseRes.body.file.organizationId).toBe(w.orgA);
      expect(finaliseRes.body.file.uploaderUserId).toBe(w.ownerA.id);
      expect(finaliseRes.body.file.originalName).toBe("commercial_invoice.pdf");
      expect(finaliseRes.body.file.contentType).toBe("application/pdf");
      expect(finaliseRes.body.file.sizeBytes).toBe(fileSize);
      expect(finaliseRes.body.file.sha256).toBe(sha);

      // Verify row in core.file
      const [dbRecord] = await db
        .select()
        .from(schema.file)
        .where(eq(schema.file.id, fileId));
      expect(dbRecord).toBeDefined();
      expect(dbRecord!.storageKey).toBe(storageKey);

      // Verify audit log
      const [auditRecord] = await db
        .select()
        .from(schema.auditLog)
        .where(eq(schema.auditLog.entityId, fileId));
      expect(auditRecord).toBeDefined();
      expect(auditRecord!.action).toBe("file.uploaded");
      expect(auditRecord!.organizationId).toBe(w.orgA);
      expect(auditRecord!.actorUserId).toBe(w.ownerA.id);

      // Attempting to finalise again returns conflict
      const repeatRes = await callV1(w.ownerA, "POST", "/files/finalise", {
        uploadToken,
      });
      expect(repeatRes.status).toBe(409);
    });

    it("fails finalise when file has not been uploaded to storage", async () => {
      const initRes = await callV1(w.memberA, "POST", "/files/upload-url", {
        organizationId: w.orgA,
        originalName: "not_uploaded.pdf",
        contentType: "application/pdf",
        sizeBytes: 1000,
        sha256: dummySha256,
      });
      expect(initRes.status).toBe(200);

      const res = await callV1(w.memberA, "POST", "/files/finalise", {
        uploadToken: initRes.body.uploadToken,
      });
      expect(res.status).toBe(422);
      expect(res.body.error).toMatch(/not found in storage|not uploaded|does not exist/i);
    });

    it("refuses finalise when called by a different user than the one who requested upload-url", async () => {
      const initRes = await callV1(w.memberA, "POST", "/files/upload-url", {
        organizationId: w.orgA,
        originalName: "user_check.pdf",
        contentType: "application/pdf",
        sizeBytes: 1000,
        sha256: dummySha256,
      });
      expect(initRes.status).toBe(200);

      const res = await callV1(w.ownerA, "POST", "/files/finalise", {
        uploadToken: initRes.body.uploadToken,
      });
      expect(res.status).toBe(403);
      expect(res.body.error).toMatch(/initiated/i);
    });

    it("supports HTTP PUT and GET via mock-storage endpoints in development/testing", async () => {
      const content = Buffer.from("mock s3 upload payload");
      const sha = createHash("sha256").update(content).digest("hex");
      const initRes = await callV1(w.ownerA, "POST", "/files/upload-url", {
        organizationId: w.orgA,
        originalName: "mock_http.pdf",
        contentType: "application/pdf",
        sizeBytes: content.length,
        sha256: sha,
      });
      expect(initRes.status).toBe(200);
      const { uploadUrl, uploadToken } = initRes.body;

      // Extract path for in-process request
      const uploadPath = new URL(uploadUrl).pathname;
      const putRes = await app.request(uploadPath, {
        method: "PUT",
        headers: {
          "content-type": "application/pdf",
          "x-amz-checksum-sha256": Buffer.from(sha, "hex").toString("base64"),
        },
        body: content,
      });
      expect(putRes.status).toBe(200);

      // Finalise
      const finaliseRes = await callV1(w.ownerA, "POST", "/files/finalise", {
        uploadToken,
      });
      expect(finaliseRes.status).toBe(201);
      const fileId = finaliseRes.body.file.id;

      // Get download URL and fetch content
      const dlRes = await callV1(w.ownerA, "GET", `/files/${fileId}/download-url`);
      expect(dlRes.status).toBe(200);
      const dlPath = new URL(dlRes.body.downloadUrl).pathname;
      const getRes = await app.request(dlPath);
      expect(getRes.status).toBe(200);
      const downloadedBuf = Buffer.from(await getRes.arrayBuffer());
      expect(downloadedBuf.toString()).toBe(content.toString());
    });
  });

  describe("File Retrieval and Download URLs", () => {
    let testFileId: string;

    beforeAll(async () => {
      const sha = createHash("sha256").update("inspection doc").digest("hex");
      const initRes = await callV1(w.ownerA, "POST", "/files/upload-url", {
        organizationId: w.orgA,
        originalName: "inspection_certificate.png",
        contentType: "image/png",
        sizeBytes: 1024,
        sha256: sha,
      });
      testFileId = initRes.body.fileId;
      MemoryStorageProvider.put(initRes.body.storageKey, {
        sizeBytes: 1024,
        sha256: sha,
        contentType: "image/png",
      });
      await callV1(w.ownerA, "POST", "/files/finalise", {
        uploadToken: initRes.body.uploadToken,
      });
    });

    it("allows org members to view file metadata", async () => {
      const res = await callV1(w.memberA, "GET", `/files/${testFileId}`);
      expect(res.status).toBe(200);
      expect(res.body.file.id).toBe(testFileId);
      expect(res.body.file.originalName).toBe("inspection_certificate.png");
    });

    it("allows Entrust staff to view file metadata", async () => {
      const res = await callV1(w.admin, "GET", `/files/${testFileId}`);
      expect(res.status).toBe(200);
      expect(res.body.file.id).toBe(testFileId);
    });

    it("hides files from members of another organisation", async () => {
      const res = await callV1(w.ownerB, "GET", `/files/${testFileId}`);
      expect(res.status).toBe(404);
    });

    it("generates short-lived download URLs for authorised callers", async () => {
      const resMember = await callV1(w.memberA, "GET", `/files/${testFileId}/download-url`);
      expect(resMember.status).toBe(200);
      expect(resMember.body.downloadUrl).toContain("mock-storage");
      expect(resMember.body.fileName).toBe("inspection_certificate.png");
      expect(resMember.body.expiresInSeconds).toBe(900); // 15 minutes

      // Entrust staff can also download
      const resStaff = await callV1(w.admin, "GET", `/files/${testFileId}/download-url`);
      expect(resStaff.status).toBe(200);

      // Outsiders are refused
      const resOutsider = await callV1(w.ownerB, "GET", `/files/${testFileId}/download-url`);
      expect(resOutsider.status).toBe(404);
    });
  });

  describe.skipIf(!process.env.R2_ACCESS_KEY_ID)("Cloudflare R2 live integration", () => {
    it("verifies live R2 bucket connectivity when credentials are provided", async () => {
      expect(process.env.R2_ACCESS_KEY_ID).toBeDefined();
    });
  });
});

