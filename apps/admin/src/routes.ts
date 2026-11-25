import { type RouteConfig, layout, route } from "@react-router/dev/routes";
import { LEGACY_ROUTES } from "./legacyRoutes";
import { FORUM_POST_PATH } from "./places";

export default [
  layout("adminlayout.tsx", [
    route("/growth/invites/feed", "pages/InviteFeedPage.tsx"),
    route(
      "/research/preview/:batchId",
      "pages/research/TranscriptPreviewPage.tsx",
    ),
    layout("shell/ShellLayout.tsx", [
      route("/", "pages/home/HomePage.tsx"),

      // One layout for both, so the list stays mounted while threads open and close.
      layout("pages/inbox/InboxPage.tsx", [
        route("/inbox", "pages/inbox/NoThreadOpen.tsx"),
        route("/inbox/:threadId", "pages/inbox/ThreadPage.tsx"),
      ]),

      route("/tasks", "places/TasksPlace.tsx"),
      route("/tasks/:actionId", "pages/ActionDashboard.tsx"),
      route("/tasks/:actionId/updates/:updateId", "pages/ActionUpdatePage.tsx"),
      route("/tasks/suites", "places/SuitesPlace.tsx"),
      route("/tasks/suites/new", "pages/NewActionSuitePage.tsx"),
      route("/tasks/suites/:suiteId", "places/SuiteRecord.tsx"),
      route("/tasks/projects", "pages/ProjectsPage.tsx"),
      route("/tasks/projects/:projectId", "pages/ProjectDetailPage.tsx"),
      route(
        "/tasks/projects/:projectId/tasks/:actionId",
        "pages/ProjectActionPage.tsx",
      ),
      route("/tasks/forms", "pages/FormsList.tsx"),
      route("/tasks/forms/:formId", "places/FormRecord.tsx"),
      route("/tasks/formulas", "pages/FormulasPage.tsx"),
      route("/tasks/formulas/:formulaId", "pages/FormulaPage.tsx"),
      route("/tasks/contracts", "pages/ContractsPage.tsx"),
      route("/tasks/contracts/:id", "pages/ContractPage.tsx"),

      route("/members", "pages/people/PeoplePage.tsx"),
      route("/members/:userId", "pages/people/MemberPage.tsx"),
      route("/members/welcome", "pages/welcome/WelcomeQueuePage.tsx"),
      route("/members/groups", "pages/groups/GroupsPage.tsx"),
      route("/members/groups/:id", "pages/groups/GroupPage.tsx"),
      route("/members/clusters", "pages/clusters/ClustersPage.tsx"),
      route("/members/tags", "pages/tags/TagsPage.tsx"),
      route("/members/lists", "pages/lists/MemberListsPage.tsx"),
      route("/members/lists/:listId", "pages/lists/MemberListPage.tsx"),
      route("/members/friends", "pages/friends/FriendGraphPage.tsx"),

      route("/growth/invites", "places/InvitesPlace.tsx"),
      route("/growth/waitlist", "places/WaitlistPlace.tsx"),
      route("/growth/links", "places/LinksPlace.tsx"),
      route("/growth/organizations", "pages/OrganizationsPage.tsx"),
      route("/growth/partnerships", "pages/OutreachPartnershipsPage.tsx"),
      route("/growth/ambassadors", "pages/AmbassadorProgramPage.tsx"),

      route("/content/project-updates", "pages/ActionUpdatesPage.tsx"),
      route(
        "/content/general-updates",
        "pages/general-updates/GeneralUpdatesPage.tsx",
      ),
      route(
        "/content/general-updates/:id",
        "pages/general-updates/GeneralUpdatePage.tsx",
      ),
      route(FORUM_POST_PATH, "pages/PostsManagement.tsx"),
      route("/content/media", "pages/media/MediaPage.tsx"),
      route("/content/media/videos/:videoId", "pages/media/VideoPage.tsx"),

      route("/activity", "pages/event-log/EventLogPage.tsx"),
      route("/activity/scheduled", "pages/scheduled/ScheduledJobsPage.tsx"),

      route("/research", "pages/research/KoraParticipantsPage.tsx"),
      route(
        "/research/assignments/:assignmentId",
        "pages/research/AssignmentPage.tsx",
      ),

      route("/settings", "pages/settings/SettingsPage.tsx"),
    ]),
    ...LEGACY_ROUTES.map((legacy) =>
      route(legacy.from, "shell/LegacyRedirect.tsx", {
        id: `legacy:${legacy.from}`,
      }),
    ),
  ]),
  layout("loggedoutonly.tsx", [route("/login", "pages/LoginPage.tsx")]),
] satisfies RouteConfig;
