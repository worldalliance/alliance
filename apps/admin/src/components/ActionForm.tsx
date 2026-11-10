import type {
  CohortExpression,
  ReferencedAction,
} from "@alliance/common/cohort-expression";
import { ActionSuiteDto, TagDto } from "@alliance/shared/client";
import type { UserSelectUser } from "@alliance/sharedweb/ui/UserSelect";
import UserSelect from "@alliance/sharedweb/ui/UserSelect";
import React, { useMemo } from "react";
import {
  ActionFieldSection,
  actionFieldDefs,
  type ActionFieldDef,
} from "../lib/actionFieldDefs";
import ActionFormFields, { type ActionFieldInputs } from "./ActionFormFields";
import ActionReviewersEditor, {
  type ReviewerRow,
} from "./ActionReviewersEditor";
import CohortExpressionBuilder from "./CohortExpressionBuilder";
import CohortExpressionText from "./CohortExpressionText";
import FormSection, { CollapsibleFormSection } from "./FormSection";
import OpenReferenceWarning from "./OpenReferenceWarning";
import PrerequisitePicker from "./PrerequisitePicker";

const COLLAPSIBLE_TITLES: Record<ActionFieldSection, string | null> = {
  [ActionFieldSection.Content]: null,
  [ActionFieldSection.Settings]: null,
  [ActionFieldSection.Audience]: "Audience",
  [ActionFieldSection.Completion]: "Completion",
  [ActionFieldSection.Forum]: "Forum participation",
  [ActionFieldSection.CustomStat]: "Custom stat",
};

interface ActionFormProps extends ActionFieldInputs {
  onSubmit: (e: React.FormEvent) => void;
  saving: boolean;
  saveDisabled?: boolean;
  onCancel?: () => void;
  onDelete?: () => void;
  availableTags?: TagDto[];
  tagsLoading: boolean;
  tagsError: boolean;
  availableSuites?: ActionSuiteDto[];
  suitesLoading: boolean;
  suitesError: boolean;
  availableUsers?: UserSelectUser[];
  usersLoading: boolean;
  usersError: boolean;
  activeContractUserIds?: Set<number>;
  onboarding?: boolean;
  cohortExpression: CohortExpression | null | undefined;
  onCohortExpressionChange: (expr: CohortExpression | null) => void;
  onPrerequisitesChange: (ids: number[]) => void;
  authorIds: number[];
  onAuthorsChange: (ids: number[]) => void;
  reviewers: ReviewerRow[];
  onReviewersChange: (reviewers: ReviewerRow[]) => void;
  actionId?: number;
  allActions?: (ReferencedAction & { name: string; usersCompleted: number })[];
  allActionsLoading?: boolean;
  allActionsLoadFailed: boolean;
  memberActionStart: Date | null;
  memberActionDeadline: Date | null;
  hideStaffPreview?: boolean;
  splitId?: number | null;
}

