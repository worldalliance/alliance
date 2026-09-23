import { OAuthProvider } from "@alliance/common/oauth";
import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";
import {
  authMe,
  oAuthUnlink,
  type OAuthAccountDto,
  type UserDto,
} from "../client";
import { thrownRefusalMessage } from "./hey-api";

export type SignInMethods = {
  hasPassword: boolean;
  accounts: Record<OAuthProvider, OAuthAccountDto | null>;
};

export function signInMethods(user: UserDto): SignInMethods {
  const accounts = user.oauthAccounts;
  if (!accounts) {
    throw new Error("user carries no oauthAccounts");
  }
  const connected = (provider: OAuthProvider) =>
    accounts.find((account) => account.provider === provider) ?? null;
  return {
    hasPassword: user.hasPassword,
    accounts: {
      [OAuthProvider.Google]: connected(OAuthProvider.Google),
      [OAuthProvider.Apple]: connected(OAuthProvider.Apple),
    },
  };
}

/** The server refuses the same; this only keeps the member from asking. */
export function canDisconnect(
  methods: SignInMethods,
  provider: OAuthProvider,
): boolean {
  return (
    methods.hasPassword ||
    Object.values(OAuthProvider).some(
      (other) => other !== provider && methods.accounts[other] !== null,
    )
  );
}

const signInMethodsQueryKey = () => ["authMe", "signInMethods"] as const;

/**
 * Stores what a link or unlink answered with, then refetches, so the next
 * change waits on the server's own view rather than on a guess.
 */
function settleSignInMethods(
  queryClient: QueryClient,
  user: UserDto | undefined,
): Promise<void> {
  if (user) {
    queryClient.setQueryData(signInMethodsQueryKey(), signInMethods(user));
  }
  return queryClient.invalidateQueries({ queryKey: signInMethodsQueryKey() });
}

export function useSignInMethods() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: signInMethodsQueryKey(),
    queryFn: async () => {
      const response = await authMe();
      if (!response.data) {
        throw response.error;
      }
      return signInMethods(response.data.user);
    },
  });

  const disconnect = useMutation({
    mutationFn: async (provider: OAuthProvider) => {
      const response = await oAuthUnlink({ path: { provider } });
      if (!response.data) {
        throw response.error;
      }
      return response.data.user;
    },
    onSettled: (user) => settleSignInMethods(queryClient, user),
  });

  return {
    /** Null rather than stale once a reload fails. */
    methods: query.isError ? null : (query.data ?? null),
    loadFailed: query.isError && !query.isFetching,
    reload: query.refetch,
    /** Connection controls wait while a change or a reload is unsettled. */
    busy: disconnect.isPending || query.isFetching,
    disconnect: disconnect.mutate,
    disconnectError: disconnect.error
      ? thrownRefusalMessage({
          error: disconnect.error,
          fallback: "Couldn't disconnect. Please try again.",
          sessionExpired: "Your session has expired. Sign in again.",
        })
      : null,
    resetDisconnect: disconnect.reset,
    settle: (user: UserDto | undefined) =>
      settleSignInMethods(queryClient, user),
  };
}
