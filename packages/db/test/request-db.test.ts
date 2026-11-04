import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getDb, runWithRequestDb } from "../src";

// The pools are never queried, so no database needs to be running.
describe("runWithRequestDb", () => {
  let previous: string | undefined;
  beforeEach(() => {
    previous = process.env.DATABASE_URL;
    process.env.DATABASE_URL = "postgres://nobody:nothing@127.0.0.1:1/none";
  });
  afterEach(() => {
    if (previous === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = previous;
  });

  it("gives a request its own database, different from the shared one", async () => {
    const shared = getDb();
    const inside = await runWithRequestDb(async () => getDb());
    expect(inside).not.toBe(shared);
    expect(getDb()).toBe(shared);
  });

  it("returns the same database throughout one request, including after awaits", async () => {
    const seen = await runWithRequestDb(async () => {
      const first = getDb();
      await new Promise((resolve) => setTimeout(resolve, 5));
      return [first, getDb()];
    });
    expect(seen[0]).toBe(seen[1]);
  });

  it("keeps concurrent requests apart", async () => {
    const [a, b] = await Promise.all([
      runWithRequestDb(async () => {
        await new Promise((resolve) => setTimeout(resolve, 5));
        return getDb();
      }),
      runWithRequestDb(async () => getDb()),
    ]);
    expect(a).not.toBe(b);
  });

  it("passes the result and errors through", async () => {
    await expect(runWithRequestDb(async () => 42)).resolves.toBe(42);
    await expect(
      runWithRequestDb(async () => {
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");
  });
});
