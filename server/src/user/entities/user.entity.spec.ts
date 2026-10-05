import { canManageCommunity, hasPassword, User } from "./user.entity";

describe("hashPassword", () => {
  it("leaves a null password null", async () => {
    const user = new User({ password: null });
    await user.hashPassword();
    expect(user.password).toBeNull();
  });

  it("hashes a plaintext password", async () => {
    const user = new User({ password: "hunter2" });
    await user.hashPassword();
    expect(user.password).toMatch(/^\$2[abxy]?\$\d+\$/);
    expect(await user.checkPassword("hunter2")).toBe(true);
  });

  it("leaves an already hashed password alone", async () => {
    const user = new User({ password: "hunter2" });
    await user.hashPassword();
    const hash = user.password;
    await user.hashPassword();
    expect(user.password).toBe(hash);
  });
});

describe("checkPassword", () => {
  it("refuses every password when the account has none", async () => {
    const user = new User({ password: null });
    expect(await user.checkPassword("hunter2")).toBe(false);
    expect(await user.checkPassword("")).toBe(false);
  });

  it("refuses the wrong password", async () => {
    const user = new User({ password: "hunter2" });
    await user.hashPassword();
    expect(await user.checkPassword("hunter3")).toBe(false);
  });
});

describe("hasPassword", () => {
  it.each([
    { password: "hunter2", expected: true },
    { password: "", expected: false },
    { password: null, expected: false },
  ])("is $expected for password $password", ({ password, expected }) => {
    expect(hasPassword({ password })).toBe(expected);
  });
});

describe("canManageCommunity", () => {
  const leaderOf7 = { admin: false, leaderOfIdSet: new Set([7]) };
  const admin = { admin: true, leaderOfIdSet: new Set<number>() };

  it.each([
    {
      who: "a leader of the community",
      user: leaderOf7,
      id: 7,
      expected: true,
    },
    {
      who: "a leader of another community",
      user: leaderOf7,
      id: 8,
      expected: false,
    },
    {
      who: "a leader, with no community",
      user: leaderOf7,
      id: null,
      expected: false,
    },
    { who: "an admin", user: admin, id: 8, expected: true },
    {
      who: "an admin, with no community",
      user: admin,
      id: null,
      expected: true,
    },
  ])("is $expected for $who", ({ user, id, expected }) => {
    expect(canManageCommunity(user, id)).toBe(expected);
  });
});
