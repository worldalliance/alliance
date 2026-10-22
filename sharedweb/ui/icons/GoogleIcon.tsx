import {
  googleIconPaths,
  googleIconViewBox,
} from "@alliance/shared/icons/googleIcon";
import { cn } from "@alliance/shared/styles/util";
import type { SVGProps } from "react";

interface GoogleIconProps extends SVGProps<SVGSVGElement> {
  size?: string | number;
}

const GoogleIcon = ({ size = 18, className, ...props }: GoogleIconProps) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    viewBox={googleIconViewBox}
    className={cn("shrink-0", className)}
    aria-hidden
    {...props}
  >
    {googleIconPaths.map((path) => (
      <path key={path.fill} fill={path.fill} d={path.d} />
    ))}
  </svg>
);

export default GoogleIcon;
