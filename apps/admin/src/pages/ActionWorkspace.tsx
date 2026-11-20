import type { ActionStatus } from "@alliance/shared/client";
import { useActionAdmin } from "@alliance/shared/lib/useActionAdmin";
import type { ParsedActionDto } from "@alliance/shared/parsed-dtos";
import { ExternalLink } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Link,
  Navigate,
  useLocation,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router";
import ActionPhasePill from "../components/ActionPhasePill";
import { SlugField } from "../components/SlugField";
import PageShell, { PageWidth } from "../components/ui/PageShell";
import StatusPill, { ActionStatusPill } from "../components/ui/StatusPill";
import Tabs from "../components/ui/Tabs";
import { ActionPhase, actionPhase } from "../lib/actionPhase";
import { getSiteUrl } from "../lib/config";
import { useLinkedSelection } from "../lib/linkedSelection";
import { editorShowsStaffPreview } from "../lib/staffTestingGate";
import { StatusTone } from "../lib/statusTone";
import { useSearchParamTab } from "../lib/useSearchParamTab";
import ActionCommunicationsTab from "./action-dashboard/ActionCommunicationsTab";
import ActionContentTab, {
  CopyGuidelines,
} from "./action-dashboard/ActionContentTab";
import ActionEditor from "./action-dashboard/ActionEditor";
import ActionExportModal from "./action-dashboard/ActionExportModal";
import { actionMenuItems } from "./action-dashboard/actionMenu";
import ActionOverviewTab from "./action-dashboard/ActionOverviewTab";
import ActionResponsesTab from "./action-dashboard/ActionResponsesTab";
import { useActionCommands } from "./action-dashboard/useActionCommands";
import { useActionEditor } from "./action-dashboard/useActionEditor";
import { useActionEditorLookups } from "./action-dashboard/useActionEditorLookups";
import { useActionExport } from "./action-dashboard/useActionExport";
import { useActionReporting } from "./action-dashboard/useActionReporting";
import {
  legacyTabRedirect,
  VIEW_PARAM,
  WorkspaceTab,
} from "./action-dashboard/workspaceLocation";

const TABS = [
  { key: WorkspaceTab.Overview, label: "Overview" },
  { key: WorkspaceTab.Content, label: "Content" },
  { key: WorkspaceTab.Communications, label: "Communications" },
  { key: WorkspaceTab.Responses, label: "Responses" },
];
const TAB_KEYS = TABS.map(({ key }) => key);
const TAB_RESETS = [VIEW_PARAM];

// An open phase names only the member action's progress, so any other status,
// such as an office-only action's Office action, shows beside it.
const PHASE_IMPLIES_STATUS: Record<ActionStatus, boolean> = {
  draft: true,
  member_action: true,
  planned: false,
  office_action: false,
  resolution: false,
  completed: false,
  failed: false,
  abandoned: false,
};

const HeaderLinks = ({
  action,
  slugSaving,
  onSlugSave,
}: {
  action: ParsedActionDto;
  slugSaving: boolean;
  onSlugSave: (slug: string) => Promise<unknown>;
}) => (
  <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
    <SlugField slug={action.slug} saving={slugSaving} onSave={onSlugSave} />
    {action.project && (
      <span>
        Project{" "}
        <Link
          to={`/projects/${action.project.id}`}
          className="text-blue-600 underline"
        >
          {action.project.name}
        </Link>
      </span>
    )}
    {action.suite && (
      <span>
        Suite{" "}
        <Link
          to={`/suites/${action.suite.id}`}
          className="text-blue-600 underline"
        >
          {action.suite.name}
        </Link>
      </span>
    )}
  </div>
);

const ErrorBanner = ({
  message,
  ref,
}: {
  message: string;
  ref: React.Ref<HTMLDivElement>;
}) => (
  <div
    ref={ref}
    role="alert"
    className="rounded-md border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800"
  >
    {message}
  </div>
);

