import { describe, expect, it } from "vitest";
import { safeLinkTarget } from "../src/links";

describe("which Markdown links are drawn", () => {
  it("draws web pages, email addresses and paths on this site", () => {
    expect(safeLinkTarget("https://entrust-africa.com/trade")).toEqual({ href: "https://entrust-africa.com/trade", external: true });
    expect(safeLinkTarget("mailto:trade@entrust-africa.com")).toEqual({ href: "mailto:trade@entrust-africa.com", external: false });
    expect(safeLinkTarget("/modules/M04?lesson=intro#top")).toEqual({ href: "/modules/M04?lesson=intro#top", external: false });
  });

  it("refuses a path a browser would read as another site", () => {
    expect(safeLinkTarget("//evil.example/x")).toBeNull();
    expect(safeLinkTarget("/\\evil.example/x")).toBeNull();
    expect(safeLinkTarget("/\\/evil.example")).toBeNull();
    expect(safeLinkTarget("\\\\evil.example")).toBeNull();
  });

  it("refuses scripts and anything else", () => {
    expect(safeLinkTarget("javascript:alert(1)")).toBeNull();
    expect(safeLinkTarget("data:text/html,hi")).toBeNull();
    expect(safeLinkTarget("modules/M04")).toBeNull();
  });
});
