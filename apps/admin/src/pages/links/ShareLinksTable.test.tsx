import type { ShareUrlAdminDto } from "@alliance/shared/client";
import { render, screen } from "@testing-library/react";
import { ShareLinksTable } from "./ShareLinksTable";
import { groupShareLinks } from "./shareLinkTargets";

const link = (overrides: Partial<ShareUrlAdminDto>): ShareUrlAdminDto => ({
  id: "a",
  kind: "action",
  sid: null,
  url: "https://example.com/s/a",
  duplicate: false,
  label: "Newsletter",
  userId: 5,
  campaignId: null,
  createdAt: "2026-01-02T00:00:00.000Z",
  signupCount: 3,
  action: { id: 1, name: "Call your rep" },
  ...overrides,
});

const renderSignups = (row: ShareUrlAdminDto) => {
  render(
    <ShareLinksTable
      groups={groupShareLinks([row])}
      rowProps={() => ({})}
      deletingId={null}
      onCopy={() => {}}
      onEditLabel={() => {}}
      onDelete={() => {}}
    />,
  );
  return screen.getAllByRole("cell")[4]?.textContent;
};

it("counts a member's task link's signups, which the server records for every kind", () => {
  expect(renderSignups(link({}))).toBe("3");
});

it("shows no count for a campaign's link, whose signups record no link", () => {
  expect(renderSignups(link({ userId: null, campaignId: 7 }))).toBe("—");
});