const ActionWorkspace = () => {
  const { actionId: actionIdParam } = useParams<{ actionId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const isNew = actionIdParam === "new";
  const actionId = isNew ? null : parseInt(actionIdParam!);
  const admin = useActionAdmin(actionId);
  const {
    action,
    cohortExpressionError,
    isPending: actionPending,
    isError: actionLoadFailed,
    isCreating,
    isUpdating,
  } = admin;
  const cohortParseFailed = cohortExpressionError != null;
  const saving = isCreating || isUpdating;
  const [error, setError] = useState<string | null>(null);
  const lookups = useActionEditorLookups();
  const errorMessage =
    error ??
    (actionLoadFailed
      ? "Failed to load action"
      : lookups.allActionsLoadFailed
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
  const [tab, , tabHref] = useSearchParamTab(TAB_KEYS, WorkspaceTab.Overview, {
    resets: TAB_RESETS,
  });
  const [taskFormUnsaved, setTaskFormUnsaved] = useState(false);

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
  const unsaved = editor.dirty || taskFormUnsaved;

  useLinkedSelection({
    ready: tab === WorkspaceTab.Content && !loading && !actionLoadFailed,
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
  const actionExport = useActionExport(actionId);

  useEffect(() => {
    if (loading || !location.hash) return;
    document
      .getElementById(location.hash.slice(1))
      ?.scrollIntoView({ block: "start" });
  }, [loading, location.hash, location.search]);

  const tabsRef = useRef<HTMLDivElement>(null);
  const shownTab = useRef(tab);
  useEffect(() => {
    if (shownTab.current === tab) return;
    shownTab.current = tab;
    // A link in the old tab unmounts with it, so focus moves to the new tab,
    // without scrolling away from the section its hash scrolled to.
    if (document.activeElement === document.body) {
      tabsRef.current
        ?.querySelector<HTMLElement>('[aria-current="page"]')
        ?.focus({ preventScroll: location.hash !== "" });
    }
  }, [tab, location.hash]);

  const handleCancel = useCallback(() => navigate("/actions"), [navigate]);

  const legacyRedirect = legacyTabRedirect(location);
  if (legacyRedirect) return <Navigate replace to={legacyRedirect} />;

  if (loading) {
    return (
      <p role="status" className="p-6 text-sm text-zinc-600">
        Loading action…
      </p>
    );
  }

  const back = { to: "/actions", label: "Actions" };
  const errorBanner = errorMessage && (
    <ErrorBanner ref={errorRef} message={errorMessage} />
  );

  if (isNew) {
    return (
      <PageShell
        title="New action"
        back={back}
        description={<CopyGuidelines />}
      >
        <div className="flex flex-col gap-y-4">
          {errorBanner}
          <ActionEditor
            editor={editor}
            lookups={lookups}
            action={null}
            saving={saving}
            mode={{ isNew: true, onCancel: handleCancel }}
          />
        </div>
      </PageShell>
    );
  }

  if (!action) {
    return (
      <PageShell title="Action" back={back}>
        {errorBanner}
      </PageShell>
    );
  }

  const phase = actionPhase(action, new Date());

  return (
    <PageShell
      title={action.name}
      back={back}
      width={PageWidth.Full}
      meta={
        <>
          <ActionPhasePill phase={phase} status={action.status} />
          {phase !== ActionPhase.Closed &&
            !PHASE_IMPLIES_STATUS[action.status] && (
              <ActionStatusPill status={action.status} />
            )}
          {action.archived && (
            <StatusPill tone={StatusTone.Neutral} label="Archived" />
          )}
        </>
      }
      description={
        <HeaderLinks
          action={action}
          slugSaving={isUpdating}
          onSlugSave={(slug) => admin.updateAction({ slug })}
        />
      }
      actions={
        <a
          href={`${getSiteUrl()}/actions/${action.id}`}
          target="_blank"
          rel="noreferrer"
          className="flex h-8 items-center gap-1 rounded-md border border-zinc-200 bg-white px-3 text-sm font-medium text-zinc-700 outline-hidden hover:bg-zinc-50 focus-visible:ring-2 focus-visible:ring-blue-600"
        >
          View action page
          <ExternalLink size={14} aria-hidden />
        </a>
      }
      menu={actionMenuItems({
        archived: action.archived,
        unsaved,
        imageUploading: editor.imageUploading,
        onDuplicate: () => void handleDuplicate(),
        onExport: () => actionExport.setExportActionOpen(true),
        onArchive: () => void handleArchive(),
      })}
    >
      <div className="flex flex-col gap-y-5">
        <div ref={tabsRef}>
          <Tabs label="Action" items={TABS} current={tab} href={tabHref} />
        </div>
        {errorBanner}
        {(() => {
          switch (tab) {
            case WorkspaceTab.Overview:
              return (
                <ActionOverviewTab
                  action={action}
                  phase={phase}
                  reporting={reporting}
                  unsaved={unsaved}
                  saving={isUpdating}
                  onStaffPreviewChange={(staffPreview) =>
                    void editor.setStaffPreview(staffPreview)
                  }
                  responsesHref={tabHref(WorkspaceTab.Responses)}
                  setSearchParams={setSearchParams}
                  incompleteUsersExpanded={incompleteUsersExpanded}
                  setIncompleteUsersExpanded={setIncompleteUsersExpanded}
                />
              );
            case WorkspaceTab.Content:
              return (
                <ActionContentTab
                  action={action}
                  editor={editor}
                  lookups={lookups}
                  saving={saving}
                  cohortParseFailed={cohortParseFailed}
                  showStaffPreview={editorShowsStaffPreview(action, phase)}
                  taskForm={reporting.taskForm}
                  onTaskFormUnsavedChange={setTaskFormUnsaved}
                />
              );
            case WorkspaceTab.Communications:
              return (
                <ActionCommunicationsTab
                  action={action}
                  addEvent={admin.addEvent}
                  availableTags={lookups.availableTags}
                />
              );
            case WorkspaceTab.Responses:
              return <ActionResponsesTab actionId={action.id} />;
            default:
              throw new Error(`unknown tab: ${tab satisfies never}`);
          }
        })()}
      </div>
      <ActionExportModal actionExport={actionExport} />
    </PageShell>
  );
};

export default ActionWorkspace;
