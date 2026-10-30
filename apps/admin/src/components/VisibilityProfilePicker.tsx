import type { FormSchema } from "@alliance/common/forms/form-schema";
import type { Condition } from "@alliance/common/forms/visible-if-formula";
import { withCount } from "@alliance/common/plural";
import { Check, ChevronRight, X } from "lucide-react";
import { useConditionFieldLookup } from "../lib/useConditionFieldLookup";
import { useCustomValidatorAdmin } from "../lib/useCustomValidatorAdmin";
import { useCustomValidatorTypesAdmin } from "../lib/useCustomValidatorTypesAdmin";
import { useTagsAdmin } from "../lib/useTagsAdmin";
import { useVisibilityProfilesAdmin } from "../lib/useVisibilityProfilesAdmin";
import {
  type ConditionFieldLookup,
  describeCondition,
} from "../lib/visibilitySummary";
import { SelectableCard, SelectableCardGroup } from "./SelectableCards";

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
  condition.kind === "validator" && condition.validatorId > 0 ? (
    <ValidatorConditionText condition={condition} fieldOf={fieldOf} />
  ) : (
    describeCondition(condition, fieldOf)
  );

export function VisibilityProfilePicker({
  schema,
  userIds,
  selectedUserId,
  onSelect,
  collapsible = false,
}: {
  schema: FormSchema;
  userIds: readonly number[];
  selectedUserId: number | null;
  onSelect: (userId: number) => void;
  /** Starts folded under a heading naming how many variants there are. */
  collapsible?: boolean;
}) {
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
  if (profiles.some(({ results }) => results.length !== conditions.length)) {
    return (
      <p className="text-sm text-red-600">
        The server grouped members by different conditions than this form has.
        Reload the page.
      </p>
    );
  }
  const varies = conditions.map((_, index) =>
    profiles.some(
      ({ results }) => results[index] !== profiles[0].results[index],
    ),
  );
  const unsavedValidators = conditions.some(
    (condition) => condition.kind === "validator" && condition.validatorId < 0,
  );

  const cards = (
    <div className="flex flex-col gap-2">
      <SelectableCardGroup label="Preview as members who see">
        {profiles.map((profile) => (
          <SelectableCard
            key={profile.results.join(",")}
            selected={
              selectedUserId !== null &&
              profile.userIds.includes(selectedUserId)
            }
            onSelect={() => onSelect(profile.userIds[0])}
            title={withCount(profile.userIds.length, "member")}
          >
            {profiles.length === 1 ? (
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
            )}
          </SelectableCard>
        ))}
      </SelectableCardGroup>
      {unsavedValidators && (
        <p className="text-xs text-yellow-700">
          Save the form to group members by its new validators; until then they
          fail for everyone.
        </p>
      )}
    </div>
  );
  return collapsible ? (
    <details className="group">
      <summary className="flex cursor-pointer list-none items-center gap-1 rounded py-1.5 text-sm hover:bg-zinc-100 [&::-webkit-details-marker]:hidden">
        <ChevronRight
          className="size-4 shrink-0 text-zinc-500 transition-transform group-open:rotate-90"
          aria-hidden
        />
        Member variants
        <span className="ml-2 text-xs text-zinc-500">
          {withCount(profiles.length, "variant")}
        </span>
      </summary>
      <div className="mt-2">{cards}</div>
    </details>
  ) : (
    cards
  );
}
