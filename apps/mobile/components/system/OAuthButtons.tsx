import { OAUTH_PROVIDER_LABEL, OAuthProvider } from "@alliance/common/oauth";
import * as AppleAuthentication from "expo-apple-authentication";
import { Platform, View } from "react-native";
import AppleIcon from "./AppleIcon";
import Button, { ButtonColor } from "./Button";
import GoogleIcon from "./GoogleIcon";
import Text, { FontWeight } from "./Text";

export enum OAuthButtonVerb {
  Continue = "continue",
  SignUp = "sign_up",
}

const VERB: Record<
  OAuthButtonVerb,
  { label: string; apple: AppleAuthentication.AppleAuthenticationButtonType }
> = {
  [OAuthButtonVerb.Continue]: {
    label: "Continue with",
    apple: AppleAuthentication.AppleAuthenticationButtonType.CONTINUE,
  },
  [OAuthButtonVerb.SignUp]: {
    label: "Sign up with",
    apple: AppleAuthentication.AppleAuthenticationButtonType.SIGN_UP,
  },
};

const ICON: Record<OAuthProvider, () => React.JSX.Element> = {
  [OAuthProvider.Google]: () => <GoogleIcon />,
  [OAuthProvider.Apple]: () => <AppleIcon />,
};

interface OAuthButtonsProps {
  onPress: (provider: OAuthProvider) => void;
  verb?: OAuthButtonVerb;
  /** The provider whose sign-in is in flight; the others wait. */
  busy: OAuthProvider | null;
  disabled?: boolean;
}

const OAuthButtons = ({
  onPress,
  verb = OAuthButtonVerb.Continue,
  busy,
  disabled = false,
}: OAuthButtonsProps) => (
  <View className="gap-y-3">
    {Object.values(OAuthProvider).map((provider) => {
      const Icon = ICON[provider];
      const off = disabled || (busy !== null && busy !== provider);
      // Apple's own button on iOS, where review looks for it.
      if (provider === OAuthProvider.Apple && Platform.OS === "ios") {
        return (
          <View
            key={provider}
            pointerEvents={off || busy === provider ? "none" : "auto"}
            className={off ? "opacity-50" : undefined}
          >
            <AppleAuthentication.AppleAuthenticationButton
              buttonType={VERB[verb].apple}
              buttonStyle={
                AppleAuthentication.AppleAuthenticationButtonStyle.WHITE_OUTLINE
              }
              cornerRadius={6}
              style={{ width: "100%", height: 52 }}
              onPress={() => onPress(provider)}
            />
          </View>
        );
      }
      return (
        <Button
          key={provider}
          onPress={() => onPress(provider)}
          color={ButtonColor.White}
          loading={busy === provider}
          disabled={off}
          className="rounded-md w-full self-center py-4!"
        >
          <View className="flex-row items-center gap-x-3">
            <Icon />
            <Text
              className="text-base text-zinc-700"
              weight={FontWeight.Medium}
            >
              {VERB[verb].label} {OAUTH_PROVIDER_LABEL[provider]}
            </Text>
          </View>
        </Button>
      );
    })}
  </View>
);

export default OAuthButtons;
