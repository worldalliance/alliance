import { Button as BaseUIButton } from "@base-ui/react/button";
import { ButtonVariant, buttonVariants } from "./Button";
import { cn } from "./cn";

/** The variants of the shared button this one replaced, kept for its callers. */
export enum BaseButtonVariant {
  RedOutline = "redOutline",
  Blue = "blue",
  BlueOutline = "blueOutline",
  White = "white",
  Black = "black",
}

const VARIANT: Record<BaseButtonVariant, ButtonVariant> = {
  [BaseButtonVariant.RedOutline]: ButtonVariant.DangerOutline,
  [BaseButtonVariant.Blue]: ButtonVariant.Primary,
  [BaseButtonVariant.BlueOutline]: ButtonVariant.AccentOutline,
  [BaseButtonVariant.White]: ButtonVariant.Default,
  [BaseButtonVariant.Black]: ButtonVariant.Primary,
};

export type BaseButtonProps = BaseUIButton.Props & {
  variant?: BaseButtonVariant;
};

export default function BaseButton({
  className,
  variant = BaseButtonVariant.White,
  ...props
}: BaseButtonProps) {
  return (
    <BaseUIButton
      className={cn(
        "inline-flex",
        buttonVariants({ variant: VARIANT[variant], size: "medium" }),
        className,
      )}
      {...props}
    />
  );
}
