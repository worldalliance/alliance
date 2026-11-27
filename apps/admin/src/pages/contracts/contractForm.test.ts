import { EMPTY_FORM, errorsOf, saveBodyOf, saveNoteOf } from "./contractForm";

const now = new Date("2026-06-01T00:00:00.000Z");
const past = "2026-01-01T00:00:00.000Z";
const later = "2026-03-01T00:00:00.000Z";
const future = "2026-09-01T00:00:00.000Z";
const listed = (
  id: number,
  startDate: string | null,
  endDate: string | null = null,
  description = [{ point: "P", subtext: "", adminNotes: "" }],
) => ({
  id,
  name: `C${id}`,
  startDate,
  endDate,
  description,
});

describe("saveNoteOf", () => {
  it("says joining doesn't ask members to sign one with no start", () => {
    expect(
      saveNoteOf({
        form: EMPTY_FORM,
        contractId: null,
        contracts: [],
        activeId: null,
        pointsChanged: false,
        now,
      }),
    ).toBe(
      "No start date, so members aren't asked to sign it when they join or on their Membership page.",
    );
  });

  it("names the later-starting contract members sign instead", () => {
    expect(
      saveNoteOf({
        form: { ...EMPTY_FORM, startDate: past },
        contractId: 1,
        contracts: [listed(1, past), listed(2, later)],
        activeId: 2,
        pointsChanged: false,
        now,
      }),
    ).toMatch(/^“C2” started later, so members sign that one instead\./);
  });

  it("says a started contract becomes the one members sign on save", () => {
    expect(
      saveNoteOf({
        form: { ...EMPTY_FORM, startDate: later },
        contractId: 1,
        contracts: [listed(1, null), listed(2, past)],
        activeId: 2,
        pointsChanged: false,
        now,
      }),
    ).toBe(
      "On save, members are asked to sign this contract and the public site quotes it. Members on a contract other than this one then see “An updated agreement is available” on their Membership page.",
    );
  });

  it("says a future start waits for its date", () => {
    expect(
      saveNoteOf({
        form: { ...EMPTY_FORM, startDate: future },
        contractId: null,
        contracts: null,
        activeId: null,
        pointsChanged: false,
        now,
      }),
    ).toBe(
      "Members are asked to sign it when they join or on their Membership page from its start date until a contract with a later start begins.",
    );
  });

  it("names the contract that replaces the active one taken out of force", () => {
    const note = (form: Partial<typeof EMPTY_FORM>) =>
      saveNoteOf({
        form: { ...EMPTY_FORM, ...form },
        contractId: 2,
        contracts: [listed(1, past), listed(2, later)],
        activeId: 2,
        pointsChanged: false,
        now,
      });
    const unasked =
      "members aren't asked to sign it when they join or on their Membership page. A task form that names it still asks.";
    const replaced =
      " On save, members are asked to sign “C1” instead and the public site quotes it. Members on a contract other than “C1” then see “An updated agreement is available” on their Membership page.";
    expect(note({})).toBe(`No start date, so ${unasked}${replaced}`);
    expect(
      note({ startDate: later, endDate: "2026-04-01T00:00:00.000Z" }),
    ).toBe(`Past its end date, so ${unasked}${replaced}`);
    expect(note({ startDate: future })).toContain(replaced);
    expect(note({ startDate: "2025-12-01T00:00:00.000Z" })).toBe(
      replaced.trim(),
    );
  });

  it("says no contract is in force once the only active one is taken out", () => {
    expect(
      saveNoteOf({
        form: EMPTY_FORM,
        contractId: 2,
        contracts: [listed(2, later)],
        activeId: 2,
        pointsChanged: false,
        now,
      }),
    ).toMatch(
      /On save, no contract is in force, so new members have none to sign when they join\.$/,
    );
  });

  it("tells members of the active contract only of changed points", () => {
    const note = (pointsChanged: boolean) =>
      saveNoteOf({
        form: { ...EMPTY_FORM, startDate: later },
        contractId: 2,
        contracts: [listed(1, past), listed(2, later)],
        activeId: 2,
        pointsChanged,
        now,
      });
    expect(note(false)).toBe("");
    expect(note(true)).toMatch(/signed this contract see the new points too/);
  });

  it("says what members sign once a new end date on the active one passes", () => {
    const note = (contracts: ReturnType<typeof listed>[]) =>
      saveNoteOf({
        form: { ...EMPTY_FORM, startDate: later, endDate: future },
        contractId: 2,
        contracts,
        activeId: 2,
        pointsChanged: false,
        now,
      });
    expect(note([listed(1, past), listed(2, later)])).toBe(
      "From its end date, members are asked to sign “C1” instead. Members on a contract other than “C1” then see “An updated agreement is available” on their Membership page.",
    );
    expect(note([listed(2, later)])).toBe(
      "From its end date, no contract is in force, so new members have none to sign when they join.",
    );
    expect(note([listed(2, later, future)])).toBe("");
  });
});

