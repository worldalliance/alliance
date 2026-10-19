import type { KindSettingsDto } from "@alliance/shared/client";
import {
  cellStatus,
  CHANNEL_LABEL,
  choiceOf,
  kindChannelLabel,
  kindSummary,
  OVERRIDE_CHOICE_LABEL,
  OVERRIDE_CHOICE_VALUE,
  OVERRIDE_CHOICES,
  REQUIRED_KIND_NOTE,
  RESET_KIND,
} from "@alliance/shared/lib/notificationSettings";
import type { SettingsControls } from "@alliance/shared/lib/useNotificationSettings";
import { cn } from "@alliance/shared/styles/util";
import Button, { ButtonColor } from "@alliance/sharedweb/ui/Button";
import { ChevronDown, Lock } from "lucide-react";
import { useState } from "react";
import SaveState from "./SaveState";

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
              {REQUIRED_KIND_NOTE}
            </p>
          )}
          {kind.cells.map((cell) => {
            const target = {
              type: "cell" as const,
              kind: kind.kind,
              channel: cell.channel,
            };
            const selected = choiceOf(shownOverride(kind.kind, cell));
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
                      aria-label={kindChannelLabel(kind, cell.channel)}
                      className="flex"
                    >
                      {OVERRIDE_CHOICES.map((choice, i) => (
                        <Button
                          key={choice}
                          type="button"
                          size="small"
                          color={
                            selected === choice
                              ? ButtonColor.Black
                              : ButtonColor.White
                          }
                          aria-pressed={selected === choice}
                          onClick={() =>
                            selected !== choice &&
                            save([
                              {
                                ...target,
                                value: OVERRIDE_CHOICE_VALUE[choice],
                              },
                            ])
                          }
                          className={cn(
                            i > 0 && "-ml-px rounded-l-none",
                            i < OVERRIDE_CHOICES.length - 1 && "rounded-r-none",
                          )}
                        >
                          {OVERRIDE_CHOICE_LABEL[choice]}
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
              {RESET_KIND}
            </button>
          )}
        </div>
      )}
    </li>
  );
}
