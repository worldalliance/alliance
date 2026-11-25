import { useActionAdmin } from "@alliance/shared/lib/useActionAdmin";
import { cn } from "@alliance/shared/styles/util";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router";
import { ActionCategoryIcons } from "../components/ActionCategoryIcons";
import ActionCohortDecisionsTab from "../components/ActionCohortDecisionsTab";
import ActionFollowUpFormsTab from "../components/ActionFollowUpFormsTab";
import ActionFormVariantsTab from "../components/ActionFormVariantsTab";
import ActionMergedResponsesTab from "../components/ActionMergedResponsesTab";
import ActionUpdatesTab from "../components/ActionUpdatesTab";
import EventManagementTab from "../components/EventManagementTab";
import { FormBuilder } from "../components/FormBuilder";
import { SlugField } from "../components/SlugField";
import { getSiteUrl } from "../lib/config";
import { useLinkedSelection } from "../lib/linkedSelection";
import { useSearchParamTab } from "../lib/useSearchParamTab";
import ActionEditor from "./action-dashboard/ActionEditor";
import ActionOverviewTab from "./action-dashboard/ActionOverviewTab";
import ActionReadinessChecklist from "./action-dashboard/ActionReadinessChecklist";
import { useActionCommands } from "./action-dashboard/useActionCommands";
import { useActionEditor } from "./action-dashboard/useActionEditor";
import { useActionEditorLookups } from "./action-dashboard/useActionEditorLookups";
import { useActionExport } from "./action-dashboard/useActionExport";
import { useActionReporting } from "./action-dashboard/useActionReporting";

const tabs = [
  "overview",
  "details",
  "events",
  "form",
  "form-variants",
  "updates",
  "follow-up-forms",
  "responses",
  "cohort-decisions",
] as const;
type Tab = (typeof tabs)[number];

