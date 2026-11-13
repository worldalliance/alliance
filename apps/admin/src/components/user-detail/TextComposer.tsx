import { STAFF_TEXT_MAX_LENGTH } from "@alliance/common/staffText";
import {
  minuteStart,
  useClockMinute,
} from "@alliance/shared/lib/useClockMinute";
import Button, { ButtonColor } from "@alliance/sharedweb/ui/Button";
import { ToastVariant, useToast } from "@alliance/sharedweb/ui/ToastProvider";
import { useEffect, useId, useRef, useState } from "react";
import TextareaAutosize from "react-textarea-autosize";
import { SegmentedMessage } from "sms-segments-calculator";
import { adminRefusalMessage } from "../../lib/adminRefusal";
import {
  LocalTimeUnknown,
  memberLocalTime,
  QUIET_HOURS_LABEL,
} from "../../lib/memberTexts";

export default function TextComposer({
  memberName,
  timeZone,
  send,
}: {
  memberName: string;
  timeZone: string | null;
  send: (body: string) => Promise<unknown>;
}) {
  const [body, setBody] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [quietWarning, setQuietWarning] = useState<string | null>(null);
  const [triedBlank, setTriedBlank] = useState(false);
  const inputId = useId();
  const { showToast } = useToast();
  const mounted = useRef(false);
  const textarea = useRef<HTMLTextAreaElement>(null);
  const sendAnyway = useRef<HTMLButtonElement>(null);
  const warning = quietWarning !== null;
  const now = minuteStart(useClockMinute());

  useEffect(() => {
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
      setQuietWarning(localTime.value.label);
      return;
    }
    setQuietWarning(null);
    if (params.confirmedQuietHours) textarea.current?.focus();
    setPending(true);
    setError(null);
    const sent = body;
    try {
      await send(sent);
      setBody((current) => (current === sent ? "" : current));
    } catch (thrown) {
      const message = adminRefusalMessage(
        thrown,
        "The text may not have gone out. Check the thread in a minute before trying again.",
      );
      if (mounted.current) setError(message);
      else
        showToast({
          variant: ToastVariant.Error,
          title: `Problem sending text to ${memberName}`,
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
      <label htmlFor={inputId} className="block text-xs text-zinc-600">
        Text {memberName}
      </label>
      <TextareaAutosize
        ref={textarea}
        id={inputId}
        value={body}
        onChange={(event) => setBody(event.target.value)}
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
      {quietWarning && (
        <div
          role="alert"
          className="rounded border border-amber-300 bg-amber-50 p-2 text-sm text-amber-900"
        >
          <p>
            It&apos;s {quietWarning} for {memberName}. Texts between{" "}
            {QUIET_HOURS_LABEL} their time can be unwelcome.
          </p>
          <div className="mt-2 flex gap-2">
            <Button
              ref={sendAnyway}
              size="small"
              color={ButtonColor.Stone}
              onClick={() => void submit({ confirmedQuietHours: true })}
            >
              Send anyway
            </Button>
            <Button
              size="small"
              onClick={() => {
                setQuietWarning(null);
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
      {!quietWarning && (
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
