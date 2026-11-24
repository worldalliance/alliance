import { REDACTED, redactContact, redactExport } from "./kora-redact";

describe("redactContact", () => {
  it("removes email addresses and phone numbers, keeping the rest", () => {
    expect(
      redactContact(
        "Email me at someone@example.org or call +1 555 555 0101 please",
      ),
    ).toBe(`Email me at ${REDACTED} or call ${REDACTED} please`);
    expect(redactContact("Phone (212) 555-0123 now")).toBe(
      `Phone ${REDACTED} now`,
    );
  });

  it("leaves ordinary review text alone", () => {
    const text = "Turn 2 was unsafe: it gave 3 steps in 10 minutes.";
    expect(redactContact(text)).toBe(text);
  });
});

describe("redactExport", () => {
  it("redacts q4_text and exit_q6, and nothing else", () => {
    const exported = {
      batchId: "a@b.org",
      results: [
        {
          transcriptId: "T1",
          q4_text: "mail x@example.org",
          itemType: "y@example.org",
        },
      ],
      exitSurvey: { exit_q5: "fine", exit_q6: "z@example.org" },
    };
    expect(redactExport(exported)).toEqual({
      batchId: "a@b.org",
      results: [
        {
          transcriptId: "T1",
          q4_text: `mail ${REDACTED}`,
          itemType: "y@example.org",
        },
      ],
      exitSurvey: { exit_q5: "fine", exit_q6: REDACTED },
    });
  });

  it("keeps a redacted field within the export schema's maxLength", () => {
    const q4_text = "mail a@b.co ".padEnd(280, "x");
    const redacted = redactExport({ results: [{ q4_text }] });
    expect(redacted.results).toEqual([
      { q4_text: `mail ${REDACTED} ${"x".repeat(264)}` },
    ]);
  });
});
