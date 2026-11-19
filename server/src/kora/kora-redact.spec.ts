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
  it("redacts what the reviewer typed, and nothing the conversation said", () => {
    const exported = {
      sessionId: "a@b.org",
      ratings: [
        {
          conversationId: "C1",
          q4Text: "mail x@example.org",
          highlights: [{ id: "h1", text: "write to y@example.org" }],
        },
      ],
      feedback: {
        f5: "yes",
        f5Text: "call +1 555 555 0101",
        f7: "z@example.org",
      },
    };
    expect(redactExport(exported)).toEqual({
      sessionId: "a@b.org",
      ratings: [
        {
          conversationId: "C1",
          q4Text: `mail ${REDACTED}`,
          highlights: [{ id: "h1", text: "write to y@example.org" }],
        },
      ],
      feedback: {
        f5: "yes",
        f5Text: `call ${REDACTED}`,
        f7: REDACTED,
      },
    });
  });

  it("leaves an export with no free text and no feedback alone", () => {
    const exported = { ratings: [{ conversationId: "C1" }], feedback: null };
    expect(redactExport(exported)).toEqual(exported);
  });

  it("keeps a redacted field within the export schema's maxLength", () => {
    const q4Text = "mail a@b.co ".padEnd(280, "x");
    const redacted = redactExport({ ratings: [{ q4Text }] });
    expect(redacted.ratings).toEqual([
      { q4Text: `mail ${REDACTED} ${"x".repeat(264)}` },
    ]);
  });
});