const ActionDashboard: React.FC = () => {
  const { actionId: actionIdParam } = useParams<{ actionId: string }>();
  const navigate = useNavigate();
  const isNew = actionIdParam === "new";
  const actionId = isNew ? null : parseInt(actionIdParam!);
  const admin = useActionAdmin(actionId);
  const {
    action,
    cohortExpressionError,
    isPending: actionPending,
    isError: actionLoadFailed,
    addEvent,
    isCreating,
    isUpdating,
  } = admin;
  const cohortParseFailed = cohortExpressionError != null;
  const saving = isCreating || isUpdating;
  const [error, setError] = useState<string | null>(null);
  const lookups = useActionEditorLookups();
  const {
    availableTags,
    tagsLoading,
    tagsError,
    availableUsers,
    usersLoading,
    usersError,
    allActions,
    allActionsLoading,
    allActionsLoadFailed,
  } = lookups;
  const errorMessage =
    error ??
    (actionLoadFailed
      ? "Failed to load action"
      : allActionsLoadFailed
        ? "Failed to load the other actions, so prerequisites and cohort action conditions can't be picked and open-reference warnings are missing"
        : null);
  const errorRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (errorMessage) {
      errorRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [errorMessage]);

  const reporting = useActionReporting(action, actionId);
  const [incompleteUsersExpanded, setIncompleteUsersExpanded] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedTab, onTabChange] = useSearchParamTab(tabs, "overview");
  const tabButtons = useRef(new Map<Tab, HTMLButtonElement>());
  // The overview's own controls unmount with it, so focus moves to the tab.
  const openTabFromOverview = (tab: Tab) => {
    onTabChange(tab);
    tabButtons.current.get(tab)?.focus();
  };

  const editor = useActionEditor({
    admin,
    actionId,
    isNew,
    cohortParseFailed,
    lookups,
    searchParams,
    setError,
  });
  const loading =
    !isNew && !actionLoadFailed && (actionPending || !editor.draftSeeded);

  useLinkedSelection({
    ready: selectedTab === "details" && !loading && !actionLoadFailed,
    searchParams,
    setSearchParams,
    onError: setError,
  });
  const { handleDuplicate, handleArchive } = useActionCommands({
    admin,
    actionId,
    form: editor.form,
    imageKey: editor.imageKey,
    imageUploading: editor.imageUploading,
    setError,
  });

  const handleCancel = useCallback(() => {
    navigate("/tasks?view=list");
  }, [navigate]);

  const [checklistCollapsed, setChecklistCollapsed] = useState(true);
  const actionExport = useActionExport(actionId);

  const tabData: { key: Tab; label: string }[] = [
    { key: "overview", label: "Status overview" },
    { key: "details", label: "Action details" },
    { key: "events", label: "Events" },
    { key: "updates", label: "Updates" },
    ...(action
      ? [
          { key: "form" as Tab, label: "Task form" },
          { key: "form-variants" as Tab, label: "Form variants" },
        ]
      : []),
    { key: "follow-up-forms", label: "Follow-up forms" },
    { key: "responses", label: "Responses" },
    ...(action
      ? [{ key: "cohort-decisions" as Tab, label: "Cohort decisions" }]
      : []),
  ];

  const availableTabs = tabData.map((tab) => tab.key);
  const activeTab = availableTabs.includes(selectedTab)
    ? selectedTab
    : tabData[0].key;

  if (loading) {
    return <div className="p-8">Loading action...</div>;
  }

  return (
    <div className="flex flex-col min-h-full">
      <title>{`${isNew ? "New action" : (action?.name ?? "Action")} - Admin`}</title>
      <div className="flex justify-between items-center mb-2">
        <div className="p-5 pb-0 flex flex-row flex-wrap justify-between gap-y-2 w-full">
          <div className="flex min-w-0 flex-row gap-x-2">
            <div className="flex flex-row gap-x-2 items-center">
              {action?.archived && (
                <span className="px-2 py-1 rounded-sm bg-gray-200 text-gray-700">
                  Archived
                </span>
              )}
            </div>
            <div className="flex flex-col">
              <h1 className="text-[#111] text-[16pt] font-bold">
                {isNew ? "Create new action" : `${action?.name}`}
              </h1>
              {action && (
                <SlugField
                  slug={action.slug}
                  saving={isUpdating}
                  onSave={(slug) => admin.updateAction({ slug })}
                />
              )}
            </div>
            {action && !action.project && (
              <div className="flex items-center">
                <ActionCategoryIcons categories={action.category} />
              </div>
            )}
          </div>
          <div className="mr-5 flex flex-wrap items-start gap-x-4 text-sm text-nowrap">
            {action && (
              <a
                href={getSiteUrl() + `/actions/${action.id}`}
                target="_blank"
                rel="noreferrer"
                className="py-1 text-blue-600 underline"
              >
                View action page
              </a>
            )}
            <Link
              to="/tasks?view=list"
              className="py-1 text-gray-600 hover:text-gray-800"
            >
              ← Back to actions
            </Link>
          </div>
        </div>
      </div>
      <p className="mb-4 mx-5 text-sm text-gray-600">
        Before writing copy, read the{" "}
        <a
          className="text-blue-600 underline"
          href="https://docs.google.com/document/d/1vxeA31milcWRhpkGjGWHp1RQbpDFRjS541E9SzdKkFc/edit?usp=sharing"
          target="_blank"
          rel="noreferrer"
        >
          action copy guidelines
        </a>
        .
      </p>
      {errorMessage && (
        <div
          ref={errorRef}
          role="alert"
          className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4"
        >
          {errorMessage}
        </div>
      )}

      {isNew ? (
        <ActionEditor
          editor={editor}
          lookups={lookups}
          action={action}
          saving={saving}
          mode={{ isNew: true, onCancel: handleCancel }}
        />
      ) : (
        // Existing Action Dashboard
        <div className="space-y-4 flex-1 min-h-0 mx-5">
          {/* Tab Navigation */}
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8 flex-wrap">
              {tabData.map((tab) => (
                <button
                  key={tab.key}
                  ref={(button) => {
                    if (button) tabButtons.current.set(tab.key, button);
                  }}
                  type="button"
                  aria-current={activeTab === tab.key ? "page" : undefined}
                  onClick={() => onTabChange(tab.key)}
                  className={cn(
                    "py-2 px-1 border-b-2 text-sm text-nowrap",
                    activeTab === tab.key
                      ? "border-blue-500 text-blue-600 font-medium"
                      : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300",
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>

          {/* Tab Content */}
          <div className="flex-1 overflow-y-auto">
            {activeTab === "overview" && action && (
              <ActionOverviewTab
                action={action}
                reporting={reporting}
                actionExport={actionExport}
                imageUploading={editor.imageUploading}
                unsaved={editor.dirty}
                onDuplicate={handleDuplicate}
                onArchive={handleArchive}
                onTabChange={openTabFromOverview}
                setSearchParams={setSearchParams}
                incompleteUsersExpanded={incompleteUsersExpanded}
                setIncompleteUsersExpanded={setIncompleteUsersExpanded}
              />
            )}

            {activeTab === "details" && (
              <ActionEditor
                editor={editor}
                lookups={lookups}
                action={action}
                saving={saving}
                mode={{
                  isNew: false,
                  cohortParseFailed,
                  checklist: (
                    <ActionReadinessChecklist
                      action={action}
                      taskForm={reporting.taskForm}
                      collapsed={checklistCollapsed}
                      onCollapsedChange={setChecklistCollapsed}
                    />
                  ),
                }}
              />
            )}
            {activeTab === "form" && action && (
              <FormBuilder
                formId={action.taskFormId ?? undefined}
                setFormId={editor.setTaskFormId}
                actionName={action.name}
                taskFlow
              />
            )}

            {activeTab === "form-variants" && action && (
              <ActionFormVariantsTab action={action} />
            )}

            {activeTab === "events" && action && (
              <EventManagementTab action={action} addEvent={addEvent} />
            )}

            {activeTab === "updates" && action && (
              <ActionUpdatesTab
                actionId={action.id}
                updates={action.updates ?? []}
                events={action.events ?? []}
                availableTags={availableTags}
              />
            )}
            {activeTab === "follow-up-forms" && action && (
              <ActionFollowUpFormsTab
                action={action}
                availableTags={availableTags}
                tagsLoading={tagsLoading}
                tagsError={tagsError}
                availableActions={allActions}
                actionsLoading={allActionsLoading}
                actionsError={allActionsLoadFailed}
                availableUsers={availableUsers}
                usersLoading={usersLoading}
                usersError={usersError}
              />
            )}
            {activeTab === "responses" && action && (
              <ActionMergedResponsesTab
                actionId={action.id}
                paramNamespace="resp"
              />
            )}
            {activeTab === "cohort-decisions" && action && (
              <ActionCohortDecisionsTab actionId={action.id} />
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ActionDashboard;
