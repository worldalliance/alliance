import {
  type RouteConfig,
  layout,
  prefix,
  route,
} from "@react-router/dev/routes";

export default [
  route("/", "pages/static/PrelaunchLanding.tsx"),
  route("/landing", "pages/static/NewLandingPage.tsx"),
  route("/about", "pages/static/AboutPage.tsx"),

  layout("./applayout.tsx", [
    ...prefix("/actions", [
      route("/", "pages/app/ActionsListPage.tsx"),
      route(":id", "pages/app/ActionPage.tsx"),
    ]),
    ...prefix("/announcements", [
      route("/", "pages/app/AnnouncementListPage.tsx"),
      route(":id", "pages/app/AnnouncementPage.tsx"),
    ]),
    route("/issues", "pages/app/IssuesListPage.tsx"),
    route("/issues/:id", "pages/app/IssuePage.tsx"),
    route("/profile", "pages/app/ProfileRedirect.tsx"),
    route("/editprofile", "pages/app/ProfilePageEdit.tsx"),
    route("/user/:id", "pages/app/UserProfilePage.tsx"),

    route("forum", "pages/app/ForumPage.tsx"),
    route("forum/post/:id", "pages/app/PostDetailPage.tsx"),
    route("forum/edit/:postId", "pages/app/PostFormPage.tsx"),

    layout("./authonly.tsx", [
      route("/home", "pages/app/HomePage.tsx"),
      route("/settings", "pages/app/AccountPage.tsx"),
    ]),
  ]),
  layout("./loggedoutonly.tsx", [
    route("/login", "pages/app/LoginPage.tsx"),
    route("/signup", "pages/app/SignupPage.tsx"),
  ]),
] satisfies RouteConfig;
