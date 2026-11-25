import type { ShareUrlAdminDto } from "@alliance/shared/client/types.gen";
import { render, screen } from "@testing-library/react";
import { expect, it } from "bun:test";
import { EditShareLinkLabelDialog } from "./EditShareLinkLabelDialog";

const link = {
  id: "a",
  kind: "action",
  sid: null,
  url: "https://example.com/s/a",
  duplicate: true,
  label: "Newsletter",
  userId: 5,
  campaignId: null,
  createdAt: "2026-01-02T00:00:00.000Z",
  signupCount: 0,
} satisfies ShareUrlAdminDto;

it.each([
  ["an action link", link, "For staff only."],
  [
    "a campaign's invite link",
    { ...link, kind: "invite", userId: null },
    "For staff only.",
  ],
  [
    "a member's invite link",
    { ...link, kind: "invite" },
    "The member sees this label on their Invites page.",
  ],
] as const)("says who sees %s's label", (_, shown, help) => {
  render(
    <EditShareLinkLabelDialog
      link={shown}
      busy={false}
      refusal={null}
      onSave={() => {}}
      onClose={() => {}}
    />,
  );

  expect(screen.getByText(help, { exact: false })).toBeTruthy();
});
