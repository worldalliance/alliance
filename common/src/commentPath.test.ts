import { commentPath } from "./commentPath";

describe("commentPath", () => {
  test("links a post comment to its post", () => {
    expect(
      commentPath({ parentObjectType: "post", parentObjectId: 12, id: 34 }),
    ).toBe("/forum/post/12?replyId=34");
  });

  test("links an action comment to its action", () => {
    expect(
      commentPath({ parentObjectType: "action", parentObjectId: 5, id: 34 }),
    ).toBe("/actions/5?replyId=34");
  });

  test("links an activity comment under its action", () => {
    expect(
      commentPath(
        { parentObjectType: "activity", parentObjectId: 7, id: 34 },
        5,
      ),
    ).toBe("/actions/5/activity/7?replyId=34");
  });

  test("throws for an activity comment without its action id", () => {
    expect(() =>
      commentPath({ parentObjectType: "activity", parentObjectId: 7, id: 34 }),
    ).toThrow("activity comment 34 has no action id");
  });
});
