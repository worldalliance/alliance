import { readFileSync } from "node:fs";
import { join } from "node:path";
import { MAX_COPY_ATTEMPTS } from "./mms-media.service";

describe("staging anonymizer", () => {
  it("marks every copied-in media row given up on", () => {
    const sql = readFileSync(
      join(__dirname, "../../../scripts/anonymize/anonymize.sql"),
      "utf8",
    );
    expect(sql.match(/SET "copyAttempts" = (\d+)/)?.[1]).toBe(
      String(MAX_COPY_ATTEMPTS),
    );
  });
});