describe("errorsOf and saveBodyOf", () => {
  it("rejects an end before the start and sends empty dates as null", () => {
    const form = {
      ...EMPTY_FORM,
      markdown: "Terms",
      startDate: later,
      endDate: past,
    };
    expect(
      errorsOf(form, {
        contractId: null,
        contracts: null,
        datesChanged: false,
        now,
      }).endDate,
    ).toBeDefined();
    expect(saveBodyOf({ ...form, endDate: "" }).create).toMatchObject({
      markdown: "Terms",
      startDate: later,
      endDate: null,
    });
  });

  it("refuses a started or scheduled contract with no points, but not an ended one", () => {
    const form = { ...EMPTY_FORM, markdown: "Terms", startDate: future };
    const blank = { key: "a", point: "", subtext: "", adminNotes: "" };
    expect(
      errorsOf(form, {
        contractId: null,
        contracts: null,
        datesChanged: false,
        now,
      }).noPoints,
    ).toBeDefined();
    expect(
      errorsOf(
        { ...form, points: [blank] },
        { contractId: null, contracts: null, datesChanged: false, now },
      ).noPoints,
    ).toBeDefined();
    expect(
      errorsOf(
        { ...form, startDate: past, endDate: later },
        { contractId: null, contracts: null, datesChanged: false, now },
      ).noPoints,
    ).toBeUndefined();
    expect(
      errorsOf(EMPTY_FORM, {
        contractId: 1,
        contracts: null,
        datesChanged: false,
        now,
      }).noPoints,
    ).toBeUndefined();
  });

  it("lets a contract a later start replaced keep no points", () => {
    const contracts = [listed(1, past), listed(2, later)];
    const form = { ...EMPTY_FORM, startDate: past };
    expect(
      errorsOf(form, { contractId: 1, contracts, datesChanged: true, now })
        .noPoints,
    ).toBeUndefined();
    expect(
      errorsOf(
        { ...form, startDate: later },
        { contractId: 2, contracts, datesChanged: true, now },
      ).noPoints,
    ).toBeDefined();
  });

  it("refuses dates that hand members another contract with no points", () => {
    const pointless = listed(1, past, null, []);
    const errors = (
      form: Partial<typeof EMPTY_FORM>,
      contracts: ReturnType<typeof listed>[] | null,
    ) =>
      errorsOf(
        {
          ...EMPTY_FORM,
          points: [{ key: "a", point: "P", subtext: "", adminNotes: "" }],
          ...form,
        },
        { contractId: 2, contracts, datesChanged: true, now },
      ).schedule;
    const refusal = /^“C1” has no points/;
    expect(errors({ startDate: "" }, [pointless, listed(2, later)])).toMatch(
      refusal,
    );
    expect(
      errors({ startDate: later, endDate: future }, [
        pointless,
        listed(2, later),
      ]),
    ).toMatch(refusal);
    expect(
      errors({ startDate: "" }, [listed(1, past), listed(2, later)]),
    ).toBeUndefined();
    expect(errors({ startDate: later, endDate: future }, null)).toMatch(
      /^Couldn't load/,
    );
    expect(
      errors({ startDate: "" }, [pointless, listed(2, null)]),
    ).toBeUndefined();
  });
});
