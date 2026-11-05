import { applyDecorators, ConflictException } from "@nestjs/common";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsString, Matches, MaxLength } from "class-validator";
import { isUniqueViolation } from "src/utils/db-errors";
import { SLUG_MAX_LENGTH, SLUG_PATTERN } from "src/utils/slug";
import { Column, Index } from "typeorm";

/** Entities whose inserts {@link SlugSubscriber} fills a missing slug for. */
export const SLUGGED_ENTITIES = new Set<unknown>();

const slugApiOptions = {
  maxLength: SLUG_MAX_LENGTH,
  pattern: SLUG_PATTERN.source,
  description: "Stable, human-readable identifier for tooling",
};

const slugValidators = () => [
  IsString(),
  MaxLength(SLUG_MAX_LENGTH),
  Matches(SLUG_PATTERN, {
    message: "slug must be lowercase letters and digits joined by hyphens",
  }),
];

/** A slug unique among the table's live rows, generated from `name` on insert when absent. */
export function SlugColumn(indexName: string) {
  return applyDecorators(
    (target: object) => {
      SLUGGED_ENTITIES.add(target.constructor);
    },
    Index(indexName, { unique: true, where: '"deletedAt" IS NULL' }),
    Column({ type: "varchar", length: SLUG_MAX_LENGTH }),
    ApiProperty(slugApiOptions),
    ...slugValidators(),
  );
}

/** A request's slug. Pair with `@ValidateIf(slugGiven)` so null fails validation. */
export function OptionalSlugField() {
  return applyDecorators(
    ApiPropertyOptional(slugApiOptions),
    ...slugValidators(),
  );
}

export const slugGiven = (dto: { slug?: unknown }) => dto.slug !== undefined;

export function throwIfSlugTaken(params: {
  error: unknown;
  indexName: string;
  slug: string | undefined;
}): void {
  if (isUniqueViolation(params.error, params.indexName)) {
    throw new ConflictException(
      `The slug "${params.slug ?? ""}" is already taken`,
    );
  }
}
