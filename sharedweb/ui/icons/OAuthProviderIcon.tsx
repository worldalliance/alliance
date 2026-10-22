import { OAuthProvider } from "@alliance/common/oauth";
import type { ComponentType } from "react";
import AppleIcon from "./AppleIcon";
import GoogleIcon from "./GoogleIcon";

const ICON: Record<OAuthProvider, ComponentType<{ size?: number }>> = {
  [OAuthProvider.Google]: GoogleIcon,
  [OAuthProvider.Apple]: AppleIcon,
};

const OAuthProviderIcon = ({
  provider,
  size = 18,
}: {
  provider: OAuthProvider;
  size?: number;
}) => {
  const Icon = ICON[provider];
  return <Icon size={size} />;
};

export default OAuthProviderIcon;
