import { DEVICE_VISIBILITY_TARGETS } from "@alliance/common/forms/device";
import { UserValueProperty } from "@alliance/common/forms/user-properties";
import type { Condition } from "@alliance/common/forms/visible-if-formula";
import { useFormOptions } from "@alliance/shared/lib/useFormsAdmin";
import { useFormQuestionFieldsPeek } from "@alliance/shared/lib/useFormSchema";
import { Menu } from "@base-ui/react/menu";
import { Plus } from "lucide-react";
import { useCustomValidatorTypesAdmin } from "../../../../lib/useCustomValidatorTypesAdmin";
import { ButtonVariant, buttonVariants } from "../../../../ui/Button";
import { cn } from "../../../../ui/cn";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
} from "../../../../ui/DropdownMenu";
import { useCustomValidatorDrafts } from "../questions/customValidatorDrafts";
import type { RuleSources } from "./ConditionRule";
import { defaultFieldRule } from "./fieldConditions";
import { crossFormRule } from "./FieldRule";
import { LoadFailure } from "./RetryButton";

type MenuItem = {
  label: string;
  create: (() => Condition) | null;
  /** Why `create` is null. */
  unavailable?: string;
};

export function AddRuleMenu({
  sources,
  onAdd,
}: {
  sources: RuleSources;
  onAdd: (condition: Condition) => void;
}) {
  const {
    options: forms,
    isLoading: formsLoading,
    isError: formsFailed,
    refetch: refetchForms,
  } = useFormOptions();
  const peekFormFields = useFormQuestionFieldsPeek();
  const {
    validators,
    loading: validatorsLoading,
    error: validatorsError,
  } = useCustomValidatorTypesAdmin();
  const { createDraftId, setDraft } = useCustomValidatorDrafts();

  const { earlierControllers, laterControllers, outputBlocks, selfId } =
    sources;
  const firstController = earlierControllers[0] ?? laterControllers[0];
  const firstForm = forms[0];
  const usableValidators = validators.filter((v) => v.usableForVisibility);
  const defaultValidator =
    usableValidators.find((v) => !v.withIdField) ?? usableValidators[0];
  const otherBlock = outputBlocks?.find((block) => block.id !== selfId);

  const items: MenuItem[] = [
    {
      label: "Answer on this form",
      create: firstController
        ? () => defaultFieldRule(firstController, undefined)
        : null,
      unavailable: "There are no questions to check.",
    },
    {
      label: "Answer on another form",
      create: firstForm
        ? () => crossFormRule(firstForm.id, peekFormFields(firstForm.id))
        : null,
      unavailable: formsLoading
        ? "Loading forms…"
        : formsFailed
          ? "Couldn't load forms."
          : "There are no forms.",
    },
    {
      label: "Validator",
      create: defaultValidator
        ? () => {
            const draftId = createDraftId();
            setDraft(draftId, {
              type: defaultValidator.id,
              idArgument: null,
            });
            return {
              kind: "validator",
              validatorId: draftId,
              resultEquals: true,
            };
          }
        : null,
      unavailable: validatorsLoading
        ? "Loading validators…"
        : (validatorsError ?? "No validator can be used for visibility."),
    },
    {
      label: "Device",
      create: () => ({
        kind: "deviceType",
        deviceType: [...DEVICE_VISIBILITY_TARGETS],
      }),
    },
    ...(outputBlocks === undefined
      ? [
          {
            label: "User property",
            create: (): Condition => ({
              kind: "userPropertyHasValue",
              property: UserValueProperty.City,
              hasValue: true,
            }),
          },
          {
            label: "First contract signed",
            create: (): Condition => ({
              kind: "firstContractSigned",
              comparison: "before",
              date: new Date().toISOString(),
            }),
          },
          {
            label: "Completed tasks",
            create: (): Condition => ({
              kind: "completedActionCount",
              atLeast: 1,
            }),
          },
        ]
      : [
          {
            label: "Output block visibility",
            create: otherBlock
              ? (): Condition => ({
                  kind: "outputBlockVisible",
                  outputBlockVisible: otherBlock.id,
                  isVisible: true,
                })
              : null,
            unavailable: "There are no other blocks.",
          },
        ]),
  ];

  return (
    <>
      <DropdownMenu>
        <Menu.Trigger
          className={cn(
            "inline-flex",
            buttonVariants({ variant: ButtonVariant.Default, size: "small" }),
          )}
        >
          <Plus aria-hidden="true" className="size-4" />
          Add rule
        </Menu.Trigger>
        <DropdownMenuContent className="min-w-56">
          {items.map(({ label, create, unavailable }) => (
            <DropdownMenuItem
              key={label}
              label={label}
              disabled={create === null}
              onClick={() => create && onAdd(create())}
              className={cn(
                create === null &&
                  "flex-col items-start data-disabled:opacity-100",
              )}
            >
              {create === null ? (
                <>
                  <span className="opacity-50">{label}</span>
                  {unavailable && (
                    <span className="text-caption text-fg-muted">
                      {unavailable}
                    </span>
                  )}
                </>
              ) : (
                label
              )}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      {formsFailed && (
        <LoadFailure onRetry={refetchForms}>Couldn't load forms.</LoadFailure>
      )}
    </>
  );
}
