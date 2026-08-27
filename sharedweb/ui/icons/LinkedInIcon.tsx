import {
  LINKEDIN_BLUE,
  linkedInIconPath,
  linkedInIconViewBox,
} from "@alliance/shared/icons/linkedInIcon";

const sizeClass = {
  mini: "w-2.5 h-2.5",
  small: "w-3 h-3",
  medium: "w-4 h-4",
  large: "w-5 h-5",
};

/**
 * LinkedIn's official "in-bug" logo.
 *
 * Renders in the official brand blue by default; pass `monochrome` to
 * inherit the surrounding text color instead.
 */
const LinkedInIcon = ({
  size = "small",
  monochrome = false,
}: {
  size?: keyof typeof sizeClass;
  monochrome?: boolean;
}) => {
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
