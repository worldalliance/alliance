import { R } from "@alliance/common/result";
import { useActionAdmin } from "@alliance/shared/lib/useActionAdmin";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { LAUNCH_CONFIRM_TEXT } from "../../components/CreateEventForm";
import { adminRefusalMessage } from "../../lib/adminRefusal";
import { formatDateTime } from "../../lib/formatDate";
import { countOf } from "../../lib/formatNumber";
import { taskHref } from "../../lib/hrefs";
import { LAUNCH_TIME_ZONE } from "../../lib/launchTimeZone";
import { useConfirmOnPage } from "../../lib/useConfirmOnPage";
import Button, { ButtonVariant } from "../../ui/Button";
import Modal, {
  ModalActions,
  ModalBody,
  ModalFooter,
  ModalHeader,
  ModalTitle,
} from "../../ui/Modal";
import PhaseBadge, { phaseLabel } from "../../ui/PhaseBadge";
import { Banner, BannerTone } from "../../ui/templates/Banner";
import {
  CheckboxField,
  Field,
  useFocusFirstInvalid,
} from "../../ui/templates/Form";
import { Textarea } from "../../ui/Textarea";
import { useToast } from "../../ui/ToastProvider";
import {
  AUDIENCE,
  EventsOutcomeKind,
  eventsOutcome,
  parsePastedTask,
  pasteBody,
  type EventsOutcome,
  type PastedTask,
} from "./pasteRules";

const eventTime = (date: string) =>
  formatDateTime(date, { timeZone: LAUNCH_TIME_ZONE });

/** What the task's events do once it is created, from `action.entity.ts` `actionStatusAt` and `action-visibility.service.ts`. */
function outcomeText(task: PastedTask, outcome: EventsOutcome): string {
  const audience = task.archived
    ? task.publicOnly
      ? "It is archived, but anyone with its link can still open its page."
      : "No member sees it while it is archived."
    : `Its visibility lets ${AUDIENCE[task.visibilityMode ?? "public"]} see it then.`;
  switch (outcome.kind) {
    case EventsOutcomeKind.Live:
      return `It is “${phaseLabel(outcome.event.newStatus)}” as soon as it is created, from its event on ${eventTime(outcome.event.date)}, so it is no longer a draft. ${audience}`;
    case EventsOutcomeKind.Scheduled:
      return `It stays a draft until ${eventTime(outcome.event.date)}, when its event makes it “${phaseLabel(outcome.event.newStatus)}”. ${audience}`;
    case EventsOutcomeKind.StaysDraft:
      return "Its events leave it a draft.";
    default:
      throw new Error(`unknown outcome: ${outcome satisfies never}`);
  }
}

const CONFIRM_TITLE: Record<EventsOutcomeKind, string> = {
  [EventsOutcomeKind.Live]: "Create a task that is live at once?",
  [EventsOutcomeKind.Scheduled]: "Create a task with a scheduled launch?",
  [EventsOutcomeKind.StaysDraft]: "Create the task with its events?",
};

const IRREVERSIBLE: Record<EventsOutcomeKind, string | null> = {
  [EventsOutcomeKind.Live]:
    "This can't be undone: archiving or deleting the task later doesn't take back what members have seen.",
  [EventsOutcomeKind.Scheduled]:
    "Once it launches, this can't be undone: archiving or deleting the task later doesn't take back what members have seen.",
  [EventsOutcomeKind.StaysDraft]: null,
};

/** What the server's `importAction` creates from the export, besides its events. */
function summaryOf(task: PastedTask): string[] {
  return [
    task.suite
      ? `Adds it to the suite “${task.suite.name}”, or creates a suite with that name if there is none.`
      : "Adds it to no suite.",
    task.taskForm ? "Copies its task form." : "It has no task form.",
    ...(task.archived ? ["It is archived."] : []),
    ...(task.staffPreview && !task.archived
      ? [
          "Staff preview is on: staff accounts see it until members start taking action.",
        ]
      : []),
    ...(task.publicOnly
      ? [
          "Public-only is on: anyone with its link can open its page, even as a draft or archived.",
        ]
      : []),
    "Reminders, updates, follow-up forms and prerequisites in the JSON are not copied.",
  ];
}

