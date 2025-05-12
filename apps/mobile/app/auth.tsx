import { useEffect, useState } from "react";
import { View, Text, Button, StyleSheet } from "react-native";
import * as WebBrowser from "expo-web-browser";
import { setItemAsync, getItemAsync, deleteItemAsync } from "expo-secure-store";
import { create } from "zustand";
import { SignInResponseDto, UserDto } from "./client";

const clientId = "{{ clientId  GUID }}";
const scheme = "my.app";
const scopes = ["openid", "offline_access", "profile", "email"];

// --------------------------------------------------
// --------------------------------------------------

const AUTH_STORAGE_KEY = "refreshToken";
const storeRefreshToken = async (token: string) =>
  setItemAsync(AUTH_STORAGE_KEY, token);
const deleteRefreshToken = async () => deleteItemAsync(AUTH_STORAGE_KEY);
const fetchRefreshToken = async () => getItemAsync(AUTH_STORAGE_KEY);

// TODO: don't store this in the expo-secure-store
const AUTH_STORAGE_KEY_ACCESS_TOKEN = "accessToken";
const storeAccessToken = async (token: string) =>
  setItemAsync(AUTH_STORAGE_KEY_ACCESS_TOKEN, token);
const deleteAccessToken = async () =>
  deleteItemAsync(AUTH_STORAGE_KEY_ACCESS_TOKEN);
const fetchAccessToken = async () =>
  getItemAsync(AUTH_STORAGE_KEY_ACCESS_TOKEN);

// --------------------------------------------------
// Global Store
// --------------------------------------------------

interface StoreConfig {
  user: null | UserDto;
  authError: null | string;
  logout: () => void;
  setAuthError: (authError: string | null) => void;
  setTokenResponse: (responseToken: SignInResponseDto) => void;
  maybeRefreshToken: () => Promise<void>;
}

const useUserStore = create<StoreConfig>((set, get) => ({
  user: null,
  discovery: null,
  authError: null,
  setAuthError: (authError: string | null) => set({ authError }),

  logout: async () => {
    try {
      set({ user: null, authError: null });
      deleteRefreshToken();

      // // IF YOUR PROVIDER SUPPORTS A `revocationEndpoint` (which Azure AD does not):
      // const token = await fetchRefreshToken()
      // const discovery = get().discovery || await fetchDiscoveryAsync(endpoint)
      // await token ? revokeAsync({ token, clientId }, discovery) : undefined
    } catch (err: any) {
      set({ authError: "LOGOUT: " + (err.message || "something went wrong") });
    }
  },

  setTokenResponse: (responseToken: SignInResponseDto) => {
    // cache the token for next time

    const { access_token, refresh_token } = responseToken;

    refresh_token && storeRefreshToken(refresh_token);
    access_token && storeAccessToken(access_token);
  },

  maybeRefreshToken: async () => {
    const refreshToken = await fetchRefreshToken();
    if (!refreshToken) return; // nothing to do
    const accessToken = await fetchAccessToken();
    const discovery = get().discovery || (await fetchDiscoveryAsync(endpoint));
    get().setTokenResponse(
      await refreshAsync({ clientId, refreshToken }, discovery!)
    );
  },
}));

fetchDiscoveryAsync(endpoint).then((discovery) =>
  useUserStore.setState({ discovery })
);

// --------------------------------------------------
// --------------------------------------------------

WebBrowser.maybeCompleteAuthSession();

export default function Login() {
  const {
    user,
    authError,
    setAuthError,
    setTokenResponse,
    maybeRefreshToken,
    logout,
  } = useUserStore();
  const [cacheTried, setCacheTried] = useState(false);
  const [codeUsed, setCodeUsed] = useState(false);
  const redirectUri = makeRedirectUri({ scheme });
  const [request, response, promptAsync] = useAuthRequest(
    { clientId, scopes, redirectUri },
    discovery
  );

  useEffect(() => {
    WebBrowser.warmUpAsync();
    setAuthError(null);
    return () => {
      WebBrowser.coolDownAsync();
    };
  }, []);

  useEffect(() => {
    // try to fetch stored creds on load if not already logged (but don't try it
    // more than once)
    if (user || cacheTried) return;
    setCacheTried(true); //
    maybeRefreshToken();
  }, [cacheTried, maybeRefreshToken, user]);

  useEffect(() => {
    if (
      !discovery || // not ready...
      codeUsed // Access tokens are only good for a single use
    )
      return;

    if (response?.type === "error") {
      setAuthError(
        "promptAsync: " + (response.params.error || "something went wrong")
      );
      return;
    }

    if (!discovery || response?.type !== "success") return;
    const code = response.params.code;
    if (!code) return;

    const getToken = async () => {
      let stage = "ACCESS TOKEN";
      try {
        setCodeUsed(true);
        const accessToken = new AccessTokenRequest({
          code,
          clientId,
          redirectUri,
          scopes: ["openid", "offline_access", "profile", "email"],
          extraParams: {
            code_verifier: request?.codeVerifier ? request.codeVerifier : "",
          },
        });
        stage = "EXCHANGE TOKEN";

        setTokenResponse(await exchangeCodeAsync(accessToken, discovery));
      } catch (e: any) {
        setAuthError(stage + ": " + (e.message || "something went wrong"));
      }
    };
    getToken();
  }, [response, discovery, codeUsed]);

  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <View>
          <Button
            disabled={!request || !!user}
            title="Log in"
            onPress={() => {
              setCodeUsed(false);
              promptAsync();
            }}
          />
        </View>

        <Button disabled={!user} title="Log out" onPress={logout} />
        <Button
          disabled={!authError}
          title="Clear"
          onPress={() => setAuthError(null)}
        />
      </View>

      {/* <Text style={[styles.text]}>Cache tried: {cacheTried ? "yes" : "no"}</Text> */}
      {/* <Text style={[styles.text]}>Code exists: {(!!response?.params?.code) ? "yes" : "no"}</Text> */}
      {/* <Text style={[styles.text]}>Code Used: {codeUsed ? "yes" : "no"}</Text> */}
      {/* <Text style={styles.text}>{JSON.stringify(response)}</Text> */}

      {authError ? (
        <>
          <Text style={[styles.heading]}>Auth Error:</Text>
          <Text style={[styles.text, styles.error]}>{authError}</Text>
        </>
      ) : null}
      {/* <Text style={[styles.heading]}>Redirect Uri:</Text>
      <Text style={[styles.text]}>{redirectUri}</Text> */}
      <Text style={[styles.heading]}>Token Data:</Text>
      {user ? (
        <Text style={[styles.text]}>{JSON.stringify(user.decoded)}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
    alignItems: "stretch",
    justifyContent: "flex-start",
    outerWidth: "100%",
    padding: 5,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-evenly",
  },
  heading: {
    padding: 5,
    fontSize: 24,
  },
  text: {
    padding: 5,
    fontSize: 14,
  },
  error: {
    color: "red",
  },
});
