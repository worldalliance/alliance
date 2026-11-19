import { newMessageHoldsInput } from "./newMessageHoldsInput";

const empty = { selectedUserIds: [], message: "", attachments: [] };

describe("newMessageHoldsInput", () => {
  it("ignores the recipient a link picked", () => {
    expect(
      newMessageHoldsInput({ ...empty, selectedUserIds: [5], linkUserId: 5 }),
    ).toBe(false);
  });

  it("holds once another recipient, text or an attachment is added", () => {
    const linked = { ...empty, selectedUserIds: [5], linkUserId: 5 };
    expect(newMessageHoldsInput({ ...linked, selectedUserIds: [5, 7] })).toBe(
      true,
    );
    expect(newMessageHoldsInput({ ...linked, message: "Hi" })).toBe(true);
    expect(newMessageHoldsInput({ ...linked, attachments: ["a.jpg"] })).toBe(
      true,
    );
  });

  it("holds for any recipient without a link", () => {
    expect(newMessageHoldsInput({ ...empty, linkUserId: NaN })).toBe(false);
    expect(
      newMessageHoldsInput({ ...empty, selectedUserIds: [5], linkUserId: NaN }),
    ).toBe(true);
  });
});
