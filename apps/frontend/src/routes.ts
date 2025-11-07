import {
  type RouteConfig,
  index,
  layout,
  prefix,
  route,
} from "@react-router/dev/routes";

export default [
  route("/", "pages/static/PrelaunchLanding.tsx"),
  route("/people", "pages/static/PeoplePage.tsx"),
  route("/guide", "pages/static/GuidePage.tsx"),
  route("/invite", "pages/static/InvitePage.tsx"),
  route("/privacypolicy", "pages/static/PrivacyPolicyPage.tsx"),
  route("/terms", "pages/static/TermsPage.tsx"),
  route("/error", "TestError.tsx"),
  route("/progress", "pages/static/ProgressListPage.tsx"),
  route("/progress/:slug", "pages/static/ProgressPostPage.tsx"),

  route("/memberquotes", "pages/static/oneoff/MemberQuotesPage.tsx"),

  layout("applayout.tsx", [
    layout("navbar.tsx", [
      ...prefix("/actions", [
        route("/", "pages/app/ActionsListPage.tsx"),
        route("/28", "pages/app/SorryPage.tsx"),
        route(":id", "pages/app/ActionPage.tsx", [
          layout("components/ActionContents.tsx", [
            index("components/ActionPageTaskPanel.tsx"),
          ]),
          route("activity/:activityId", "components/ActionActivityDetail.tsx"),
        ]),
      ]),
      route("/issues/:id", "pages/app/IssuePage.tsx"),
      route("/profile", "pages/app/ProfileRedirect.tsx"),
      route("/feed", "pages/app/ActivityFeedPage.tsx"),
      route("/user/:id", "pages/app/UserProfilePage.tsx"),
      route("/verifyEmail", "pages/app/VerifyEmailPage.tsx"),

      route("forum", "pages/app/ForumPage.tsx"),
      route("forum/post/:id", "pages/app/PostDetailPage.tsx"),
      route("forum/edit/:postId", "pages/app/PostFormPage.tsx"),

      route("/tasks", "pages/app/HomePage.tsx"),
      route("/community", "pages/app/CommunityPage.tsx"),
      route("/notifications", "pages/app/NotificationsPage.tsx"),
      route("/search", "pages/app/SearchPage.tsx"),
      route("/settings", "pages/app/SettingsPage.tsx"),
      route("/contract", "pages/app/ContractPage.tsx"),
      route("/commit", "pages/app/CommitActionPage.tsx"),
      route("/priorities", "pages/app/PrioritiesPage.tsx"),
      route("/members", "pages/app/MembersListPage.tsx"),
    ]),
  ]),
  layout("loggedoutonly.tsx", [
    route("/login", "pages/app/LoginPage.tsx"),
    route("/signup", "pages/app/SignupPage.tsx"),
    route("/resetpassword", "pages/app/ResetPasswordPage.tsx"),
  ]),
] satisfies RouteConfig;
