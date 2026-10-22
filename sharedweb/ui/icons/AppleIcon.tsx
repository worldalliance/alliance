import {
  appleIconPath,
  appleIconViewBox,
} from "@alliance/shared/icons/appleIcon";
import { cn } from "@alliance/shared/styles/util";
import type { SVGProps } from "react";

interface AppleIconProps extends SVGProps<SVGSVGElement> {
  size?: string | number;
}

const AppleIcon = ({ size = 18, className, ...props }: AppleIconProps) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    viewBox={appleIconViewBox}
    className={cn("shrink-0", className)}
    aria-hidden
    {...props}
  >
    <path fill="currentColor" d={appleIconPath} />
  </svg>
);

export default AppleIcon;
