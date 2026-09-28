import type { GeneralUpdateAdminDto } from "@alliance/shared/client";

export const generalUpdateAdmin = (
  id: number,
  name: string,
  overrides: Partial<GeneralUpdateAdminDto> = {},
): GeneralUpdateAdminDto => ({
  id,
  name,
  schemaSnapshotId: id,
  createdAt: "2026-01-02T00:00:00.000Z",
  updatedAt: "2026-01-02T00:00:00.000Z",
  useManualCohort: false,
  priority: 0,
  schema: {},
  tags: [],
  ...overrides,
});
