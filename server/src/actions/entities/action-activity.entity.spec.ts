import { User } from "src/user/entities/user.entity";
import {
  loadedActionActivityAction,
  loadedActionActivityUser,
} from "./action-activity.entity";
import { Action } from "./action.entity";

describe("loadedActionActivityAction", () => {
  it("returns the loaded action", () => {
    const action = new Action();
    expect(loadedActionActivityAction({ id: 3, action })).toBe(action);
  });

  it("throws when the action isn't loaded", () => {
    expect(() =>
      loadedActionActivityAction({ id: 3, action: undefined }),
    ).toThrow("action of action activity 3 not loaded");
  });
});

describe("loadedActionActivityUser", () => {
  it("returns the loaded user", () => {
    const user = new User();
    expect(loadedActionActivityUser({ id: 3, user })).toBe(user);
  });

  it("throws when the user isn't loaded", () => {
    expect(() => loadedActionActivityUser({ id: 3, user: undefined })).toThrow(
      "user of action activity 3 not loaded",
    );
  });
});
