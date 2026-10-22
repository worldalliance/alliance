import {
  DEFAULT_INVITE_MESSAGE_TEMPLATE,
  formatInviteMessage,
  INVITE_LINK_TOKEN,
} from "./inviteMessage";

describe("formatInviteMessage", () => {
  it("replaces every invite link token", () => {
    expect(
      formatInviteMessage(
        `${INVITE_LINK_TOKEN} and ${INVITE_LINK_TOKEN}`,
        "https://example.com/invite",
      ),
    ).toBe("https://example.com/invite and https://example.com/invite");
  });

  it("ships with a default template containing the invite link token", () => {
    expect(DEFAULT_INVITE_MESSAGE_TEMPLATE).toContain(INVITE_LINK_TOKEN);
  });
});
