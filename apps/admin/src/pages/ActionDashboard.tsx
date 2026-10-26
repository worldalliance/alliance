import { useActionAdmin } from "@alliance/shared/lib/useActionAdmin";
import { useMembers } from "@alliance/shared/lib/useMembers";
import { useTagsAdmin } from "@alliance/shared/lib/useTagsAdmin";
import { cn } from "@alliance/shared/styles/util";
import { useSelectableUsers } from "@alliance/sharedweb/ui/UserSelect";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useNavigate, useParams, useSearchParams } from "react-router";
import { ActionCategoryIcons } from "../components/ActionCategoryIcons";
import ActionCohortDecisionsTab from "../components/ActionCohortDecisionsTab";
import ActionFollowUpFormsTab from "../components/ActionFollowUpFormsTab";
import ActionFormVariantsTab from "../components/ActionFormVariantsTab";
import ActionMergedResponsesTab from "../components/ActionMergedResponsesTab";
import ActionUpdatesTab from "../components/ActionUpdatesTab";
import EventManagementTab from "../components/EventManagementTab";
import { FormBuilder } from "../components/FormBuilder";
import { getSiteUrl } from "../lib/config";
import { useActionSuitesAdmin } from "../lib/useActionSuitesAdmin";
import { useAllActions } from "../lib/useAllActions";
import { useSearchParamTab } from "../lib/useSearchParamTab";
import ActionEditor from "./action-dashboard/ActionEditor";
import ActionOverviewTab from "./action-dashboard/ActionOverviewTab";
import ActionReadinessChecklist from "./action-dashboard/ActionReadinessChecklist";
import { ActionSlugField } from "./action-dashboard/ActionSlugField";
import { useActionCommands } from "./action-dashboard/useActionCommands";
import { useActionEditor } from "./action-dashboard/useActionEditor";
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
    setActionFromDto,
    isCreating,
    isUpdating,
    isRemoving,
  } = admin;
  const cohortParseFailed = cohortExpressionError != null;
  const saving = isCreating || isUpdating;
  const [error, setError] = useState<string | null>(null);
  const { allActions, allActionsLoading, allActionsLoadFailed } =
    useAllActions();
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
  const {
    tags: availableTags,
    isLoading: tagsLoading,
    isLoadingError: tagsError,
  } = useTagsAdmin();
  const {
    suites: {
      data: availableSuites,
      isPending: suitesLoading,
      isLoadingError: suitesError,
    },
  } = useActionSuitesAdmin();
  const {
    users: availableUsers,
    isLoading: usersLoading,
    isLoadingError: usersError,
  } = useSelectableUsers();
  const { data: members } = useMembers();
  const activeContractUserIds = useMemo(
    () =>
      new Set(
        (members ?? []).filter((m) => m.hasActiveContract).map((m) => m.id),
      ),
    [members],
  );
  const lookups = {
    availableTags,
    tagsLoading,
    tagsError,
    availableSuites,
    suitesLoading,
    suitesError,
    availableUsers,
    usersLoading,
    usersError,
    activeContractUserIds,
    allActions,
    allActionsLoading,
    allActionsLoadFailed,
  };

  const reporting = useActionReporting(action, actionId);
  const [incompleteUsersExpanded, setIncompleteUsersExpanded] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedTab, onTabChange] = useSearchParamTab(tabs, "overview");

  const editor = useActionEditor({
    admin,
    actionId,
    isNew,
    cohortParseFailed,
    searchParams,
    setError,
  });
  const loading =
    (!isNew && !actionLoadFailed && (actionPending || !editor.draftSeeded)) ||
    isRemoving;

  const { handleDuplicate, handleArchive, handleDelete } = useActionCommands({
    admin,
    actionId,
    form: editor.form,
    imageKey: editor.imageKey,
    imageUploading: editor.imageUploading,
    setError,
  });

  const handleCancel = useCallback(() => {
    navigate("/actions");
  }, [navigate]);

  const [checklistCollapsed, setChecklistCollapsed] = useState(true);
  const actionExport = useActionExport(actionId);

  const tabData: { key: Tab; label: string }[] = [
    { key: "overview", label: "Status Overview" },
    { key: "details", label: "Action Details" },
    { key: "events", label: "Event Management" },
    { key: "updates", label: "Updates" },
    ...(action
      ? [
          { key: "form" as Tab, label: "Task Form" },
          { key: "form-variants" as Tab, label: "Form Variants" },
        ]
      : []),
    { key: "follow-up-forms", label: "Follow-up Forms" },
    { key: "responses", label: "Responses" },
    ...(action
      ? [{ key: "cohort-decisions" as Tab, label: "Cohort Decisions" }]
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
    <div className="flex flex-col h-full">
      <title>Action Dashboard</title>
      <div className="flex justify-between items-center mb-2">
        <div className="p-5 pb-0 flex flex-row justify-between w-full">
          <div className="flex flex-row gap-x-2 ">
            <div className="flex flex-row gap-x-2 items-center">
              {action?.archived && (
                <span className="px-2 py-1 rounded-sm bg-red-200">
                  Archived
                </span>
              )}
            </div>
            <div className="flex flex-col">
              <h1 className="text-[#111] text-[16pt] font-bold">
                {isNew ? "Create New Action" : `${action?.name}`}
              </h1>
              {action && (
                <ActionSlugField
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
          <button
            onClick={handleCancel}
            className="px-3 py-1 text-sm text-gray-600 hover:text-gray-800 text-nowrap mr-5"
          >
            ← Back
          </button>
        </div>
      </div>
      <p className="p-2 border border-gray-200 mb-4 mx-5">
        Please see{" "}
        <a
          className="text-green underline"
          href="https://docs.google.com/document/d/1vxeA31milcWRhpkGjGWHp1RQbpDFRjS541E9SzdKkFc/edit?usp=sharing"
          target="_blank"
          rel="noreferrer"
        >
          Action copy guidelines
        </a>
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
                  onClick={() => onTabChange(tab.key)}
                  className={cn(
                    "py-2 px-1 border-b-2 text-sm text-nowrap",
                    activeTab === tab.key
                      ? "border-blue-500 text-blue-600"
                      : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300",
                  )}
                >
                  {tab.label}
                </button>
              ))}
              <a
                href={getSiteUrl() + `/actions/${action?.id}`}
                target="_blank"
                rel="noreferrer"
                className="py-2 px-1 border-b-2 font-medium text-sm text-nowrap border-transparent text-blue-500 hover:text-blue-600 hover:border-blue-300"
              >
                View Action Page →
              </a>
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
                onDuplicate={handleDuplicate}
                onArchive={handleArchive}
                onTabChange={onTabChange}
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
                  onDelete: handleDelete,
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
                formId={action.taskFormId}
                setFormId={editor.setTaskFormId}
                actionName={action.name}
              />
            )}

            {activeTab === "form-variants" && action && (
              <ActionFormVariantsTab
                action={action}
                activeContractUserIds={activeContractUserIds}
                sources={{
                  availableTags,
                  tagsLoading,
                  tagsError,
                  availableActions: allActions,
                  actionsLoading: allActionsLoading,
                  actionsError: allActionsLoadFailed,
                  availableUsers,
                  usersLoading,
                  usersError,
                }}
              />
            )}

            {activeTab === "events" && action && (
              <EventManagementTab
                action={action}
                setAction={setActionFromDto}
              />
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
