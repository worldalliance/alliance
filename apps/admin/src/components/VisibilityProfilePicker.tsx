import type { FormSchema } from "@alliance/common/forms/form-schema";
import {
  type Condition,
  isDraftValidatorId,
} from "@alliance/common/forms/visible-if-formula";
import { withCount } from "@alliance/common/plural";
import { Check, X } from "lucide-react";
import { useConditionFieldLookup } from "../lib/useConditionFieldLookup";
import { useCustomValidatorAdmin } from "../lib/useCustomValidatorAdmin";
import { useCustomValidatorTypesAdmin } from "../lib/useCustomValidatorTypesAdmin";
import { useTagsAdmin } from "../lib/useTagsAdmin";
import { useVisibilityProfilesAdmin } from "../lib/useVisibilityProfilesAdmin";
import {
  type ConditionFieldLookup,
  describeCondition,
} from "../lib/visibilitySummary";
import {
  CardLink,
  CardLinks,
  SelectableCard,
  SelectableCardGroup,
} from "./SelectableCards";

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
      : (saved.idArgument ?? saved.expression);
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

export function VisibilityProfilePicker({
  schema,
  userIds,
  ...choice
}: {
  schema: FormSchema;
  userIds: readonly number[];
} & ProfileChoice) {
  const {
    conditions,
    userIds: askedIds,
    data: profiles,
    isLoading,
    error,
  } = useVisibilityProfilesAdmin({ schema, userIds });
  const fieldOf = useConditionFieldLookup(schema);
  if (conditions.length === 0 || askedIds.length === 0) return null;
  if (isLoading) {
    return (
      <p className="text-sm text-zinc-500">
        Grouping members by what they see…
      </p>
    );
  }
  if (error) return <p className="text-sm text-red-600">{error.message}</p>;
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
      <span className="text-zinc-600">All see the same version</span>
    ) : (
      conditions.map(
        (condition, index) =>
          varies[index] && (
            <span
              key={JSON.stringify(condition)}
              className="flex items-start gap-1 text-zinc-600"
            >
              {profile.results[index] ? (
                <Check
                  className="mt-0.5 size-3 shrink-0 text-green"
                  aria-label="Holds"
                />
              ) : (
                <X
                  className="mt-0.5 size-3 shrink-0 text-red-600"
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
      {hrefFor ? (
        <CardLinks label={label}>
          {profiles.map((profile) => (
            <CardLink
              key={profile.results.join(",")}
              to={hrefFor(profile.userIds[0])}
              title={withCount(profile.userIds.length, "member")}
            >
              {cardBody(profile)}
            </CardLink>
          ))}
        </CardLinks>
      ) : (
        <SelectableCardGroup label={label}>
          {profiles.map((profile) => (
            <SelectableCard
              key={profile.results.join(",")}
              selected={
                choice.selectedUserId !== null &&
                profile.userIds.includes(choice.selectedUserId)
              }
              onSelect={() => choice.onSelect(profile.userIds[0])}
              title={withCount(profile.userIds.length, "member")}
            >
              {cardBody(profile)}
            </SelectableCard>
          ))}
        </SelectableCardGroup>
      )}
      {unsavedValidators && (
        <p className="text-xs text-yellow-700">
          Save the form to group members by its new validators; until then they
          fail for everyone.
        </p>
      )}
    </div>
  );
}
