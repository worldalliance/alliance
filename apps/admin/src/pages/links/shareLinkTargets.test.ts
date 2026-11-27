import type { ShareUrlAdminDto } from "@alliance/shared/client";
import { groupShareLinks } from "./shareLinkTargets";

const link = (
  id: string,
  overrides: Partial<ShareUrlAdminDto>,
): ShareUrlAdminDto => ({
  id,
  kind: "action",
  sid: null,
  url: `https://example.com/s/${id}`,
  duplicate: false,
  label: null,
  userId: 5,
  campaignId: null,
  createdAt: "2026-01-02T00:00:00.000Z",
  signupCount: 0,
  ...overrides,
});

it("groups links by target, newest group first, canonical then oldest duplicate first", () => {
  const action = { id: 1, name: "Call your rep" };
  const groups = groupShareLinks([
    link("a-dup-new", {
      action,
      duplicate: true,
      createdAt: "2026-01-04T00:00:00.000Z",
    }),
    link("a-dup-old", {
      action,
      duplicate: true,
      createdAt: "2026-01-03T00:00:00.000Z",
    }),
    link("a-canonical", { action, createdAt: "2026-01-05T00:00:00.000Z" }),
    link("external", {
      kind: "externalTarget",
      externalTarget: { id: 2, name: "Petition" },
      createdAt: "2026-01-06T00:00:00.000Z",
    }),
    link("invite", { kind: "invite", createdAt: "2026-01-01T00:00:00.000Z" }),
    link("orphan", { kind: "externalTarget" }),
  ]);

  expect(
    groups.map((g) => ({
      key: g.key,
      ids: g.rows.map((r) => r.id),
      duplicateCount: g.duplicateCount,
    })),
  ).toEqual([
    { key: "external-2", ids: ["external"], duplicateCount: 0 },
    {
      key: "action-1",
      ids: ["a-canonical", "a-dup-old", "a-dup-new"],
      duplicateCount: 2,
    },
    { key: "invite", ids: ["invite"], duplicateCount: 0 },
  ]);
});
