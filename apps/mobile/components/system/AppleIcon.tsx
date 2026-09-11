import {
  appleIconPath,
  appleIconViewBox,
} from "@alliance/shared/icons/appleIcon";
import Svg, { Path } from "react-native-svg";

const AppleIcon = ({ size = 18 }: { size?: number }) => (
  <Svg width={size} height={size} viewBox={appleIconViewBox}>
    <Path fill="#000000" d={appleIconPath} />
  </Svg>
);

export default AppleIcon;
