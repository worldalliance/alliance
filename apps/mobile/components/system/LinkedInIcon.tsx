import {
  LINKEDIN_BLUE,
  linkedInIconPath,
  linkedInIconViewBox,
} from "@alliance/shared/icons/linkedInIcon";
import Svg, { Path, type SvgProps } from "react-native-svg";

interface LinkedInIconProps extends SvgProps {
  size?: number;
}

/** LinkedIn's official "in-bug" logo, in the official brand blue. */
const LinkedInIcon = ({ size = 24, ...props }: LinkedInIconProps) => (
  <Svg width={size} height={size} viewBox={linkedInIconViewBox} {...props}>
    <Path d={linkedInIconPath} fill={LINKEDIN_BLUE} />
  </Svg>
);

export default LinkedInIcon;