const ActionForm: React.FC<ActionFormProps> = ({
  form,
  onInputChange,
  onImageChange,
  onSubmit,
  saving,
  saveDisabled = false,
  imagePreview,
  imageError = null,
  imageUploading = false,
  onCancelImageUpload,
  isNew,
  onCancel,
  //   onDelete,
  baseUrl,
  availableTags = [],
  tagsLoading,
  tagsError,
  availableSuites = [],
  suitesLoading = false,
  suitesError,
  availableUsers = [],
  usersLoading,
  usersError,
  activeContractUserIds,
  onboarding = false,
  cohortExpression,
  onCohortExpressionChange,
  onPrerequisitesChange,
  authorIds,
  onAuthorsChange,
  onCategoryChange,
  reviewers,
  onReviewersChange,
  actionId,
  allActions = [],
  allActionsLoading = false,
  allActionsLoadFailed,
  memberActionStart,
  memberActionDeadline,
  hideStaffPreview = false,
  splitId = null,
}) => {
  const fieldDefs = useMemo(
    () =>
      actionFieldDefs({
        suites: availableSuites,
        loading: suitesLoading,
        failed: suitesError,
      }),
    [availableSuites, suitesLoading, suitesError],
  );

  const getFieldsBySection = (section: ActionFieldSection) =>
    fieldDefs
      .filter((f) => f.section === section)
      .filter((f) => (f.show ? f.show(form) : true))
      .filter((f) => !(hideStaffPreview && f.name === "staffPreview"))
      .filter((f) => !(splitId !== null && f.name === "optional"));

  const fieldInputs = {
    form,
    onInputChange,
    onImageChange,
    imagePreview,
    imageError,
    imageUploading,
    onCancelImageUpload,
    isNew,
    baseUrl,
    onCategoryChange,
  };

  const contentFields = getFieldsBySection(ActionFieldSection.Content);
  const settingsFields = getFieldsBySection(ActionFieldSection.Settings);
  const inUse = (fields: ActionFieldDef[]) =>
    fields.some((f) => (f.isSet ? f.isSet(form) : !!form[f.name]));

  return (
    <form onSubmit={onSubmit} className="space-y-6 pb-6">
      {/* CONTENT SECTION */}
      <FormSection title="Content">
        <div className="space-y-4">
          <ActionFormFields fields={contentFields} {...fieldInputs} />
          {/* Authors in content section */}
          <UserSelect
            users={availableUsers}
            selectedUserIds={authorIds}
            onChange={onAuthorsChange}
            loading={usersLoading}
            loadFailed={usersError}
            label="Action Authors"
          />
          <ActionReviewersEditor
            reviewers={reviewers}
            onReviewersChange={onReviewersChange}
          />
        </div>
      </FormSection>

      {/* SETTINGS SECTION */}
      <FormSection title="Settings">
        <div className="space-y-4">
          <div>
            <p className="text-sm font-medium text-gray-700">Priority</p>
            <a
              href="/priority"
              className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              Manage priority
            </a>
          </div>
          <ActionFormFields fields={settingsFields} {...fieldInputs} />
        </div>
      </FormSection>

      {Object.values(ActionFieldSection).map((section) => {
        const title = COLLAPSIBLE_TITLES[section];
        if (title === null) return null;
        const fields = getFieldsBySection(section);
        return (
          <CollapsibleFormSection
            key={section}
            title={title}
            inUse={inUse(fields)}
          >
            <div className="space-y-4">
              <ActionFormFields fields={fields} {...fieldInputs} />
            </div>
          </CollapsibleFormSection>
        );
      })}

      <FormSection
        title="Prerequisites"
        description="Each member waits until every prerequisite resolves for them (they complete or withdraw, it excludes them, or its deadline passes) before the conditions below decide whether they participate."
      >
        <PrerequisitePicker
          value={form.prerequisiteActionIds ?? []}
          onChange={onPrerequisitesChange}
          availableActions={allActions}
          actionId={actionId}
          loading={allActionsLoading}
        />
      </FormSection>

      {/* TARGETING SECTION */}
      <FormSection
        title="Participating users"
        description="Define which users should participate in this action using conditions and operators."
      >
        {splitId === null ? (
          <CohortExpressionBuilder
            value={cohortExpression}
            onChange={onCohortExpressionChange}
            availableTags={availableTags}
            tagsLoading={tagsLoading}
            tagsError={tagsError}
            availableActions={allActions}
            actionsLoading={allActionsLoading}
            actionsError={allActionsLoadFailed}
            availableUsers={availableUsers}
            usersLoading={usersLoading}
            usersError={usersError}
            activeContractUserIds={activeContractUserIds}
            onboarding={onboarding}
          />
        ) : (
          <div className="space-y-2 text-sm">
            <p>
              <CohortExpressionText
                expression={cohortExpression ?? null}
                tags={availableTags}
                actions={allActions}
              />
            </p>
            <p className="text-zinc-600">
              This action is an arm of a split, which sets who participates and
              whether it&apos;s optional. Change them in the split on the{" "}
              <a
                href={`/suites/${form.suiteId}`}
                className="text-blue-600 underline"
              >
                suite page
              </a>
              .
            </p>
          </div>
        )}
        <OpenReferenceWarning
          actionId={actionId}
          expression={cohortExpression}
          prerequisiteActionIds={form.prerequisiteActionIds ?? []}
          memberActionStart={memberActionStart}
          memberActionDeadline={memberActionDeadline}
          actions={allActions}
        />
      </FormSection>

      {/* ACTION BUTTONS */}
      <div className="flex justify-end gap-3 pt-2">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 text-sm font-medium"
            disabled={saving}
          >
            Cancel
          </button>
        )}
        {/* {!isNew && onDelete && (
          <button
            type="button"
            onClick={onDelete}
            className="px-4 py-2 bg-red-100 text-red-700 border border-red-300 rounded-md hover:bg-red-200 text-sm font-medium"
            disabled={saving}
          >
            Delete
          </button>
        )} */}
        <button
          type="submit"
          className="px-4 py-2 mr-3 bg-green text-white rounded-md hover:scale-102 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-green focus:ring-offset-2 text-sm font-medium disabled:opacity-50 disabled:hover:scale-100"
          disabled={saving || saveDisabled || imageUploading}
        >
          {imageUploading
            ? "Uploading image..."
            : saving
              ? isNew
                ? "Creating..."
                : "Saving..."
              : isNew
                ? "Create Action"
                : "Save Changes"}
        </button>
      </div>
    </form>
  );
};

export default ActionForm;
