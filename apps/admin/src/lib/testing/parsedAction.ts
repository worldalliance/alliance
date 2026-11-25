import { makeAction } from "@alliance/shared/lib/testFixtures";
import type { ParsedActionDto } from "@alliance/shared/parsed-dtos";

/** An admin action as the editor receives it, with no image, cohort or schedule. */
export const makeParsedAction = (
  overrides: Partial<ParsedActionDto> = {},
): ParsedActionDto => ({
  ...makeAction({ id: overrides.id ?? 7 }),
  slug: "seven",
  followUpForms: [],
  staffPreview: false,
  prerequisiteActionIds: [],
  memberActionStart: null,
  memberActionDeadline: null,
  storedImage: null,
  storedSquareThumbnailImage: null,
  cohortExpression: null,
  ...overrides,
});
