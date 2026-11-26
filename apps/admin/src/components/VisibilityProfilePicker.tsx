import type { FormSchema } from "@alliance/common/forms/form-schema";
import {
  type Condition,
  isDraftValidatorId,
} from "@alliance/common/forms/visible-if-formula";
import { withCount } from "@alliance/common/plural";
import { Check, ExternalLink, X } from "lucide-react";
import { type ReactNode, useId } from "react";
import { Link } from "react-router";
import { useConditionFieldLookup } from "../lib/useConditionFieldLookup";
import { useCustomValidatorAdmin } from "../lib/useCustomValidatorAdmin";
import { useCustomValidatorTypesAdmin } from "../lib/useCustomValidatorTypesAdmin";
import { useTagsAdmin } from "../lib/useTagsAdmin";
import { useVisibilityProfilesAdmin } from "../lib/useVisibilityProfilesAdmin";
import {
  type ConditionFieldLookup,
  describeCondition,
} from "../lib/visibilitySummary";
import { cn } from "../ui/cn";

type ValidatorCondition = Extract<Condition, { kind: "validator" }>;

const ValidatorConditionText = ({
  condition,
  fieldOf,
}: {
  condition: ValidatorCondition;
  fieldOf: ConditionFieldLookup;
}) => {
  const saved = useCustomValidatorAdmin(condition.validatorId).query.data;
  const { validators } = useCustomValidatorTypesAdmin();
  const { tags } = useTagsAdmin({ enabled: saved?.type === "MemberTag" });
  if (!saved) return describeCondition(condition, fieldOf);
  const name =
    validators.find((validator) => validator.id === saved.type)?.name ??
    saved.type;
  const argument =
    saved.type === "MemberTag"
      ? tags.find((tag) => String(tag.id) === saved.idArgument)?.name
      : saved.idArgument;
  return `${name}${argument ? ` (${argument})` : ""} ${condition.resultEquals === false ? "fails" : "passes"}`;
};

const ConditionText = ({
  condition,
  fieldOf,
}: {
  condition: Condition;
  fieldOf: ConditionFieldLookup;
}) =>
  condition.kind === "validator" &&
  !isDraftValidatorId(condition.validatorId) ? (
    <ValidatorConditionText condition={condition} fieldOf={fieldOf} />
  ) : (
    describeCondition(condition, fieldOf)
  );

const cardGrid = "grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3";
const cardClass =
  "flex flex-col gap-1 rounded-card border bg-surface p-3 text-left text-caption";
const CARD_TITLE = "mb-1 block text-body font-medium";

/** Picks a group's member, or links each group to a page about its first member. */
type ProfileChoice =
  | {
      selectedUserId: number | null;
      onSelect: (userId: number) => void;
      hrefFor?: never;
    }
  | {
      hrefFor: (userId: number) => string;
      selectedUserId?: never;
      onSelect?: never;
    };

function CardGroup({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  const labelId = useId();
  return (
    <div className="flex flex-col gap-2">
      <p id={labelId} className="font-medium">
        {label}
      </p>
      <div role="group" aria-labelledby={labelId} className={cardGrid}>
        {children}
      </div>
    </div>
  );
}

export function VisibilityProfilePicker({
  schema,
  userIds,
  empty = null,
  ...choice
}: {
  schema: FormSchema;
  userIds: readonly number[];
  /** Shown when nothing in the form depends on the member, or no member is listed. */
  empty?: ReactNode;
} & ProfileChoice) {
  const groupName = useId();
  const {
    conditions,
    userIds: askedIds,
    data: profiles,
    isLoading,
    error,
  } = useVisibilityProfilesAdmin({ schema, userIds });
  const fieldOf = useConditionFieldLookup(schema);
  if (conditions.length === 0 || askedIds.length === 0) return empty;
  if (isLoading) {
    return <p className="text-fg-muted">Grouping members by what they see…</p>;
  }
  if (error) return <p className="text-danger">{error.message}</p>;
  if (!profiles) return null;
  const varies = conditions.map((_, index) =>
    profiles.some(
      ({ results }) => results[index] !== profiles[0].results[index],
    ),
  );
  const unsavedValidators = conditions.some(
    (condition) =>
      condition.kind === "validator" &&
      isDraftValidatorId(condition.validatorId),
  );

  const label = "Preview as members who see";
  const cardBody = (profile: (typeof profiles)[number]) =>
    profiles.length === 1 ? (
      <span className="text-fg-muted">All see the same version</span>
    ) : (
      conditions.map(
        (condition, index) =>
          varies[index] && (
            <span
              key={JSON.stringify(condition)}
              className="flex items-start gap-1 text-fg-muted"
            >
              {profile.results[index] ? (
                <Check
                  className="mt-0.5 size-3 shrink-0 text-success"
                  aria-label="Holds"
                />
              ) : (
                <X
                  className="mt-0.5 size-3 shrink-0 text-danger"
                  aria-label="Doesn't hold"
                />
              )}
              <ConditionText condition={condition} fieldOf={fieldOf} />
            </span>
          ),
      )
    );
  const { hrefFor } = choice;
  return (
    <div className="flex flex-col gap-2">
      <CardGroup label={label}>
        {profiles.map((profile) => {
          const title = withCount(profile.userIds.length, "member");
          const key = profile.results.join(",");
          if (hrefFor) {
            return (
              <Link
                key={key}
                to={hrefFor(profile.userIds[0])}
                target="_blank"
                rel="noreferrer"
                className={cn(
                  cardClass,
                  "border-line-strong focus-ring hover:bg-surface-2",
                )}
              >
                <span className={cn(CARD_TITLE, "flex items-center gap-1")}>
                  {title}
                  <ExternalLink className="size-3 shrink-0" aria-hidden />
                  <span className="sr-only">(opens in a new tab)</span>
                </span>
                {cardBody(profile)}
              </Link>
            );
          }
          const selected =
            choice.selectedUserId !== null &&
            profile.userIds.includes(choice.selectedUserId);
          return (
            <label
              key={key}
              className={cn(
                cardClass,
                "cursor-pointer border-line-strong hover:bg-surface-2 has-checked:border-accent has-checked:bg-accent-soft has-focus-visible:outline-2 has-focus-visible:outline-accent",
              )}
            >
              <input
                type="radio"
                name={groupName}
                checked={selected}
                onChange={() => choice.onSelect(profile.userIds[0])}
                className="sr-only"
              />
              <span className={CARD_TITLE}>{title}</span>
              {cardBody(profile)}
            </label>
          );
        })}
      </CardGroup>
      {unsavedValidators && (
        <p className="text-caption text-warning">
          Save the form to group members by its new validators; until then they
          fail for everyone.
        </p>
      )}
    </div>
  );
}
