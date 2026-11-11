import { createRoute, OpenAPIHono } from "@hono/zod-openapi";
import { getDb } from "@entrust/db";
import type { AppEnv } from "../../app";
import {
  AdminOverrideModuleBody,
  CertificateCodeParam,
  CertificateParam,
  CertificateView,
  EnrollmentParam,
  ExitAssessmentReportView,
  PublicCertificateView,
  RevokeCertificateBody,
} from "../../schemas/trade";
import {
  adminOverrideModuleCompletion,
  getCertificateByCodePublic,
  getCertificateForEnrollment,
  getExitAssessmentReport,
  revokeCertificate,
} from "../../services/trade-completion";
import { clearRouter, contextFor, json, listErrors, problem, writeErrors } from "../clear/shared";

const tags = ["TRADE certificates & completion"];

const publicRouter = new OpenAPIHono<AppEnv>({
  defaultHook: (result, c) => {
    if (result.success) return;
    const error = result.error.issues.map((i) => `${i.path.join(".") || "request"}: ${i.message}`).join("; ");
    return c.json({ error, code: "invalid" as const }, 400);
  },
});

const router = clearRouter("trade");

// 1. Public certificate verification by unique code (#71)
const publicVerifyRoute = createRoute({
  method: "get",
  path: "/certificates/{code}/public",
  tags,
  summary: "Public certificate verification",
  description: "A public TRADE endpoint showing the SME's name, program, and completion date for a valid certificate code, or showing revocation details if revoked.",
  request: {
    params: CertificateCodeParam,
  },
  responses: {
    200: { description: "The verified certificate details", content: json(PublicCertificateView) },
    404: problem("Certificate not found"),
  },
});

// 2. Authenticated certificate lookup for an enrollment (#71)
const enrollmentCertificateRoute = createRoute({
  method: "get",
  path: "/enrollments/{id}/certificate",
  tags,
  summary: "Get certificate for enrollment",
  description: "Fetches the certificate issued to an enrollment, including verification link and status.",
  request: {
    params: EnrollmentParam,
  },
  responses: {
    200: { description: "The enrollment certificate", content: json(CertificateView) },
    ...listErrors,
    404: problem("Certificate or enrollment not found"),
  },
});

// 3. Admin revocation with reason (#71)
const revokeRoute = createRoute({
  method: "post",
  path: "/certificates/{id}/revoke",
  tags,
  summary: "Revoke a certificate",
  description: "Entrust admin revokes a certificate with an audited reason. The public verification page will show it as revoked.",
  request: {
    params: CertificateParam,
    body: { content: json(RevokeCertificateBody), required: true },
  },
  responses: {
    200: { description: "The revoked certificate", content: json(CertificateView) },
    ...writeErrors,
    403: problem("Only Entrust administrators can revoke certificates"),
    404: problem("Certificate not found"),
  },
});

// 4. Admin module completion override (#71)
const adminOverrideRoute = createRoute({
  method: "post",
  path: "/admin/override-module-completion",
  tags,
  summary: "Admin override module completion",
  description: "The only manual completion route: an Entrust admin marks a module passed with an audited reason.",
  request: {
    body: { content: json(AdminOverrideModuleBody), required: true },
  },
  responses: {
    200: {
      description: "Module completion overridden",
      content: json(
        AdminOverrideModuleBody.pick({ enrollmentId: true, moduleId: true }).extend({
          success: CertificateView.shape.isValid,
        })
      ),
    },
    ...writeErrors,
    403: problem("Only Entrust administrators can override module completion"),
    404: problem("Enrollment not found"),
  },
});

// 5. Exit assessment comparative report (#71)
const exitReportRoute = createRoute({
  method: "get",
  path: "/enrollments/{id}/exit-report",
  tags,
  summary: "Exit assessment capability comparison",
  description: "Compares exit assessment capability scores against baseline placement assessment scores per domain.",
  request: {
    params: EnrollmentParam,
  },
  responses: {
    200: { description: "The capability comparison report", content: json(ExitAssessmentReportView) },
    ...listErrors,
    404: problem("Enrollment or assessment report not found"),
  },
});

publicRouter.openapi(publicVerifyRoute, async (c) => {
  const { code } = c.req.valid("param");
  const cert = await getCertificateByCodePublic(getDb(), code);
  return c.json(cert, 200);
});

router
  .openapi(enrollmentCertificateRoute, async (c) => {
    const ctx = await contextFor(c.get("user"));
    const { id } = c.req.valid("param");
    const cert = await getCertificateForEnrollment(ctx, id);
    if (!cert) {
      return c.json({ title: "Not Found", status: 404, detail: "No certificate issued for this enrollment yet." } as never, 404);
    }
    return c.json(cert, 200);
  })
  .openapi(revokeRoute, async (c) => {
    const ctx = await contextFor(c.get("user"));
    const { id } = c.req.valid("param");
    const { reason, publicReason } = c.req.valid("json");
    const cert = await revokeCertificate(ctx, id, reason, publicReason);
    return c.json(cert, 200);
  })
  .openapi(adminOverrideRoute, async (c) => {
    const ctx = await contextFor(c.get("user"));
    const body = c.req.valid("json");
    const result = await adminOverrideModuleCompletion(ctx, body);
    return c.json(result, 200);
  })
  .openapi(exitReportRoute, async (c) => {
    const ctx = await contextFor(c.get("user"));
    const { id } = c.req.valid("param");
    const report = await getExitAssessmentReport(ctx, id);
    return c.json(report, 200);
  });

export const tradePublicCertificates = publicRouter;
export const tradeCertificates = router;
