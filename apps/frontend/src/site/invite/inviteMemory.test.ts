import { InviteAvailability } from "@alliance/shared/lib/useInvite";
import {
  captureInvite,
  loadInviteMemory,
  NO_INVITE,
  saveInviteMemory,
  selectedCode,
  settleInvite,
} from "./inviteMemory";

const settled = (
  memory: Parameters<typeof settleInvite>[0],
  code: string,
  availability: InviteAvailability,
) => settleInvite(memory, { code, availability });

describe("invite memory", () => {
  beforeEach(() => sessionStorage.clear());

  it("selects a captured code over the saved one", () => {
    const memory = captureInvite({ explicit: null, saved: "old" }, "new");
    expect(selectedCode(memory)).toBe("new");
  });

  it("replaces the saved code once an explicit one proves valid", () => {
    expect(
      settled(
        { explicit: "new", saved: "old" },
        "new",
        InviteAvailability.Available,
      ),
    ).toEqual({ explicit: null, saved: "new" });
  });

  it("keeps but hides the saved code behind an unavailable explicit one", () => {
    const memory = settled(
      { explicit: "bad", saved: "old" },
      "bad",
      InviteAvailability.Unavailable,
    );
    expect(memory).toEqual({ explicit: "bad", saved: "old" });
    expect(selectedCode(memory)).toBe("bad");
  });

  it("clears a saved code that becomes unavailable, remembering why", () => {
    expect(
      settled(
        { explicit: null, saved: "old" },
        "old",
        InviteAvailability.Unavailable,
      ),
    ).toEqual({ explicit: "old", saved: null });
  });

  it.each([InviteAvailability.Unknown, InviteAvailability.Checking])(
    "keeps a code whose availability is %s",
    (availability) => {
      const memory = { explicit: "new", saved: "old" };
      expect(settled(memory, "new", availability)).toBe(memory);
    },
  );

  it("ignores a result for a code no longer selected", () => {
    const memory = { explicit: "newer", saved: "old" };
    expect(settled(memory, "new", InviteAvailability.Unavailable)).toBe(memory);
    expect(settled(NO_INVITE, "new", InviteAvailability.Available)).toBe(
      NO_INVITE,
    );
  });

  it("round-trips through sessionStorage and removes an empty memory", () => {
    const memory = { explicit: "bad", saved: "old" };
    saveInviteMemory(memory);
    expect(loadInviteMemory()).toEqual(memory);

    saveInviteMemory(NO_INVITE);
    expect(sessionStorage.length).toBe(0);
  });

  it("starts empty from malformed storage", () => {
    sessionStorage.setItem("alliance:invite", "{not json");
    expect(loadInviteMemory()).toEqual(NO_INVITE);
    sessionStorage.setItem("alliance:invite", JSON.stringify({ code: 1 }));
    expect(loadInviteMemory()).toEqual(NO_INVITE);
  });
});
