import { describe, expect, it } from "vitest";
import { parseLocalWallWidth } from "./local-intent.js";

describe("local wall width intent", () => {
  it.each([
    ["кухня 3 метра", 3000],
    ["Стена 3 м", 3000],
    ["длина стены 2,7 метра", 2700],
    ["размер кухни 3200 мм", 3200],
  ])("parses %s", (utterance, width) => {
    expect(parseLocalWallWidth(utterance)?.command.payload.width).toBe(width);
  });

  it("does not mistake millimeters for meters", () => {
    expect(parseLocalWallWidth("мойка 600 мм")).toBeNull();
  });

  it("rejects dimensions outside supported range", () => {
    expect(parseLocalWallWidth("кухня 10 метров")).toBeNull();
  });
});
