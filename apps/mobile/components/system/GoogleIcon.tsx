import {
  googleIconPaths,
  googleIconViewBox,
} from "@alliance/shared/icons/googleIcon";
import Svg, { Path } from "react-native-svg";

const GoogleIcon = ({ size = 18 }: { size?: number }) => (
  <Svg width={size} height={size} viewBox={googleIconViewBox}>
    {googleIconPaths.map((path) => (
      <Path key={path.fill} fill={path.fill} d={path.d} />
    ))}
  </Svg>
);

export default GoogleIcon;
