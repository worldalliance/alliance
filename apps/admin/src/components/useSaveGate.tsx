import type { FormSchema } from "@alliance/common/forms/form-schema";
import {
  collectUnresolvedVariableReferences,
  type UnresolvedVariableReference,
} from "@alliance/common/forms/variable-interpolation";
import { useCallback, useMemo, useState } from "react";
import { countOf } from "../lib/formatNumber";
import { useConfirmOnPage } from "../lib/useConfirmOnPage";
import {
  describeLiveChanges,
  liveFormChanges,
} from "../pages/forms/builder/liveFormChanges";
import type { FormReach } from "../pages/forms/builder/useFormReach";
import ConfirmDialog from "./ConfirmDialog";
import { linkCheckedText } from "./linkCheckedText";
import { useContentConfirm } from "./useContentConfirm";

function describeUnresolvedReferences(
  references: UnresolvedVariableReference[],
): string {
  const lines = references.map(
    ({ name, locations }) => `#{${name}} — in ${locations.join(", ")}`,
  );
  return [
    "These references don't match any formula on this form, so respondents will see them exactly as written:",
    "",
    ...lines,
    "",
    "Save anyway?",
  ].join("\n");
}

/** Who the live-change confirmation says a save reaches. */
function reachLine({ taskLive, responses }: FormReach): string {
  if (taskLive) return "Members can open this task now.";
  if (responses !== null && responses > 0) {
    return `This form has ${countOf(responses, "response")}.`;
  }
  return "This form may have responses.";
}

/**
 * Save, unless `blocked`, which runs `onBlocked` instead. On a live form, or
 * one whose reach couldn't be checked, a save that removes questions or
 * options or changes a question's kind asks first. A schema with unmatched
 * variable references, absolute links to the site or worldalliance text
 * saves only once each dialog is confirmed.
 */
export function useSaveGate({
  schema,
  blocked,
  onBlocked,
  saveForm,
  isSaving,
  live,
}: {
  schema: FormSchema;
  blocked: boolean;
  onBlocked: () => void;
  saveForm: () => Promise<void>;
  isSaving: boolean;
  live: { reach: FormReach; savedSchema: FormSchema };
}) {
  const confirm = useConfirmOnPage();
  const [confirmUnresolvedVariables, setConfirmUnresolvedVariables] =
    useState(false);

  // A dangling `#{name}` renders as written rather than breaking the form, so
  // it is worth a confirmation but not a refusal — an admin renaming a variable
  // would otherwise be unable to save until every reference was updated.
  const unresolvedVariableReferences = useMemo(
    () => collectUnresolvedVariableReferences(schema),
    [schema],
  );

  const { confirmSave, dialog: contentDialog } = useContentConfirm();
  const saveUnlessCancelled = useCallback(async () => {
    if (await confirmSave(schema, linkCheckedText(schema))) await saveForm();
  }, [confirmSave, saveForm, schema]);

  const { reach, savedSchema } = live;
  const confirmLiveChanges = useCallback(async () => {
    if (!reach.live && !reach.failed) return true;
    const changes = liveFormChanges(savedSchema, schema);
    if (changes.length === 0) return true;
    return confirm({
      title: "Save changes that affect answers?",
      message: [
        reachLine(reach),
        ...describeLiveChanges(changes),
        "Responses already in keep the version of the form they answered. Members who open it after this save get the new version.",
      ].join("\n"),
      confirmLabel: "Save changes",
      destructive: true,
    });
  }, [confirm, reach, savedSchema, schema]);

  const handleSaveForm = useCallback(async () => {
    if (blocked) {
      onBlocked();
      return;
    }
    if (!(await confirmLiveChanges())) return;
    if (unresolvedVariableReferences.length > 0) {
      setConfirmUnresolvedVariables(true);
      return;
    }
    await saveUnlessCancelled();
  }, [
    blocked,
    confirmLiveChanges,
    onBlocked,
    saveUnlessCancelled,
    unresolvedVariableReferences,
  ]);

  const dialog = (
    <>
      <ConfirmDialog
        isOpen={confirmUnresolvedVariables}
        title="Save with unmatched formula references?"
        message={describeUnresolvedReferences(unresolvedVariableReferences)}
        isLoading={isSaving}
        onCancel={() => setConfirmUnresolvedVariables(false)}
        onConfirm={() => {
          setConfirmUnresolvedVariables(false);
          void saveUnlessCancelled();
        }}
      />
      {contentDialog}
    </>
  );

  return { handleSaveForm, dialog };
}
