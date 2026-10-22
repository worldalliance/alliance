import { cn } from "@alliance/shared/styles/util";
import { ArrowDown, ArrowUp, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

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
    <div className="space-y-3 border-t border-gray-200 pt-4">
      {id && (
        <p className="text-xs text-gray-500">
          {idLabel}{" "}
          <code className="select-all rounded border border-gray-200 bg-gray-50 px-1.5 py-0.5 font-mono text-gray-700">
            {id}
          </code>
        </p>
      )}
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
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50",
        destructive
          ? "border-red-200 text-red-700 hover:bg-red-50"
          : "border-gray-200 text-gray-700 hover:bg-gray-50",
      )}
    >
      <Icon className="h-4 w-4" aria-hidden="true" />
      {children}
    </button>
  );
}

/**
 * An icon button that stays focusable while unavailable, so a keyboard user
 * who moves an element to the page's edge keeps their place.
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
    <button
      type="button"
      onClick={disabled ? undefined : onClick}
      aria-disabled={disabled}
      aria-label={label}
      title={label}
      className="flex h-7 w-7 items-center justify-center rounded-md text-gray-600 hover:bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 aria-disabled:cursor-not-allowed aria-disabled:text-gray-300 aria-disabled:hover:bg-transparent"
    >
      <Icon className="h-4 w-4" aria-hidden="true" />
    </button>
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
