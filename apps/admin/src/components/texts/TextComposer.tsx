import {
  STAFF_TEXT_MAX_LENGTH,
  StaffTextConflict,
} from "@alliance/common/staffText";
import {
  minuteStart,
  useClockMinute,
} from "@alliance/shared/lib/useClockMinute";
import Button, { ButtonColor } from "@alliance/sharedweb/ui/Button";
import { ToastVariant, useToast } from "@alliance/sharedweb/ui/ToastProvider";
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
  const segments = body ? new SegmentedMessage(body, "auto") : null;
  const tooLong = body.length > STAFF_TEXT_MAX_LENGTH;
  const blank = body.trim().length === 0;
  const blankShown = triedBlank && blank;
  const describedBy = [
    `${inputId}-hint`,
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
      className="space-y-2"
      onSubmit={(event) => {
        event.preventDefault();
        void submit({ confirmedQuietHours: false });
      }}
    >
      <div className="flex items-baseline justify-between gap-2">
        <label htmlFor={inputId} className="block text-xs text-zinc-600">
          Text {recipientName}
        </label>
        <ComposingNotice phoneNumber={phoneNumber} />
      </div>
      <TextareaAutosize
        ref={textarea}
        id={inputId}
        value={body}
        onChange={(event) => {
          if (!body) seenThrough.current = newestTextId();
          setBody(event.target.value);
        }}
        minRows={2}
        maxRows={8}
        aria-describedby={describedBy}
        aria-invalid={tooLong || blankShown}
        className="w-full rounded border border-zinc-300 p-2 text-sm"
      />
      <div
        id={`${inputId}-hint`}
        className="flex flex-col text-xs text-zinc-600"
      >
        <span>
          {segments
            ? `${segments.segmentsCount} ${segments.segmentsCount === 1 ? "segment" : "segments"}${segments.encodingName === "UCS-2" ? " (emoji or special characters make segments shorter)" : ""}`
            : `Up to ${STAFF_TEXT_MAX_LENGTH.toLocaleString()} characters. Texts over 160, or 70 with emoji or special characters, are split.`}
        </span>
        <span>
          {localTime.ok
            ? `Their local time: ${localTime.value.label}`
            : UNKNOWN_LOCAL_TIME[localTime.error]}
        </span>
      </div>
      {tooLong && (
        <p
          id={`${inputId}-too-long`}
          role="alert"
          className="text-sm text-red-600"
        >
          This text is over the {STAFF_TEXT_MAX_LENGTH.toLocaleString()}
          -character limit. Shorten it to send.
        </p>
      )}
      {warning && (
        <div
          role="alert"
          className="rounded border border-amber-300 bg-amber-50 p-2 text-sm text-amber-900"
        >
          <p>
            {quietWarning !== null ? (
              <>
                It&apos;s {quietWarning} for {recipientName}. Texts between{" "}
                {QUIET_HOURS_LABEL} their time can be unwelcome.
              </>
            ) : (
              conflict && CONFLICT_COPY[conflict.kind].warning
            )}
          </p>
          <div className="mt-2 flex gap-2">
            <Button
              ref={sendAnyway}
              size="small"
              color={ButtonColor.Stone}
              onClick={() =>
                void submit({
                  confirmedQuietHours: conflict?.confirmedQuietHours ?? true,
                })
              }
            >
              Send anyway
            </Button>
            <Button
              size="small"
              onClick={() => {
                setQuietWarning(null);
                setConflict(null);
                textarea.current?.focus();
              }}
            >
              Don&apos;t send
            </Button>
          </div>
        </div>
      )}
      {blankShown && (
        <p
          id={`${inputId}-blank`}
          role="alert"
          className="text-sm text-red-600"
        >
          Write a text to send.
        </p>
      )}
      {error && (
        <p
          id={`${inputId}-error`}
          role="alert"
          className="text-sm text-red-600"
        >
          {error}
        </p>
      )}
      {!warning && (
        <Button
          type="submit"
          size="small"
          color={ButtonColor.Stone}
          aria-disabled={pending}
        >
          {pending ? "Sending…" : "Send"}
        </Button>
      )}
    </form>
  );
}

const UNKNOWN_LOCAL_TIME: Record<LocalTimeUnknown, string> = {
  [LocalTimeUnknown.NoTimeZone]: "Their local time is unknown",
  [LocalTimeUnknown.InvalidTimeZone]:
    "Their time zone on file isn't valid, so their local time is unknown",
};
