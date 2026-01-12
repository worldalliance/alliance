import {
  ActionActivityDto,
  ActionDto,
  actionsDismissAction,
  actionsFindAllLoggedIn,
  actionsMyActivity,
  forumFindAllPosts,
  PostDto,
  ProfileDto,
  userGetAwayRanges,
  userMyProfile,
} from "@alliance/shared/client";
import { isStaging } from "@alliance/sharedweb/lib/config";
import { Features } from "@alliance/shared/lib/features";
import { useCallback, useEffect, useState } from "react";
import {
  href,
  Outlet,
  useLoaderData,
  useNavigate,
  useNavigation,
  useRouteLoaderData,
} from "react-router";
import BugReportButton from "./components/BugReportButton";
import Spinner from "@alliance/sharedweb/ui/Spinner";
import { useAuth } from "./lib/AuthContext";
import { isFeatureEnabled } from "./lib/config";
import {
  ActionWithAwayStatus,
  getAwayStatus,
} from "@alliance/shared/lib/actionUtils";

export interface RouteMatch {
  data: unknown;
  id: string;
}

export interface RouteMatches {
  matches: RouteMatch[];
}

export interface LoaderData {
  actionData: Promise<ActionLoaderData | null>;
  posts: Promise<PostDto[] | null>;
  profile: Promise<ProfileDto | null>;
}

export interface ActionLoaderData {
  actions: ActionDto[] | null;
  loading?: boolean;
}

export interface ActivitiesForAction {
  join: ActionActivityDto | null;
  completion: ActionActivityDto | null;
}

export interface AppLayoutOutletContext {
  actions: ActionWithAwayStatus[] | null;
  posts: PostDto[] | null;
  profile: ProfileDto | null;
  loading: boolean;
  handleDismissAction: (actionId: number) => void;
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
        loading: false,
      } satisfies ActionLoaderData;
    }

    // for most users draft actions will be filtered out on server. extra filter just makes admin users not see extra actions
    const filteredActions = actions.data?.filter(
      (action) => action.status !== "draft"
    );

    return {
      actions: filteredActions,
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
  const {
    isAuthenticated,
    loading: authLoading,
    logout,
    isImpersonation,
  } = useAuth();

  const {
    actionData: actionDataLoader,
    posts: postsLoader,
    profile: profileLoader,
  } = useLoaderData<typeof clientLoader>();

  const [actions, setActions] = useState<ActionWithAwayStatus[] | null>(null);
  const [posts, setPosts] = useState<PostDto[] | null>(null);
  const [profile, setProfile] = useState<ProfileDto | null>(null);
  const [loading, setLoading] = useState(true);

  const handleDismissAction = useCallback(
    async (actionId: number) => {
      const action = actions?.find((a) => a.id === actionId);
      if (!action) {
        return;
      }

      await actionsDismissAction({
        path: { id: action.id },
      });

      setActions(
        (prev) =>
          prev?.map((action) =>
            action.id === actionId
              ? { ...action, shouldParticipate: false }
              : action
          ) ?? null
      );
    },
    [actions, setActions]
  );

  useEffect(() => {
    void (async () => {
      const response = await userGetAwayRanges();
      const awayRanges = response.data ?? [];
      const data = await actionDataLoader;
      if (data?.actions) {
        const now = new Date();
        setActions(
          data.actions.map((action) => ({
            ...action,
            awayStatus: getAwayStatus(action, awayRanges, now),
          }))
        );
      }
    })().finally(() => setLoading(false));

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
            posts,
            profile,
            loading,
            handleDismissAction,
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
      {isImpersonation && (
        <div className="fixed top-0 left-0 right-0 h-6 bg-amber-500 z-50 flex flex-row gap-1">
          {[...Array(100)].map((_, index) => (
            <span key={index} className="text-white text-sm !font-mono">
              impersonation
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
