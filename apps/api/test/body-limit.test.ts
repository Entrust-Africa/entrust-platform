import { describe, expect, it } from "vitest";
import { app } from "../src/app";

// No request body is bigger than it needs to be (audit #217): 1 MB in general, more for the workbook imports.
describe("the request size limit", () => {
  const send = (path: string, bytes: number) =>
    app.request(path, { method: "POST", headers: { "content-type": "application/json", origin: "http://localhost:3000" }, body: JSON.stringify({ pad: "x".repeat(bytes) }) });

  it("refuses a body over 1 MB before anything reads it", async () => {
    const res = await send("/v1/trade/modules/M01/knowledge-check/attempts", 2 * 1024 * 1024);
    expect(res.status).toBe(413);
    expect(await res.json()).toMatchObject({ code: "invalid" });
  });

  it("lets a workbook import be larger", async () => {
    // Signed out, so it's refused for that reason, after the size check let it through.
    const res = await send("/v1/trade/register/import", 2 * 1024 * 1024);
    expect(res.status).toBe(401);
  });
});
