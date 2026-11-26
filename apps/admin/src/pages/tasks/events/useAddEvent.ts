import type { CreateActionEventDto } from "@alliance/shared/client";
import { useRef, useState } from "react";
import { adminRefusalMessage } from "../../../lib/adminRefusal";
import { useConfirmOnPage } from "../../../lib/useConfirmOnPage";
import {
  addsDeadline,
  DEADLINE_TOO_EARLY,
  deadlineBody,
  deadlineTooEarly,
  draftErrors,
  emptyEventDraft,
  eventBody,
  eventConfirm,
  eventEffect,
  type DraftErrors,
  type EventDraft,
  type EventTarget,
} from "./eventRules";

/**
 * Sends one event. Resolves `false` when staff decline a question the send
 * asked (moving the deadline earlier), and rejects with the refusal.
 */
export type SendEvent = (body: CreateActionEventDto) => Promise<boolean>;

export type AddEventFailure = { word: string; reason: string };

const ADD_FAILED = "Couldn't add the event.";

export function useAddEvent(params: {
  target: EventTarget;
  send: SendEvent;
  onAdded: (body: CreateActionEventDto) => void;
  onPendingChange?: (pending: boolean) => void;
}) {
  const { target, send, onAdded, onPendingChange } = params;
  const confirm = useConfirmOnPage();
  const [draft, setDraft] = useState<EventDraft>(() =>
    emptyEventDraft(new Date()),
  );
  const [errors, setErrors] = useState<DraftErrors>({});
  const [failure, setFailure] = useState<AddEventFailure | null>(null);
  const [pending, setPendingState] = useState(false);
  const pendingRef = useRef(false);

  const setPending = (value: boolean) => {
    pendingRef.current = value;
    setPendingState(value);
    onPendingChange?.(value);
  };

  const update = (patch: Partial<EventDraft>) => {
    setDraft((prev) => ({ ...prev, ...patch }));
    setErrors((prev) => {
      const next = { ...prev };
      for (const key of Object.keys(patch)) {
        if (key === "status" || key === "title" || key === "date") {
          delete next[key];
        }
        if (key === "deadlineDate" || key === "date" || key === "deadline") {
          delete next.deadlineDate;
        }
        if (key === "takeEffectNow") delete next.date;
        if (key === "customTitle") delete next.title;
      }
      return next;
    });
  };

  /** Returns `false` when the draft has errors to show. */
  const submit = async (): Promise<boolean> => {
    if (pendingRef.current) return true;
    setFailure(null);
    const found = draftErrors(draft, new Date());
    setErrors(found);
    const { status } = draft;
    if (Object.keys(found).length > 0 || status === "") return false;
    const ready = { ...draft, status };

    // Pending from the question on, so a second submit can't ask again.
    setPending(true);
    try {
      const askedAt = new Date();
      const asked = draft.takeEffectNow ? askedAt : new Date(draft.date);
      const opensNow = asked <= askedAt;
      const question = eventConfirm({
        effect: eventEffect({ target, status, at: asked }),
        target,
        status,
        at: asked,
        opensNow,
      });
      if (question && !(await confirm(question))) return true;

      // The question can stay open past the times it was asked about.
      const at = draft.takeEffectNow ? new Date() : asked;
      if (question && !opensNow && at <= new Date()) {
        setFailure({
          word: "Not added",
          reason:
            status === "member_action"
              ? "The launch time passed before you confirmed. Pick a new time."
              : "The event's time passed before you confirmed. Pick a new time.",
        });
        return true;
      }
      if (deadlineTooEarly(ready, at)) {
        setErrors({ deadlineDate: DEADLINE_TOO_EARLY });
        return false;
      }

      const body = eventBody(ready, at);
      let added: boolean;
      try {
        added = await send(body);
      } catch (error) {
        setFailure({
          word: "Couldn't add",
          reason: adminRefusalMessage(error, ADD_FAILED),
        });
        return true;
      }
      if (!added) return true;

      setDraft(emptyEventDraft(new Date()));
      setErrors({});
      if (addsDeadline(ready)) {
        let deadlineAdded: boolean;
        try {
          deadlineAdded = await send(deadlineBody(ready));
        } catch (error) {
          setFailure({
            word: "Deadline not added",
            reason: `${body.title} was added, but its deadline event wasn't: ${adminRefusalMessage(error, ADD_FAILED)} Add the deadline separately.`,
          });
          return true;
        }
        if (!deadlineAdded) {
          setFailure({
            word: "Deadline not added",
            reason:
              "Added the launch event without its deadline event. Add the deadline separately.",
          });
          return true;
        }
      }
      onAdded(body);
      return true;
    } finally {
      setPending(false);
    }
  };

  return { draft, update, errors, failure, pending, submit };
}
