import { ArrowDown, ArrowUp, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { ReadOnlyId } from "../../pages/forms/builder/kit/ReadOnlyId";
import Button, { ButtonVariant } from "../../ui/Button";

/** An item's id and the actions its own settings still offer, closing its Advanced section. */
export function SettingsActions({
  idLabel,
  id,
  children,
}: {
  idLabel: string;
  id: string | undefined;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 border-t border-line pt-5">
      {id && <ReadOnlyId label={idLabel} value={id} />}
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

export function SettingsAction({
  Icon,
  onClick,
  destructive = false,
  disabled = false,
  children,
}: {
  Icon: LucideIcon;
  onClick: () => void;
  destructive?: boolean;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <Button
      variant={
        destructive ? ButtonVariant.DangerOutline : ButtonVariant.Default
      }
      size="small"
      onClick={onClick}
      disabled={disabled}
    >
      <Icon aria-hidden="true" className="size-4" />
      {children}
    </Button>
  );
}

/**
 * A move button that stays focusable while unavailable, so a keyboard user
 * who moves an item to its list's edge keeps their place.
 */
export function SettingsIconAction({
  label,
  Icon,
  onClick,
  disabled = false,
}: {
  label: string;
  Icon: LucideIcon;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <Button
      variant={ButtonVariant.Ghost}
      size="small"
      aria-label={label}
      aria-disabled={disabled}
      title={label}
      onClick={disabled ? () => {} : onClick}
      className="aria-disabled:cursor-not-allowed aria-disabled:opacity-50"
    >
      <Icon aria-hidden="true" className="size-4" />
    </Button>
  );
}

export function SettingsMoveActions({
  noun,
  onMoveUp,
  onMoveDown,
}: {
  noun?: string;
  onMoveUp: (() => void) | null;
  onMoveDown: (() => void) | null;
}) {
  const label = noun ? `Move ${noun}` : "Move";
  return (
    <>
      <SettingsIconAction
        label={`${label} up`}
        Icon={ArrowUp}
        disabled={!onMoveUp}
        onClick={() => onMoveUp?.()}
      />
      <SettingsIconAction
        label={`${label} down`}
        Icon={ArrowDown}
        disabled={!onMoveDown}
        onClick={() => onMoveDown?.()}
      />
    </>
  );
}
