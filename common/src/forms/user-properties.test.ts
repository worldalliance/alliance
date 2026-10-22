import {
  emptyUserPropertyPresence,
  UserValueProperty,
  userValuePropertyPresence,
} from "./user-properties";

const emptyBag = {
  name: null,
  email: null,
  phoneNumber: null,
  preferredReminderTime: null,
  timeZone: null,
  profilePicture: null,
  profileDescription: null,
  city: null,
  customCityString: null,
  over18: null,
  clusterId: null,
  staffTitle: null,
  switchedDomainAt: null,
  referredById: null,
  shareInfoPublicly: null,
};

describe("userValuePropertyPresence", () => {
  it("treats city as set when a structured city or a custom city string is present", () => {
    expect(userValuePropertyPresence(emptyBag).city).toBe(false);
    expect(
      userValuePropertyPresence({ ...emptyBag, city: { id: 1 } }).city,
    ).toBe(true);
    expect(
      userValuePropertyPresence({
        ...emptyBag,
        customCityString: "  Portland ",
      }).city,
    ).toBe(true);
    expect(
      userValuePropertyPresence({ ...emptyBag, customCityString: "   " }).city,
    ).toBe(false);
  });

  it("counts over18 as set when it is true or false, not when it is null", () => {
    expect(userValuePropertyPresence(emptyBag).over18).toBe(false);
    expect(
      userValuePropertyPresence({ ...emptyBag, over18: false }).over18,
    ).toBe(true);
    expect(
      userValuePropertyPresence({ ...emptyBag, over18: true }).over18,
    ).toBe(true);
  });

  it("treats blank strings as unset", () => {
    expect(
      userValuePropertyPresence({ ...emptyBag, phoneNumber: "  " }).phoneNumber,
    ).toBe(false);
    expect(
      userValuePropertyPresence({ ...emptyBag, phoneNumber: "555" })
        .phoneNumber,
    ).toBe(true);
  });

  it("treats shareInfoPublicly as set only when it is true", () => {
    expect(userValuePropertyPresence(emptyBag).shareInfoPublicly).toBe(false);
    expect(
      userValuePropertyPresence({ ...emptyBag, shareInfoPublicly: false })
        .shareInfoPublicly,
    ).toBe(false);
    expect(
      userValuePropertyPresence({ ...emptyBag, shareInfoPublicly: true })
        .shareInfoPublicly,
    ).toBe(true);
  });

  it("returns an all-false map from emptyUserPropertyPresence", () => {
    const empty = emptyUserPropertyPresence();
    for (const property of Object.values(UserValueProperty)) {
      expect(empty[property]).toBe(false);
    }
  });
});
