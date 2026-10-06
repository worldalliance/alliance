import { DEVICE_VISIBILITY_TARGETS } from "@alliance/common/forms/device";
import { UserValueProperty } from "@alliance/common/forms/user-properties";
import type { Condition } from "@alliance/common/forms/visible-if-formula";
import { useFormOptions } from "@alliance/shared/lib/useFormsAdmin";
import { useFormQuestionFieldsPeek } from "@alliance/shared/lib/useFormSchema";
import {
  DropdownMenuContent,
  DropdownMenuItem,
} from "@alliance/sharedweb/ui/DropdownMenu";
import { Menu } from "@base-ui/react/menu";
import { Plus } from "lucide-react";
import { useCustomValidators } from "../CommonControls";
import { useCustomValidatorDrafts } from "../customValidatorDrafts";
import type { RuleSources } from "./ConditionRule";
import { defaultFieldRule } from "./fieldConditions";
import { crossFormRule } from "./FieldRule";
import { RetryButton } from "./RetryButton";

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
  } = useCustomValidators();
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
      unavailable: "no questions to check",
    },
    {
      label: "Answer on another form",
      create: firstForm
        ? () => crossFormRule(firstForm.id, peekFormFields(firstForm.id))
        : null,
      unavailable: formsLoading
        ? "loading forms…"
        : formsFailed
          ? "could not load forms"
          : "no forms",
    },
    {
      label: "Validator",
      create: defaultValidator
        ? () => {
            const draftId = createDraftId();
            setDraft(draftId, {
              type: defaultValidator.id,
              idArgument: null,
              expression: null,
            });
            return {
              kind: "validator",
              validatorId: draftId,
              resultEquals: true,
            };
          }
        : null,
      unavailable: validatorsLoading
        ? "loading validators…"
        : (validatorsError ?? "none available"),
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
            label: "Completed actions",
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
            unavailable: "no other blocks",
          },
        ]),
  ];

  return (
    <>
      <Menu.Root>
        <Menu.Trigger className="inline-flex items-center gap-1 rounded border border-gray-300 px-2 py-1 text-xs text-gray-700 hover:bg-gray-100">
          <Plus size={12} aria-hidden />
          Add rule
        </Menu.Trigger>
        <DropdownMenuContent className="min-w-48">
          {items.map(({ label, create, unavailable }) => (
            <DropdownMenuItem
              key={label}
              className="text-xs"
              disabled={create === null}
              onClick={() => create && onAdd(create())}
            >
              {label}
              {create === null && unavailable && (
                <span className="text-gray-400">({unavailable})</span>
              )}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </Menu.Root>
      {formsFailed && (
        <span className="inline-flex items-center gap-1 text-[11px] text-red-600">
          Could not load forms
          <RetryButton onClick={refetchForms} />
        </span>
      )}
    </>
  );
}
