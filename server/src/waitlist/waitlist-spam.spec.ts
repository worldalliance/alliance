import { WaitlistSpamStatus } from "./entities/waitlist-entry.entity";
import { detectSpamStatus } from "./waitlist-spam";

describe("detectSpamStatus", () => {
  it.each([
    "biJrcBSgyHNPuKeQHjlts",
    " qLafPPcCZIjiVngKZuQtEW ",
    "abcdefghiJKL",
    "ABCDefghijkl",
  ])("suspects the reason %p", (reason) => {
    expect(detectSpamStatus(reason)).toBe(WaitlistSpamStatus.Suspected);
  });

  it.each([
    null,
    "",
    "I want to help organize my neighborhood.",
    "Sustainability",
    "ClimateJusticeNow",
    "AbCdEfGhIjK",
    "qLafPPcCZIji VngKZuQtEW",
    "abcdefghJKL",
    "abcdefghijKL",
    "ABCdefghijkl",
    "abcdéfghiJKLm",
    "abc1defghiJKL",
  ])("passes the reason %p", (reason) => {
    expect(detectSpamStatus(reason)).toBe(WaitlistSpamStatus.Clean);
  });
});
