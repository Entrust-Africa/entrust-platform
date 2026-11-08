import { describe, expect, it } from "vitest";
import { figureIsVisible, protectGroup } from "../src/reports";

const smes = (...ids: string[]) => new Set(ids);
const five = smes("a", "b", "c", "d", "e");
const nobody = smes();

describe("figureIsVisible", () => {
  it("shows a figure built from five SMEs or from nobody", () => {
    expect(figureIsVisible(five, nobody)).toBe(true);
    expect(figureIsVisible(nobody, nobody)).toBe(true);
  });

  it("hides a figure built from fewer than five SMEs", () => {
    expect(figureIsVisible(smes("a", "b", "c", "d"), nobody)).toBe(false);
    expect(figureIsVisible(smes("a"), smes("b"))).toBe(false);
  });

  it("shows it when every one of those SMEs consented, and not when only some did", () => {
    expect(figureIsVisible(smes("a", "b"), smes("a", "b", "z"))).toBe(true);
    expect(figureIsVisible(smes("a", "b"), smes("a"))).toBe(false);
  });
});

describe("protectGroup", () => {
  it("leaves a group alone when every cell is big enough", () => {
    expect(protectGroup([{ value: 5, smes: five }, { value: 0, smes: nobody }], nobody)).toEqual([5, 0]);
  });

  it("hides the next smallest cell too, so the total can't give the small one back", () => {
    const six = smes("a", "b", "c", "d", "e", "f");
    const cells = [{ value: 2, smes: smes("x", "y") }, { value: 5, smes: five }, { value: 6, smes: six }, { value: 0, smes: nobody }];
    expect(protectGroup(cells, nobody)).toEqual([null, null, 6, 0]);
  });

  it("needs no second cell when two are hidden already, or when the total is hidden as well", () => {
    expect(protectGroup([{ value: 2, smes: smes("x", "y") }, { value: 1, smes: smes("z") }, { value: 5, smes: five }], nobody)).toEqual([null, null, 5]);
    expect(protectGroup([{ value: 2, smes: smes("x", "y") }, { value: 5, smes: five }], nobody, false)).toEqual([null, 5]);
  });
});
