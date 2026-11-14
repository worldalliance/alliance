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
  it("redacts annotation notes, q3_text and exit_q6, and nothing else", () => {
    const exported = {
      batchId: "a@b.org",
      results: [
        {
          transcriptId: "T1",
          q3_text: "mail x@example.org",
          annotations: [
            { id: "n1", note: "call +1 555 555 0101", text: "y@example.org" },
          ],
        },
      ],
      exitSurvey: { exit_q5: "fine", exit_q6: "z@example.org" },
    };
    expect(redactExport(exported)).toEqual({
      batchId: "a@b.org",
      results: [
        {
          transcriptId: "T1",
          q3_text: `mail ${REDACTED}`,
          annotations: [
            { id: "n1", note: `call ${REDACTED}`, text: "y@example.org" },
          ],
        },
      ],
      exitSurvey: { exit_q5: "fine", exit_q6: REDACTED },
    });
  });

  it("redacts the profile's free-text country and gender", () => {
    expect(
      redactExport({
        results: [],
        profile: {
          country: "mail me x@example.org",
          gender: "call +1 555 555 0101",
          age_band: "25_34",
        },
      }).profile,
    ).toEqual({
      country: `mail me ${REDACTED}`,
      gender: `call ${REDACTED}`,
      age_band: "25_34",
    });
  });

  it("keeps a redacted field within the export schema's maxLength", () => {
    const note = "mail a@b.co ".padEnd(140, "x");
    const redacted = redactExport({ results: [{ annotations: [{ note }] }] });
    expect(redacted.results).toEqual([
      { annotations: [{ note: `mail ${REDACTED} ${"x".repeat(124)}` }] },
    ]);
  });
});
