import { type RouteConfig, layout, route } from "@react-router/dev/routes";

export default [
  layout("adminlayout.tsx", [
    layout("sidebar.tsx", [
      route("/", "pages/Actions.tsx"),
      route("/timeline", "pages/NewTimelinePage.tsx"),
      route("/invites", "pages/InvitesPage.tsx"),
      route("/groups", "pages/GroupsPage.tsx"),
      route("/groups/:id", "pages/GroupDetailPage.tsx"),
      route("/actions/:actionId", "pages/ActionDashboard.tsx"),
      route("/scheduled", "pages/ScheduledPlansPage.tsx"),
      route("/suites/:suiteId", "pages/ActionSuitePage.tsx"),
      route("/new-suite", "pages/NewActionSuitePage.tsx"),
      route("/stats", "pages/StatsPage.tsx"),
      route("/forms", "pages/FormsList.tsx"),
      route("/forms/:formId/responses", "pages/FormResponses.tsx"),
      route("/forms/:formId", "pages/FormBuilder.tsx"),
      route("/members/tags", "pages/TagManagement.tsx"),
      route("/member/:userId", "pages/UserDetailView.tsx"),
      route("/date", "pages/DateTest.tsx"),
      route("/test-push", "pages/TestPushNotification.tsx"),
      route("/members", "pages/UsersList.tsx"),
      route("/image", "pages/ImageUpload.tsx"),
      route("/messaging", "pages/MessagingOverview.tsx"),
      route(
        "/messaging/:conversationId",
        "pages/MessagingConversationDetail.tsx"
      ),
      route("/posts/:postId?", "pages/PostsManagement.tsx"),
    ]),
    route("/database", "pages/DatabaseViewer.tsx"),
  ]),
  layout("loggedoutonly.tsx", [route("/login", "pages/LoginPage.tsx")]),
] satisfies RouteConfig;
