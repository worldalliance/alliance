import {
  STAFF_TEXT_MAX_LENGTH,
  StaffTextConflict,
} from "@alliance/common/staffText";
import {
  minuteStart,
  useClockMinute,
} from "@alliance/shared/lib/useClockMinute";
import { Send, TriangleAlert } from "lucide-react";
import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import TextareaAutosize from "react-textarea-autosize";
import { SegmentedMessage } from "sms-segments-calculator";
import { adminRefusalMessage } from "../../lib/adminRefusal";
import {
  LocalTimeUnknown,
  memberLocalTime,
  QUIET_HOURS_LABEL,
  staffTextConflict,
} from "../../lib/memberTexts";
import { useReportComposing } from "../../lib/useReportComposing";
import Button, { ButtonVariant } from "../../ui/Button";
import { Kbd } from "../../ui/Kbd";
import { ToastVariant, useToast } from "../../ui/ToastProvider";
import { Tooltip, TooltipContent, TooltipTrigger } from "../../ui/Tooltip";
import ComposingNotice from "./ComposingNotice";

const CONFLICT_COPY: Record<
  StaffTextConflict,
  { warning: string; loadFailed: string }
> = {
  [StaffTextConflict.NewerTexts]: {
    warning:
      "New texts arrived while you were writing. Read them above before you send.",
    loadFailed:
      "New texts arrived but couldn't be loaded. Try again in a moment.",
  },
  [StaffTextConflict.NumberChanged]: {
    warning:
      "This member's phone number changed while you were writing. Check the thread above before you send.",
    loadFailed:
      "This member's phone number changed but the thread couldn't be loaded. Try again in a moment.",
  },
};

