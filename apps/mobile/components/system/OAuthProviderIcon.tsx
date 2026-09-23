import { OAuthProvider } from "@alliance/common/oauth";
import {
  appleIconPath,
  appleIconViewBox,
} from "@alliance/shared/icons/appleIcon";
import {
  googleIconPaths,
  googleIconViewBox,
} from "@alliance/shared/icons/googleIcon";
import Svg, { Path } from "react-native-svg";

const SIZE = 18;

const ICON: Record<OAuthProvider, React.ReactNode> = {
  [OAuthProvider.Google]: (
    <Svg width={SIZE} height={SIZE} viewBox={googleIconViewBox}>
      {googleIconPaths.map((path) => (
        <Path key={path.fill} fill={path.fill} d={path.d} />
      ))}
    </Svg>
  ),
  [OAuthProvider.Apple]: (
    <Svg width={SIZE} height={SIZE} viewBox={appleIconViewBox}>
      <Path fill="#000" d={appleIconPath} />
    </Svg>
  ),
};

const OAuthProviderIcon = ({ provider }: { provider: OAuthProvider }) =>
  ICON[provider];

export default OAuthProviderIcon;
