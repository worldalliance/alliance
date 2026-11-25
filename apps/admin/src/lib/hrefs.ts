import { href } from "react-router";
import {
  RECORD_TABS,
  RecordId,
  type RecordTabId,
  TabParam,
  type TabbedRecordId,
} from "../places";

/** The record's first tab is its bare URL, as `tabHref` does for a place. */
const withTab = <R extends TabbedRecordId>(
  record: R,
  path: string,
  tab: RecordTabId<R> | undefined,
): string =>
  tab && tab !== RECORD_TABS[record][0].id
    ? `${path}?${new URLSearchParams({ [TabParam.Tab]: tab })}`
    : path;

export const memberHref = (userId: number) =>
  href("/members/:userId", { userId: userId.toString() });

export const groupHref = (groupId: number, tab?: RecordTabId<RecordId.Group>) =>
  withTab(
    RecordId.Group,
    href("/members/groups/:id", { id: groupId.toString() }),
    tab,
  );

export const memberListHref = (listId: number | "new") =>
  href("/members/lists/:listId", { listId: listId.toString() });

export const taskHref = (actionId: number, tab?: RecordTabId<RecordId.Task>) =>
  withTab(
    RecordId.Task,
    href("/tasks/:actionId", { actionId: actionId.toString() }),
    tab,
  );

export const taskUpdateHref = ({
  actionId,
  updateId,
}: {
  actionId: number;
  updateId: number | "new";
}) =>
  href("/tasks/:actionId/updates/:updateId", {
    actionId: actionId.toString(),
    updateId: updateId.toString(),
  });

export const suiteHref = (
  suiteId: number | "new",
  tab?: RecordTabId<RecordId.Suite>,
) =>
  withTab(
    RecordId.Suite,
    href("/tasks/suites/:suiteId", { suiteId: suiteId.toString() }),
    tab,
  );

export const projectHref = (
  projectId: number,
  tab?: RecordTabId<RecordId.Project>,
) =>
  withTab(
    RecordId.Project,
    href("/tasks/projects/:projectId", { projectId: projectId.toString() }),
    tab,
  );

export const formHref = (formId: number, tab?: RecordTabId<RecordId.Form>) =>
  withTab(
    RecordId.Form,
    href("/tasks/forms/:formId", { formId: formId.toString() }),
    tab,
  );

export const projectTaskHref = ({
  projectId,
  actionId,
  hash,
}: {
  projectId: number;
  actionId: number;
  /** A section of the page, without the "#". */
  hash?: string;
}) =>
  href("/tasks/projects/:projectId/tasks/:actionId", {
    projectId: projectId.toString(),
    actionId: actionId.toString(),
  }) + (hash ? `#${hash}` : "");

export const formulaHref = (formulaId: number | "new") =>
  href("/tasks/formulas/:formulaId", { formulaId: formulaId.toString() });

export const contractHref = (contractId: number | "new") =>
  href("/tasks/contracts/:id", { id: contractId.toString() });

export const inviteFeedHref = href("/growth/invites/feed");

export const threadHref = (threadId: string) =>
  href("/inbox/:threadId", { threadId });

export const generalUpdateHref = (
  id: number | "new",
  tab?: RecordTabId<RecordId.GeneralUpdate>,
) =>
  withTab(
    RecordId.GeneralUpdate,
    href("/content/general-updates/:id", { id: id.toString() }),
    tab,
  );

export const videoHref = (videoId: number) =>
  href("/content/media/videos/:videoId", { videoId: videoId.toString() });

export const koraAssignmentHref = (assignmentId: string) =>
  href("/research/assignments/:assignmentId", { assignmentId });

export const koraTranscriptPreviewHref = (batchId: string) =>
  href("/research/preview/:batchId", { batchId });