export default function TextComposer({
  recipientName,
  phoneNumber,
  timeZone,
  newestTextId,
  threadLoadFailed,
  onConflictShown,
  send,
}: {
  recipientName: string;
  /** The thread's number, as its query matches texts by. */
  phoneNumber: string;
  timeZone: string | null;
  /** Read when called, so it sees a refetch that hasn't rendered yet. */
  newestTextId: () => number | null;
  threadLoadFailed: () => boolean;
  onConflictShown: () => void;
  send: (body: string, afterId: number | null) => Promise<unknown>;
}) {
  const [body, setBody] = useState("");
  const seenThrough = useRef<number | null>(null);
  const [conflict, setConflict] = useState<{
    kind: StaffTextConflict;
    confirmedQuietHours: boolean;
  } | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [quietWarning, setQuietWarning] = useState<string | null>(null);
  const [triedBlank, setTriedBlank] = useState(false);
  const inputId = useId();
  const { showToast } = useToast();
  const mounted = useRef(false);
  const textarea = useRef<HTMLTextAreaElement>(null);
  const sendAnyway = useRef<HTMLButtonElement>(null);
  const warning = quietWarning !== null || conflict !== null;
  const now = minuteStart(useClockMinute());
  useReportComposing(phoneNumber, body);

  useLayoutEffect(() => {
    if (warning) sendAnyway.current?.focus();
  }, [warning]);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const localTime = memberLocalTime(timeZone, now);
  const localTimeLabel = localTime.ok
    ? `Their local time: ${localTime.value.label}`
    : UNKNOWN_LOCAL_TIME[localTime.error];
  const segments = body ? new SegmentedMessage(body, "auto") : null;
  const tooLong = body.length > STAFF_TEXT_MAX_LENGTH;
  const blank = body.trim().length === 0;
  const blankShown = triedBlank && blank;
  const describedBy = [
    !warning && `${inputId}-hint`,
    tooLong && `${inputId}-too-long`,
    blankShown && `${inputId}-blank`,
    error && `${inputId}-error`,
  ]
    .filter(Boolean)
    .join(" ");

  const submit = async (params: { confirmedQuietHours: boolean }) => {
    setTriedBlank(blank);
    if (blank || tooLong || pending) return;
    if (localTime.ok && localTime.value.quiet && !params.confirmedQuietHours) {
      setConflict(null);
      setQuietWarning(localTime.value.label);
      return;
    }
    setQuietWarning(null);
    setConflict(null);
    if (warning) textarea.current?.focus();
    setPending(true);
    setError(null);
    const sent = body;
    const afterId = seenThrough.current;
    try {
      await send(sent, afterId);
      setBody((current) => (current === sent ? "" : current));
    } catch (thrown) {
      const kind = staffTextConflict(thrown);
      if (mounted.current && kind !== null) {
        if (threadLoadFailed()) {
          setError(CONFLICT_COPY[kind].loadFailed);
          return;
        }
        seenThrough.current = newestTextId();
        setConflict({
          kind,
          confirmedQuietHours: params.confirmedQuietHours,
        });
        onConflictShown();
        return;
      }
      const message = adminRefusalMessage(
        thrown,
        "The text may not have gone out. Check the thread in a minute before trying again.",
      );
      if (mounted.current) setError(message);
      else
        showToast({
          variant: ToastVariant.Error,
          title: `Problem sending text to ${recipientName}`,
          message: `${message} Your text: "${sent}"`,
          durationMs: null,
        });
    } finally {
      setPending(false);
    }
  };

  return (
    <form
      className="flex flex-col gap-1.5"
      onSubmit={(event) => {
        event.preventDefault();
        void submit({ confirmedQuietHours: false });
      }}
    >
      <div className="flex items-center justify-between gap-3">
        <label
          htmlFor={inputId}
          className="min-w-0 truncate text-caption font-medium text-fg-muted"
        >
          Text {recipientName}
        </label>
        <ComposingNotice phoneNumber={phoneNumber} className="shrink-0" />
      </div>
      <div className="overflow-hidden rounded-card border border-line-control bg-surface has-[textarea:focus-visible]:outline-2 has-[textarea:focus-visible]:-outline-offset-1 has-[textarea:focus-visible]:outline-accent has-[textarea[aria-invalid=true]]:border-danger">
        <TextareaAutosize
          ref={textarea}
          id={inputId}
          value={body}
          onChange={(event) => {
            if (!body) seenThrough.current = newestTextId();
            setBody(event.target.value);
          }}
          onKeyDown={(event) => {
            if (event.key !== "Enter" || !(event.metaKey || event.ctrlKey))
              return;
            event.preventDefault();
            // A warning is answered with its own buttons, not from the box.
            if (!warning) void submit({ confirmedQuietHours: false });
          }}
          minRows={2}
          maxRows={8}
          aria-describedby={describedBy || undefined}
          aria-invalid={tooLong || blankShown}
          className="block w-full resize-none bg-transparent px-3 pt-2.5 pb-1 text-body text-fg outline-hidden"
        />
        {/* One height for the hints and for a warning, so a warning doesn't
            push the history up. */}
        {warning ? (
          <div
            role="alert"
            className="flex min-h-22 flex-col justify-between gap-2 border-t border-warning bg-warning-soft px-3 py-2"
          >
            <p className="flex gap-2">
              <TriangleAlert
                aria-hidden="true"
                className="mt-0.5 size-4 shrink-0 text-warning"
              />
              <span>
                {quietWarning !== null ? (
                  <>
                    It&apos;s {quietWarning} for {recipientName}. Texts between{" "}
                    {QUIET_HOURS_LABEL} their time can be unwelcome.
                  </>
                ) : (
                  conflict && CONFLICT_COPY[conflict.kind].warning
                )}
              </span>
            </p>
            <div className="flex items-center gap-2">
              <span className="min-w-0 flex-1 truncate text-caption text-fg-muted">
                {localTimeLabel}
              </span>
              <Button
                size="small"
                variant={ButtonVariant.Default}
                onClick={() => {
                  setQuietWarning(null);
                  setConflict(null);
                  textarea.current?.focus();
                }}
              >
                Don&apos;t send
              </Button>
              <Button
                ref={sendAnyway}
                size="small"
                variant={ButtonVariant.Primary}
                onClick={() =>
                  void submit({
                    confirmedQuietHours: conflict?.confirmedQuietHours ?? true,
                  })
                }
              >
                Send anyway
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex min-h-22 items-end gap-3 px-3 py-2">
            <div
              id={`${inputId}-hint`}
              className="flex min-w-0 flex-1 flex-col text-caption text-fg-muted"
            >
              <span>
                {segments
                  ? `${segments.segmentsCount} ${segments.segmentsCount === 1 ? "segment" : "segments"}${segments.encodingName === "UCS-2" ? " (emoji or special characters make segments shorter)" : ""}`
                  : `Up to ${STAFF_TEXT_MAX_LENGTH.toLocaleString()} characters. Texts over 160, or 70 with emoji or special characters, are split.`}
              </span>
              <span>{localTimeLabel}</span>
            </div>
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    type="submit"
                    size="small"
                    variant={ButtonVariant.Primary}
                    busy={pending}
                  />
                }
              >
                {!pending && <Send aria-hidden="true" className="size-4" />}
                Send
              </TooltipTrigger>
              <TooltipContent className="flex items-center gap-1">
                <Kbd>⌘ Enter</Kbd> or <Kbd>Ctrl Enter</Kbd>
              </TooltipContent>
            </Tooltip>
          </div>
        )}
      </div>
      {/* Holds one line, so a message under the box moves nothing. */}
      <div className="flex min-h-4 flex-col gap-1 text-caption text-danger">
        {tooLong && (
          <p id={`${inputId}-too-long`} role="alert">
            This text is over the {STAFF_TEXT_MAX_LENGTH.toLocaleString()}
            -character limit. Shorten it to send.
          </p>
        )}
        {blankShown && (
          <p id={`${inputId}-blank`} role="alert">
            Write a text to send.
          </p>
        )}
        {error && (
          <p id={`${inputId}-error`} role="alert">
            {error}
          </p>
        )}
      </div>
    </form>
  );
}

const UNKNOWN_LOCAL_TIME: Record<LocalTimeUnknown, string> = {
  [LocalTimeUnknown.NoTimeZone]: "Their local time is unknown",
  [LocalTimeUnknown.InvalidTimeZone]:
    "Their time zone on file isn't valid, so their local time is unknown",
};