/** Creates a task from a task's exported JSON, its events left out unless staff include them. */
export function PasteTaskDialog({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate();
  const { success } = useToast();
  const confirm = useConfirmOnPage();
  const { pasteActionJson } = useActionAdmin(null);
  const { formRef, focusFirstInvalid } = useFocusFirstInvalid();
  const [text, setText] = useState("");
  const [clipboardNote, setClipboardNote] = useState<string | null>(null);
  const [includeEvents, setIncludeEvents] = useState(false);
  const [showError, setShowError] = useState(false);
  const [pasting, setPasting] = useState(false);
  const [refusal, setRefusal] = useState<string | null>(null);
  const submitRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    let current = true;
    void R.fromPromiseFn(
      async () => navigator.clipboard.readText(),
      () => null,
    ).then((read) => {
      if (!current) return;
      if (read.ok) setText((typed) => typed || read.value);
      else
        setClipboardNote("Couldn't read the clipboard: paste the JSON here.");
    });
    return () => {
      current = false;
    };
  }, []);

  const parsed = useMemo(() => parsePastedTask(text), [text]);
  const task = parsed.ok ? parsed.value : null;
  const events = task?.events ?? [];
  const outcome = eventsOutcome(events, new Date());

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!task) {
      setShowError(true);
      focusFirstInvalid();
      return;
    }
    const withEvents = includeEvents && events.length > 0;
    setRefusal(null);
    if (withEvents) {
      const confirming = eventsOutcome(events, new Date());
      const confirmed = await confirm({
        title: CONFIRM_TITLE[confirming.kind],
        message: [
          outcomeText(task, confirming),
          (!task.archived || task.publicOnly) && IRREVERSIBLE[confirming.kind],
          task.suite && "This skips the suite launch checks.",
        ]
          .filter(Boolean)
          .join("\n"),
        confirmLabel: "Create task",
        requiredText: LAUNCH_CONFIRM_TEXT,
      });
      // Closing, the confirm sends focus behind this dialog in a microtask;
      // a task runs after it.
      setTimeout(() => submitRef.current?.focus());
      if (!confirmed) return;
      if (
        outcomeText(task, eventsOutcome(events, new Date())) !==
        outcomeText(task, confirming)
      ) {
        setRefusal(
          "An event's time passed before you confirmed. Check the events and create the task again.",
        );
        return;
      }
    }
    setPasting(true);
    const created = await R.fromPromise(
      pasteActionJson(pasteBody(task, { includeEvents: withEvents })),
      (error) => adminRefusalMessage(error, "Couldn't create the task."),
    );
    setPasting(false);
    if (!created.ok) {
      setRefusal(created.error);
      return;
    }
    success("Task pasted", created.value.name);
    void navigate(taskHref(created.value.id));
  };

  return (
    <Modal onClose={onClose} dismissDisabled={pasting}>
      <form ref={formRef} onSubmit={(event) => void submit(event)} noValidate>
        <ModalHeader>
          <ModalTitle>Paste a task</ModalTitle>
        </ModalHeader>
        <ModalBody className="flex flex-col gap-4">
          <Field
            label="Task JSON"
            help={
              clipboardNote ??
              "Copied by Export JSON on a task's Overview. The new task starts as a copy of it."
            }
            error={showError && !parsed.ok ? parsed.error : null}
          >
            {(control) => (
              <Textarea
                {...control}
                rows={6}
                value={text}
                onChange={(event) => {
                  setText(event.target.value);
                  setShowError(false);
                }}
                className="font-mono text-xs"
              />
            )}
          </Field>
          {task && (
            <section
              aria-label="What the paste creates"
              className="flex flex-col gap-2"
            >
              <p className="font-medium">Creates “{task.name}”</p>
              <ul className="list-disc pl-5 text-fg-muted">
                {summaryOf(task).map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </section>
          )}
          <CheckboxField
            label={
              events.length > 0
                ? `Include its ${countOf(events.length, "event")}`
                : "Include its events"
            }
            checked={includeEvents && events.length > 0}
            disabled={events.length === 0}
            onChange={(event) => setIncludeEvents(event.target.checked)}
            help={
              !task
                ? "Paste a task's JSON to see its events."
                : events.length === 0
                  ? "The JSON has no events."
                  : "Off, the task has no events and is a draft. On, it keeps each event's date, past ones included."
            }
          />
          {task && includeEvents && events.length > 0 && (
            <>
              <ul
                className="flex flex-col gap-1.5"
                aria-label="Events in the JSON"
              >
                {events.map((pasted, index) => (
                  <li key={index} className="flex items-center gap-2">
                    <PhaseBadge status={pasted.newStatus} />
                    <span className="tabular-nums">
                      {eventTime(pasted.date)}
                    </span>
                  </li>
                ))}
              </ul>
              <Banner
                inline
                tone={
                  outcome.kind === EventsOutcomeKind.StaysDraft
                    ? BannerTone.Info
                    : BannerTone.Warning
                }
              >
                {outcomeText(task, outcome)}
              </Banner>
            </>
          )}
        </ModalBody>
        <ModalFooter error={refusal}>
          <ModalActions>
            <Button
              variant={ButtonVariant.Default}
              onClick={onClose}
              disabled={pasting}
            >
              Cancel
            </Button>
            <Button
              variant={ButtonVariant.Primary}
              type="submit"
              ref={submitRef}
              busy={pasting}
            >
              Create task
            </Button>
          </ModalActions>
        </ModalFooter>
      </form>
    </Modal>
  );
}
