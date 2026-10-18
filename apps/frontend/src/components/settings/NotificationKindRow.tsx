import type { KindSettingsDto } from "@alliance/shared/client";
import {
  CHANNEL_LABEL,
  cellStatus,
  kindSummary,
} from "@alliance/shared/lib/notificationSettings";
import type { SettingsControls } from "@alliance/shared/lib/useNotificationSettings";
import { cn } from "@alliance/shared/styles/util";
import Button, { ButtonColor } from "@alliance/sharedweb/ui/Button";
import { ChevronDown, Lock } from "lucide-react";
import { useState } from "react";
import SaveState from "./SaveState";

const CHOICES: { label: string; value: boolean | null }[] = [
  { label: "Follow default", value: null },
  { label: "On", value: true },
  { label: "Off", value: false },
];

type Props = SettingsControls & { kind: KindSettingsDto };

export default function NotificationKindRow({
  kind,
  save,
  retry,
  statusOf,
  shownOverride,
  resetOf,
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const reset = resetOf(kind);
  const panelId = `kind-${kind.kind}`;

  return (
    <li>
      <button
        type="button"
        aria-expanded={expanded}
        aria-controls={panelId}
        onClick={() => setExpanded((open) => !open)}
        className="flex w-full items-center justify-between gap-4 py-3 text-left hover:bg-zinc-50"
      >
        <span>
          <span className="block font-medium">{kind.label}</span>
          <span className="block text-sm text-zinc-500">
            {kindSummary(kind)}
          </span>
        </span>
        <ChevronDown
          size={18}
          aria-hidden
          className={cn("shrink-0 text-zinc-400", expanded && "rotate-180")}
        />
      </button>
      {expanded && (
        <div id={panelId} className="flex flex-col gap-y-3 pb-4">
          <blockquote className="whitespace-pre-line rounded-md bg-zinc-100 px-3 py-2 text-sm text-zinc-700">
            {kind.example}
          </blockquote>
          {kind.required && (
            <p className="flex items-center gap-1 text-sm text-zinc-500">
              <Lock size={14} aria-hidden />
              Always follows your defaults
            </p>
          )}
          {kind.cells.map((cell) => {
            const target = {
              type: "cell" as const,
              kind: kind.kind,
              channel: cell.channel,
            };
            const override = shownOverride(kind.kind, cell);
            return (
              <div
                key={cell.channel}
                className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between"
              >
                <div>
                  <span className="font-medium">
                    {CHANNEL_LABEL[cell.channel]}
                  </span>
                  <span className="block text-sm text-zinc-500">
                    {cellStatus(cell)}
                  </span>
                </div>
                {cell.editable && (
                  <div className="flex items-center gap-x-3">
                    <SaveState
                      status={statusOf(target)}
                      onRetry={() => retry(target)}
                    />
                    <div
                      role="group"
                      aria-label={`${kind.label} by ${CHANNEL_LABEL[cell.channel]}`}
                      className="flex"
                    >
                      {CHOICES.map((choice, i) => (
                        <Button
                          key={choice.label}
                          type="button"
                          size="small"
                          color={
                            override === choice.value
                              ? ButtonColor.Black
                              : ButtonColor.White
                          }
                          aria-pressed={override === choice.value}
                          onClick={() =>
                            override !== choice.value &&
                            save([{ ...target, value: choice.value }])
                          }
                          className={cn(
                            i > 0 && "-ml-px rounded-l-none",
                            i < CHOICES.length - 1 && "rounded-r-none",
                          )}
                        >
                          {choice.label}
                        </Button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
          {reset.length > 0 && (
            <button
              type="button"
              onClick={() => save(reset)}
              className="self-start text-sm underline text-zinc-600"
            >
              Reset to defaults
            </button>
          )}
        </div>
      )}
    </li>
  );
}
