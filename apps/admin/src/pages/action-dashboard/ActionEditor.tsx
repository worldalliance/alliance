import type { ParsedActionDto } from "@alliance/shared/parsed-dtos";
import { getApiUrl } from "@alliance/sharedweb/lib/config";
import React from "react";
import ActionForm from "../../components/ActionForm";
import type { ActionEditorState } from "./useActionEditor";

type ActionFormProps = React.ComponentProps<typeof ActionForm>;

type ActionLookups = Pick<
  ActionFormProps,
  | "availableTags"
  | "tagsLoading"
  | "tagsError"
  | "availableSuites"
  | "suitesLoading"
  | "suitesError"
  | "availableUsers"
  | "usersLoading"
  | "usersError"
  | "activeContractUserIds"
  | "allActions"
  | "allActionsLoading"
  | "allActionsLoadFailed"
>;

type ActionEditorMode =
  | { isNew: true; onCancel: () => void }
  | {
      isNew: false;
      cohortParseFailed: boolean;
      onDelete: () => void;
      checklist: React.ReactNode;
    };

type ActionEditorProps = {
  editor: ActionEditorState;
  lookups: ActionLookups;
  action: ParsedActionDto | null;
  saving: boolean;
  mode: ActionEditorMode;
};

const ActionEditor: React.FC<ActionEditorProps> = ({
  editor,
  lookups,
  action,
  saving,
  mode,
}) => {
  const memberActionStart = action?.memberActionStart
    ? new Date(action.memberActionStart)
    : null;
  const memberActionDeadline = action?.memberActionDeadline
    ? new Date(action.memberActionDeadline)
    : null;

  const formProps = {
    form: editor.form,
    onInputChange: editor.handleInputChange,
    onImageChange: editor.handleImageChange,
    onSubmit: editor.handleSubmit,
    saving,
    imagePreview: editor.imagePreview,
    imageError: editor.imageError,
    imageUploading: editor.imageUploading,
    onCancelImageUpload: editor.cancelCoverImage,
    ...lookups,
    onboarding: editor.form.onboarding ?? false,
    cohortExpression: editor.cohortExpression,
    onCohortExpressionChange: editor.handleCohortExpressionChange,
    onPrerequisitesChange: editor.handlePrerequisitesChange,
    authorIds: editor.form.authorIds ?? [],
    onAuthorsChange: editor.handleAuthorsChange,
    onCategoryChange: editor.handleCategoryChange,
    reviewers: editor.reviewerRows,
    onReviewersChange: editor.setReviewerRows,
    memberActionStart,
    memberActionDeadline,
  } satisfies Omit<ActionFormProps, "isNew">;

  if (mode.isNew) {
    return (
      <div className="p-5">
        <ActionForm {...formProps} isNew={true} onCancel={mode.onCancel} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {mode.checklist}
      {mode.cohortParseFailed && (
        <p className="text-xs text-red-600 mb-2">
          The stored cohort expression could not be parsed and is not shown in
          the cohort editor (details in the console). Saving is disabled so it
          isn&apos;t accidentally deleted — fix the stored data, then refresh
          the page.
        </p>
      )}
      <ActionForm
        {...formProps}
        saveDisabled={mode.cohortParseFailed}
        isNew={false}
        actionId={action?.id}
        onDelete={mode.onDelete}
        baseUrl={getApiUrl()}
      />
    </div>
  );
};

export default ActionEditor;
