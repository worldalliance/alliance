import { FlowButtonKind } from "@alliance/shared/forms/flowStyle";
import { cn } from "@alliance/shared/styles/util";
import BaseButton, {
  BaseButtonSize,
  BaseButtonVariant,
  type BaseButtonProps,
} from "@alliance/sharedweb/ui/BaseButton";
import { LoaderCircle } from "lucide-react";

export { FlowButtonKind };

const KINDS: Record<
  FlowButtonKind,
  { variant: BaseButtonVariant; className: string }
> = {
  [FlowButtonKind.Primary]: { variant: BaseButtonVariant.Green, className: "" },
  [FlowButtonKind.Secondary]: {
    variant: BaseButtonVariant.Grey,
    className: "",
  },
  [FlowButtonKind.Inverse]: {
    variant: BaseButtonVariant.White,
    className: "text-zinc-900",
  },
  [FlowButtonKind.Icon]: {
    variant: BaseButtonVariant.Grey,
    className:
      "size-9 shrink-0 rounded-full p-0 bg-zinc-100 hover:bg-zinc-200 !text-zinc-600",
  },
};

/** Every control in the task flow: borderless, with one radius and weight. */
export default function FlowButton({
  kind,
  loading = false,
  disabled,
  className,
  children,
  ...props
}: Omit<BaseButtonProps, "variant" | "size"> & {
  kind: FlowButtonKind;
  loading?: boolean;
}) {
  const { variant, className: kindClassName } = KINDS[kind];
  return (
    <BaseButton
      variant={variant}
      size={BaseButtonSize.Medium}
      className={cn(
        "h-11 rounded-md border-transparent text-base font-medium",
        kindClassName,
        loading && "disabled:opacity-100",
        className,
      )}
      disabled={disabled || loading}
      aria-busy={loading}
      {...props}
    >
      {loading ? (
        <>
          <LoaderCircle className="size-5 animate-spin" aria-hidden />
          <span className="sr-only">{children}</span>
        </>
      ) : (
        children
      )}
    </BaseButton>
  );
}
