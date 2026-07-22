import {
  LINKEDIN_BLUE,
  linkedInIconPath,
  linkedInIconViewBox,
} from "@alliance/shared/icons/linkedInIcon";
import { DefaultIconProps, sizeClass } from "./icons";

/**
 * LinkedIn's official "in-bug" logo.
 *
 * Renders in the official brand blue by default; pass `monochrome` to
 * inherit the surrounding text color instead.
 */
const LinkedInIcon = ({
  size = "small",
  monochrome = false,
}: Omit<DefaultIconProps, "fill"> & { monochrome?: boolean }) => {
  return (
    <svg
      className={sizeClass[size]}
      fill={monochrome ? "currentColor" : LINKEDIN_BLUE}
      viewBox={linkedInIconViewBox}
    >
      <path d={linkedInIconPath} />
    </svg>
  );
};

export default LinkedInIcon;
