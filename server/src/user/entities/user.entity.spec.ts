import { User } from "./user.entity";

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
