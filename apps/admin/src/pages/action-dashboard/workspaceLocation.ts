import { ActionEditorSection } from "../../lib/staffTestingGate";

export enum WorkspaceTab {
  Overview = "overview",
  Content = "content",
  Communications = "communications",
  Responses = "responses",
}

export enum ContentView {
  TaskForm = "task-form",
  FormVariants = "form-variants",
  FollowUpForms = "follow-up-forms",
}

export enum ResponsesView {
  Responses = "responses",
  CohortDecisions = "cohort-decisions",
}

export enum CommunicationsSection {
  Events = "events",
  Updates = "updates",
}

export const VIEW_PARAM = "view";

type WorkspaceLocation = {
  tab: WorkspaceTab;
  view?: ContentView | ResponsesView;
  hash?: string;
};

/** `?tab=` values from before the tabs merged, still in bookmarks. */
const LEGACY_TABS = new Map<string, WorkspaceLocation>(
  Object.entries({
    details: { tab: WorkspaceTab.Content },
    events: {
      tab: WorkspaceTab.Communications,
      hash: CommunicationsSection.Events,
    },
    updates: {
      tab: WorkspaceTab.Communications,
      hash: CommunicationsSection.Updates,
    },
    form: {
      tab: WorkspaceTab.Content,
      view: ContentView.TaskForm,
      hash: ContentView.TaskForm,
    },
    "form-variants": {
      tab: WorkspaceTab.Content,
      view: ContentView.FormVariants,
      hash: ContentView.FormVariants,
    },
    "follow-up-forms": {
      tab: WorkspaceTab.Content,
      view: ContentView.FollowUpForms,
      hash: ContentView.FollowUpForms,
    },
    "cohort-decisions": {
      tab: WorkspaceTab.Responses,
      view: ResponsesView.CohortDecisions,
    },
  }),
);

const SECTION_LOCATIONS: Record<ActionEditorSection, WorkspaceLocation> = {
  [ActionEditorSection.Details]: {
    tab: WorkspaceTab.Content,
    hash: ActionEditorSection.Details,
  },
  [ActionEditorSection.TaskForm]: {
    tab: WorkspaceTab.Content,
    view: ContentView.TaskForm,
    hash: ActionEditorSection.TaskForm,
  },
  [ActionEditorSection.Release]: {
    tab: WorkspaceTab.Overview,
    hash: ActionEditorSection.Release,
  },
};

/** Points `params` at `tab`, setting `view` or clearing a stale one. */
export function moveToTab(
  params: URLSearchParams,
  { tab, view }: Pick<WorkspaceLocation, "tab" | "view">,
) {
  params.set("tab", tab);
  if (view) params.set(VIEW_PARAM, view);
  else params.delete(VIEW_PARAM);
}

const toSearch = (params: URLSearchParams, location: WorkspaceLocation) => {
  moveToTab(params, location);
  return `?${params.toString()}${location.hash ? `#${location.hash}` : ""}`;
};

export const workspacePath = (
  actionId: number | string,
  location: WorkspaceLocation,
) => `/actions/${actionId}${toSearch(new URLSearchParams(), location)}`;

/**
 * The search and hash with an old `?tab=` value moved to its new tab and view,
 * or null when there is none to move.
 */
export function legacyTabRedirect(location: {
  search: string;
  hash: string;
}): string | null {
  const params = new URLSearchParams(location.search);
  const moved = LEGACY_TABS.get(params.get("tab") ?? "");
  if (!moved) return null;
  return toSearch(params, {
    ...moved,
    hash: moved.hash ?? (location.hash.slice(1) || undefined),
  });
}

export const actionSectionPath = (
  actionId: number | string,
  section: ActionEditorSection,
) => workspacePath(actionId, SECTION_LOCATIONS[section]);

export function projectActionRedirect(params: {
  actionId: string;
  search: string;
  hash: string;
}): string {
  const section = Object.values(ActionEditorSection).find(
    (value) => `#${value}` === params.hash,
  );
  return section
    ? actionSectionPath(params.actionId, section)
    : `/actions/${params.actionId}${params.search}${params.hash}`;
}

export const communicationsPath = (
  actionId: number | string,
  section: CommunicationsSection,
) =>
  workspacePath(actionId, { tab: WorkspaceTab.Communications, hash: section });
