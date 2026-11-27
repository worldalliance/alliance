import { ensureHttpProtocol } from "@alliance/common/url";
import type { ActionPartnershipResponseDto } from "@alliance/shared/client/types.gen";
import { type ReactNode, useId, useState } from "react";
import { adminRefusalMessage } from "../../lib/adminRefusal";
import { formatDateTime } from "../../lib/formatDate";
import { useAddOutreachPartnershipNoteAdmin } from "../../lib/useOutreachPartnershipResponsesAdmin";
import Badge, { BadgeTone } from "../../ui/Badge";
import Button, { ButtonVariant } from "../../ui/Button";
import DateTimePicker, { formatLocalDateTime } from "../../ui/DateTimePicker";
import InlineError from "../../ui/InlineError";
import { linkClass } from "../../ui/styles";
import { Field } from "../../ui/templates/Form";
import { Textarea } from "../../ui/Textarea";
import { needsReview } from "./partnershipRules";

function Answer({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-caption font-medium text-fg-muted">{label}</dt>
      <dd className="break-words whitespace-pre-wrap">{children}</dd>
    </div>
  );
}

function AddNoteForm({ responseId }: { responseId: number }) {
  const [body, setBody] = useState("");
  // Untouched, the field shows the current time and the server dates the note itself.
  const [noteDate, setNoteDate] = useState<string | null>(null);
  const [bodyError, setBodyError] = useState<string | null>(null);
  const [refusal, setRefusal] = useState<string | null>(null);
  const addNote = useAddOutreachPartnershipNoteAdmin({
    onSuccess: () => {
      setBody("");
      setNoteDate(null);
    },
    onError: (error) =>
      setRefusal(adminRefusalMessage(error, "Couldn't save the note.")),
  });

  return (
    <form
      noValidate
      className="flex flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        const trimmed = body.trim();
        if (!trimmed) {
          setBodyError("Write a note before saving");
          return;
        }
        setRefusal(null);
        addNote.mutate({
          responseId,
          body: trimmed,
          noteDate: noteDate || undefined,
        });
      }}
    >
      <Field label="Note" error={bodyError}>
        {(control) => (
          <Textarea
            {...control}
            value={body}
            placeholder="Follow-up status, next step, context..."
            onChange={(event) => {
              setBody(event.target.value);
              setBodyError(null);
            }}
          />
        )}
      </Field>
      <Field label="Date" className="max-w-60">
        {(control) => (
          <DateTimePicker
            {...control}
            value={noteDate ?? formatLocalDateTime(new Date(), "minute")}
            onChange={(change) => setNoteDate(change.localValue)}
          />
        )}
      </Field>
      <div className="flex flex-wrap items-center gap-3">
        <Button
          size="small"
          variant={ButtonVariant.Default}
          type="submit"
          busy={addNote.isPending}
        >
          Save note
        </Button>
        <InlineError message={refusal} />
      </div>
    </form>
  );
}

export function ResponseCard({
  response,
  focusRow,
  deleting,
  onDelete,
}: {
  response: ActionPartnershipResponseDto;
  /** `useFocusAfterRemoval`'s row props; the card's first button is its Delete. */
  focusRow: { "data-focus-row": string };
  deleting: boolean;
  onDelete: () => void;
}) {
  const titleId = useId();
  const website = response.organizationWebsite.trim();
  return (
    <article
      aria-labelledby={titleId}
      {...focusRow}
      className="rounded-card border border-line bg-surface"
    >
      <header className="flex flex-wrap items-start gap-x-4 gap-y-2 border-b border-line px-card py-4">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex items-center gap-2.5">
            <h2 id={titleId} className="truncate text-heading font-semibold">
              {response.organizationName}
            </h2>
            {needsReview(response) && (
              <Badge tone={BadgeTone.Warning} className="self-center">
                To review
              </Badge>
            )}
          </div>
          <p className="flex flex-wrap gap-x-2 text-fg-muted">
            {website && (
              <>
                <a
                  href={ensureHttpProtocol(website)}
                  target="_blank"
                  rel="noreferrer"
                  className={linkClass}
                >
                  {website}
                </a>
                <span aria-hidden="true">·</span>
              </>
            )}
            <span>{response.personName}</span>
            <span aria-hidden="true">·</span>
            <a href={`mailto:${response.contact}`} className={linkClass}>
              {response.contact}
            </a>
            <span aria-hidden="true">·</span>
            <span>Submitted {formatDateTime(response.createdAt)}</span>
          </p>
        </div>
        <Button
          size="small"
          variant={ButtonVariant.DangerOutline}
          aria-label={`Delete: ${response.organizationName}`}
          busy={deleting}
          onClick={onDelete}
        >
          Delete
        </Button>
      </header>
      <div className="grid grid-cols-1 @4xl:grid-cols-5">
        <dl className="flex flex-col gap-4 p-card @4xl:col-span-3">
          <Answer label="How they can share">
            {response.outreachChannels.join(", ")}
          </Answer>
          <Answer label="Audience size">{response.audienceSize}</Answer>
          {response.outreachOtherDetails.trim() && (
            <Answer label="Other sharing details">
              {response.outreachOtherDetails}
            </Answer>
          )}
          <Answer label="What they want members to do">
            {response.desiredCollaboration}
          </Answer>
          {response.notes.trim() && (
            <Answer label="Other notes">{response.notes}</Answer>
          )}
        </dl>
        <section className="flex flex-col gap-4 border-t border-line p-card @4xl:col-span-2 @4xl:border-t-0 @4xl:border-l">
          <h3 className="font-semibold">Internal notes</h3>
          <AddNoteForm responseId={response.id} />
          {response.notesHistory.length === 0 ? (
            <p className="text-fg-muted">No internal notes yet.</p>
          ) : (
            <ul className="flex flex-col divide-y divide-line border-t border-line">
              {response.notesHistory.map((note) => (
                <li key={note.id} className="flex flex-col gap-0.5 py-3">
                  <span className="text-caption font-medium text-fg-muted">
                    {formatDateTime(note.noteDate)}
                  </span>
                  <p className="break-words whitespace-pre-wrap">{note.body}</p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </article>
  );
}
