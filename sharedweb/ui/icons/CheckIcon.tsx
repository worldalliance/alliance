import {
  checkIconCircle,
  checkIconPath,
  checkIconViewBox,
} from "@alliance/shared/icons/checkIcon";
import { cn } from "@alliance/shared/styles/util";
import { forwardRef, type SVGProps } from "react";

interface CheckIconProps extends Omit<SVGProps<SVGSVGElement>, "ref"> {
  size?: string | number;
  absoluteStrokeWidth?: boolean;
}

const CheckIcon = forwardRef<SVGSVGElement, CheckIconProps>(
  ({ size = 24, className, absoluteStrokeWidth: _asw, ...props }, ref) => (
    <svg
      ref={ref}
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox={checkIconViewBox}
      className={cn("shrink-0 text-green", className)}
      aria-label="Done"
      {...props}
    >
      <circle {...checkIconCircle} fill="currentColor" />
      <path d={checkIconPath} fill="#fff" />
    </svg>
  ),
);
CheckIcon.displayName = "CheckIcon";

export default CheckIcon;
