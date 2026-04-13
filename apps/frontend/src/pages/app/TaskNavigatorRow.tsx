import { Link, href } from "react-router";
import {
  Circle,
  CircleCheck,
  CircleChevronRight,
  ArrowRight,
  Link2,
} from "lucide-react";
import { cn } from "@alliance/shared/styles/util";
import { type ReactNode, useState } from "react";
import type { ActionDto, FollowUpForm } from "@alliance/shared/client";
import type { ActionWithAwayStatus } from "@alliance/shared/lib/actionUtils";

const ICON_SIZE = 16;

function TaskNavigatorRow({
  icon,
  label,
  isActive,
  activeBg = "bg-green/10",
  onClick,
  linkTo,
  indent,
  className,
}: {
  icon: ReactNode;
  label: ReactNode;
  isActive?: boolean;
  activeBg?: string;
  onClick?: () => void;
  linkTo?: string;
  indent?: boolean;
  className?: string;
}) {
  const rowClass = cn(
    "flex items-center gap-x-2 rounded-lg py-1 w-full text-left font-inherit",
    indent ? "pl-8 pr-2" : "px-2",
    isActive ? activeBg : "hover:bg-grey-2",
    className,
  );

  if (linkTo) {
    return (
      <Link to={linkTo} className={rowClass}>
        {icon}
        <span>{label}</span>
        <ArrowRight size={12} className="shrink-0 text-zinc-400" />
      </Link>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={isActive}
      className={cn(
        "border-0 cursor-pointer",
        rowClass,
        !isActive && "bg-transparent",
      )}
    >
      {icon}
      <span
        className={cn(
          isActive ? "text-zinc-900 font-semibold" : "text-zinc-600",
        )}
      >
        {label}
      </span>
    </button>
  );
}

export function TaskNavigatorTodoActionRow({
  action,
  isActive,
  onSelect,
  showOptionalPrefix,
}: {
  action: ActionWithAwayStatus;
  isActive: boolean;
  onSelect: () => void;
  showOptionalPrefix: boolean;
}) {
  return (
    <TaskNavigatorRow
      isActive={isActive}
      activeBg={action.optional ? "bg-sky-100" : "bg-green/10"}
      onClick={onSelect}
      icon={
        <Circle
          size={ICON_SIZE}
          className={cn(
            "shrink-0",
            isActive
              ? action.optional
                ? "text-blue-400"
                : "text-green"
              : "text-zinc-300",
          )}
        />
      }
      label={
        <>
          {showOptionalPrefix && action.optional && "(Optional) "}
          {action.name}
        </>
      }
    />
  );
}

export function TaskNavigatorFollowUpRows({
  forms,
  activeFollowUpFormId,
  onSelectFollowUp,
}: {
  forms: FollowUpForm[];
  activeFollowUpFormId: number | null;
  onSelectFollowUp: (formId: number) => void;
}) {
  return forms.map((followUpForm) => {
    const isActive = activeFollowUpFormId === followUpForm.id;
    return (
      <TaskNavigatorRow
        key={followUpForm.id}
        isActive={isActive}
        activeBg="bg-sky-100"
        onClick={() => onSelectFollowUp(followUpForm.id)}
        indent
        icon={
          <CircleChevronRight
            size={ICON_SIZE}
            className="shrink-0 text-blue-400"
            aria-hidden
          />
        }
        label={followUpForm.name?.trim() ? followUpForm.name : "Follow-up form"}
      />
    );
  });
}

export function TaskNavigatorCompletedRow({
  action,
  followUpForms,
  activeFollowUpFormId,
  onSelectFollowUp,
}: {
  action: ActionDto;
  followUpForms: FollowUpForm[];
  activeFollowUpFormId: number | null;
  onSelectFollowUp: (formId: number) => void;
}) {
  const [copied, setCopied] = useState(false);

  const handleShare = () => {
    navigator.clipboard.writeText(
      `${window.location.origin}/actions/${action.id}`,
    );
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex flex-col gap-y-1">
      <div className="flex items-center gap-x-2 rounded-lg py-1 px-2 w-full hover:bg-grey-2">
        <CircleCheck size={ICON_SIZE} className="shrink-0 text-green" />
        <Link
          to={href("/actions/:id", { id: action.id.toString() })}
          className="text-zinc-400 line-through grow hover:text-zinc-500"
        >
          {action.optional && "(Optional) "}
          {action.name}
        </Link>
        <button
          onClick={handleShare}
          className="shrink-0 flex items-center gap-x-1 text-zinc-400 hover:text-zinc-600"
        >
          <Link2 size={12} />
          <span className="text-xs">{copied ? "Copied to Clipboard!" : "Share"}</span>
        </button>
      </div>
      <TaskNavigatorFollowUpRows
        forms={followUpForms}
        activeFollowUpFormId={activeFollowUpFormId}
        onSelectFollowUp={onSelectFollowUp}
      />
    </div>
  );
}
