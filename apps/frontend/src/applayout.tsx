import {
  ActionActivityDto,
  ActionDto,
  actionsFindAllLoggedIn,
  actionsMyActivity,
  forumFindAllPosts,
  PostDto,
  ProfileDto,
  UserActionRelation,
  userMyProfile,
} from "@alliance/shared/client";
import { isStaging } from "@alliance/shared/lib/config";
import { Features } from "@alliance/shared/lib/features";
import { useEffect, useState } from "react";
import {
  href,
  Outlet,
  useLoaderData,
  useNavigate,
  useNavigation,
  useRouteLoaderData,
} from "react-router";
import BugReportButton from "./components/BugReportButton";
import Spinner from "./components/Spinner";
import { useAuth } from "./lib/AuthContext";
import { isFeatureEnabled } from "./lib/config";

export interface RouteMatch {
  data: unknown;
  id: string;
}

export interface RouteMatches {
  matches: RouteMatch[];
}

export type ActionWithRelation = ActionDto & {
  relation?: UserActionRelation;
};

export interface LoaderData {
  actionData: Promise<ActionLoaderData | null>;
  posts: Promise<PostDto[] | null>;
  profile: Promise<ProfileDto | null>;
}

export interface ActionLoaderData {
  actions: ActionWithRelation[] | null;
  relations: Map<number, UserActionRelation> | null;
  activities: Map<number, ActivitiesForAction> | null;
}

export interface ActivitiesForAction {
  join: ActionActivityDto | null;
  completion: ActionActivityDto | null;
}

export interface AppLayoutOutletContext {
  actions: ActionWithRelation[] | null;
  relations: Map<number, UserActionRelation> | null;
  activities: Map<number, ActivitiesForAction> | null;
  posts: PostDto[] | null;
  profile: ProfileDto | null;
  loading: boolean;
}

const revalidateKey = "revalidate";

export function clientLoader() {
  localStorage.setItem(revalidateKey, "false");

  const result: Promise<ActionLoaderData | null> = Promise.all([
    actionsFindAllLoggedIn({ query: { sorted: true } }),
    actionsMyActivity(),
  ]).then(([actions, activities]) => {
    if (!activities.data || !actions.data) {
      return {
        actions: actions.data ?? null,
        relations: null,
        activities: null,
      } satisfies ActionLoaderData;
    }

    const activityList = activities.data;
    const actionToRelationMap = new Map<number, UserActionRelation>();

    if (activities.data) {
      for (const action of actions.data) {
        actionToRelationMap.set(action.id, "none");
      }
    }
    const completionActivities = activityList.filter(
      (activity) => activity.type === "user_completed"
    );
    const joinActivities = activityList.filter(
      (activity) => activity.type === "user_joined"
    );
    const declineActivities = activityList.filter(
      (activity) =>
        activity.type === "user_declined" ||
        activity.type === "user_wont_complete"
    );

    joinActivities.forEach((activity) => {
      actionToRelationMap.set(activity.actionId, "joined");
    });

    declineActivities.forEach((activity) => {
      actionToRelationMap.set(activity.actionId, "declined");
    });

    completionActivities.forEach((activity) => {
      actionToRelationMap.set(activity.actionId, "completed");
    });

    const activitiesForAction = new Map<number, ActivitiesForAction>();
    activityList.forEach((activity) => {
      if (!activitiesForAction.has(activity.actionId)) {
        activitiesForAction.set(activity.actionId, {
          join: null,
          completion: null,
        });
      }
      if (activity.type === "user_joined") {
        activitiesForAction.get(activity.actionId)!.join = activity;
      } else if (activity.type === "user_completed") {
        activitiesForAction.get(activity.actionId)!.completion = activity;
      }
    });

    // for most users draft actions will be filtered out on server. extra filter just makes admin users not see extra actions
    const actionsWithRelation = actions.data
      ?.filter((action) => action.status !== "draft")
      .map((action) => ({
        ...action,
        relation: actionToRelationMap.get(action.id),
      }));

    return {
      actions: actionsWithRelation,
      relations: actionToRelationMap,
      activities: activitiesForAction,
      loading: false,
    };
  });

  const posts = forumFindAllPosts().then((response) => response.data ?? null);

  const profile = userMyProfile().then((response) => response.data ?? null);

  return {
    actionData: result,
    posts,
    profile,
  } satisfies LoaderData;
}

export function useAppLoaderData(): LoaderData {
  const data = useRouteLoaderData<typeof clientLoader>("applayout");
  if (!data) {
    throw new Error("No data - applayout loader not found");
  }
  return data;
}

export function HydrateFallback() {
  return (
    <div className="flex h-screen w-screen items-center justify-center">
      <Spinner size="large" />
    </div>
  );
}

// const authOnlyRoutes = [
//   "/tasks",
//   "/settings",
//   "/profile",
//   "/onboarding",
//   "/members",
// ];

export function isAuthOnly() {
  if (window.location.pathname.includes("/actions/")) {
    return false;
  }
  return true;
}
export default function AppLayout() {
  const { isAuthenticated, loading: authLoading, logout } = useAuth();

  const {
    actionData: actionDataLoader,
    posts: postsLoader,
    profile: profileLoader,
  } = useLoaderData<typeof clientLoader>();

  const [actions, setActions] = useState<ActionWithRelation[] | null>(null);
  const [relations, setRelations] = useState<Map<
    number,
    UserActionRelation
  > | null>(null);
  const [activities, setActivities] = useState<Map<
    number,
    ActivitiesForAction
  > | null>(null);
  const [posts, setPosts] = useState<PostDto[] | null>(null);
  const [profile, setProfile] = useState<ProfileDto | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    actionDataLoader
      .then((data) => {
        if (data?.actions) {
          setActions(data.actions);
        }
        if (data?.relations) {
          setRelations(data.relations);
        }
        if (data?.activities) {
          setActivities(data.activities);
        }
      })
      .finally(() => {
        setLoading(false);
      });

    postsLoader.then((data) => {
      if (data) {
        setPosts(
          data.sort(
            (a, b) =>
              new Date(b.lastComment?.createdAt ?? b.updatedAt).getTime() -
              new Date(a.lastComment?.createdAt ?? a.updatedAt).getTime()
          )
        );
      }
    });

    profileLoader.then((data) => {
      if (data) {
        setProfile(data);
      }
    });
  }, [actionDataLoader, postsLoader, profileLoader]);

  const navigate = useNavigate();
  const navigation = useNavigation();

  const isNavigating = Boolean(navigation.location);

  useEffect(() => {
    if (isAuthenticated) {
      localStorage.setItem("was-logged-in", "true");
    }

    const wasLoggedIn = localStorage.getItem("was-logged-in") === "true";

    const handleUnauthorized = () => {
      if (
        !window.location.pathname.includes("/login") &&
        !isNavigating &&
        (isAuthOnly() || wasLoggedIn)
      ) {
        console.log("unauthorized, logging out");
        logout();
        navigate(`${href("/login")}?redirect=${window.location.pathname}`);
      }
    };

    window.addEventListener("auth:unauthorized", handleUnauthorized);
    // authMe();
    return () => {
      window.removeEventListener("auth:unauthorized", handleUnauthorized);
    };
  }, [isAuthenticated, authLoading, navigate, isNavigating, logout]);

  return (
    <>
      <Outlet
        context={
          {
            actions,
            relations,
            activities,
            posts,
            profile,
            loading,
          } satisfies AppLayoutOutletContext
        }
      />
      {isFeatureEnabled(Features.BugReporting) && <BugReportButton />}
      {isStaging() && (
        <div className="fixed top-0 left-0 right-0 h-6 bg-green z-50 flex flex-row gap-1">
          {[...Array(100)].map((_, index) => (
            <span key={index} className="text-white text-sm !font-mono">
              staging
            </span>
          ))}
        </div>
      )}
    </>
  );
}

export function setRevalidate() {
  localStorage.setItem(revalidateKey, "true");
}
