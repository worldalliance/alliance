import { ensureHttpProtocol } from "@alliance/common/url";
import {
  actionPartnershipsCreateNoteAdmin,
  actionPartnershipsDeleteResponseAdmin,
  actionPartnershipsFindAllResponsesAdmin,
} from "@alliance/shared/client";
import type {
  ActionPartnershipNoteDto,
  ActionPartnershipResponseDto,
} from "@alliance/shared/client/types.gen";
import Button, { ButtonColor } from "@alliance/sharedweb/ui/Button";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

const formatDateTime = (value: string): string =>
  new Date(value).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });

const getDefaultNoteDate = (): string => {
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  return now.toISOString().slice(0, 16);
};

const OutreachPartnershipsPage: React.FC = () => {
  const [responses, setResponses] = useState<ActionPartnershipResponseDto[]>(
    [],
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [noteBodies, setNoteBodies] = useState<Record<number, string>>({});
  const [noteDates, setNoteDates] = useState<Record<number, string>>({});
  const [savingNoteIds, setSavingNoteIds] = useState<Set<number>>(
    () => new Set(),
  );
  const [deletingResponseIds, setDeletingResponseIds] = useState<Set<number>>(
    () => new Set(),
  );
  const deletingResponseIdsRef = useRef<Set<number>>(new Set());

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await actionPartnershipsFindAllResponsesAdmin({
        throwOnError: true,
      });
      setResponses(res.data);
    } catch (err) {
      console.error("Failed to load outreach partnership responses", err);
      setError("Failed to load outreach partnership responses.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const responseCountText = useMemo(() => {
    switch (responses.length) {
      case 0:
        return "No responses yet";
      case 1:
        return "1 response";
      default:
        return `${responses.length} responses`;
    }
  }, [responses.length]);

  const handleAddNote = useCallback(
    async (responseId: number) => {
      const body = (noteBodies[responseId] ?? "").trim();
      if (!body) {
        setError("Write a note before saving.");
        return;
      }

      setSavingNoteIds((prev) => new Set(prev).add(responseId));
      setError(null);
      try {
        const noteDate = noteDates[responseId];
        const res = await actionPartnershipsCreateNoteAdmin({
          path: { id: responseId },
          body: {
            body,
            ...(noteDate ? { noteDate: new Date(noteDate).toISOString() } : {}),
          },
          throwOnError: true,
        });
        const note = res.data;
        setResponses((prev) =>
          prev.map((response) =>
            response.id === responseId
              ? {
                  ...response,
                  notesHistory: [note, ...response.notesHistory],
                }
              : response,
          ),
        );
        setNoteBodies((prev) => ({ ...prev, [responseId]: "" }));
        setNoteDates((prev) => ({
          ...prev,
          [responseId]: getDefaultNoteDate(),
        }));
        window.dispatchEvent(new Event("outreach-partnerships-updated"));
      } catch (err) {
        console.error("Failed to add outreach partnership note", err);
        setError("Failed to save note.");
      } finally {
        setSavingNoteIds((prev) => {
          const next = new Set(prev);
          next.delete(responseId);
          return next;
        });
      }
    },
    [noteBodies, noteDates],
  );

  const handleDeleteResponse = useCallback(
    async (response: ActionPartnershipResponseDto) => {
      if (deletingResponseIdsRef.current.has(response.id)) {
        return;
      }

      const confirmed = window.confirm(
        `Are you sure you want to delete ${response.organizationName}'s outreach partnership response? This cannot be undone.`,
      );
      if (!confirmed) {
        return;
      }

      deletingResponseIdsRef.current = new Set(
        deletingResponseIdsRef.current,
      ).add(response.id);
      setDeletingResponseIds(deletingResponseIdsRef.current);
      setError(null);
      try {
        await actionPartnershipsDeleteResponseAdmin({
          path: { id: response.id },
          throwOnError: true,
        });
        setResponses((prev) =>
          prev.filter((existing) => existing.id !== response.id),
        );
        window.dispatchEvent(new Event("outreach-partnerships-updated"));
      } catch (err) {
        console.error("Failed to delete outreach partnership response", err);
        setError("Failed to delete response.");
      } finally {
        const nextDeletingResponseIds = new Set(deletingResponseIdsRef.current);
        nextDeletingResponseIds.delete(response.id);
        deletingResponseIdsRef.current = nextDeletingResponseIds;
        setDeletingResponseIds(nextDeletingResponseIds);
      }
    },
    [],
  );

  return (
    <div className="h-full overflow-y-auto p-5 pt-20">
      <title>Outreach Partnerships - Admin</title>
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-5">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold">Outreach partnerships</h1>
          <p className="text-sm text-zinc-500">{responseCountText}</p>
        </div>

        {error ? <p className="text-sm text-red-500">{error}</p> : null}

        {loading ? (
          <p className="text-sm text-zinc-500">Loading...</p>
        ) : responses.length === 0 ? (
          <div className="rounded-md border border-zinc-200 bg-white p-6">
            <p className="text-sm text-zinc-500">
              No outreach partnership responses have been submitted yet.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {responses.map((response) => (
              <ResponseCard
                key={response.id}
                response={response}
                noteBody={noteBodies[response.id] ?? ""}
                noteDate={noteDates[response.id] ?? getDefaultNoteDate()}
                savingNote={savingNoteIds.has(response.id)}
                deletingResponse={deletingResponseIds.has(response.id)}
                onNoteBodyChange={(body) => {
                  setError(null);
                  setNoteBodies((prev) => ({ ...prev, [response.id]: body }));
                }}
                onNoteDateChange={(date) => {
                  setNoteDates((prev) => ({ ...prev, [response.id]: date }));
                }}
                onAddNote={() => handleAddNote(response.id)}
                onDelete={() => handleDeleteResponse(response)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

function ResponseCard({
  response,
  noteBody,
  noteDate,
  savingNote,
  deletingResponse,
  onNoteBodyChange,
  onNoteDateChange,
  onAddNote,
  onDelete,
}: {
  response: ActionPartnershipResponseDto;
  noteBody: string;
  noteDate: string;
  savingNote: boolean;
  deletingResponse: boolean;
  onNoteBodyChange: (body: string) => void;
  onNoteDateChange: (date: string) => void;
  onAddNote: () => void;
  onDelete: () => void;
}) {
  return (
    <article className="rounded-md border border-zinc-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1 border-b border-zinc-200 pb-4">
          <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
            <div>
              <h2 className="text-xl font-semibold">
                {response.organizationName}
              </h2>
              {response.organizationWebsite.trim() ? (
                <a
                  href={ensureHttpProtocol(response.organizationWebsite)}
                  target="_blank"
                  rel="noreferrer"
                  className="text-sm text-link"
                >
                  {response.organizationWebsite}
                </a>
              ) : null}
              <p className="text-sm text-zinc-500">
                Submitted {formatDateTime(response.createdAt)}
              </p>
            </div>
            <a
              href={`mailto:${response.contact}`}
              className="text-sm text-link"
            >
              {response.contact}
            </a>
          </div>
          <p className="text-sm text-zinc-700">
            Contact: {response.personName}
          </p>
          <Button
            color={ButtonColor.Red}
            className="self-start text-white"
            disabled={deletingResponse}
            onClick={onDelete}
          >
            {deletingResponse ? "Deleting..." : "Delete"}
          </Button>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <InfoBlock title="How they can share">
            {response.outreachChannels.join(", ")}
          </InfoBlock>
          <InfoBlock title="Audience size">{response.audienceSize}</InfoBlock>
        </div>

        {response.outreachOtherDetails.trim() ? (
          <InfoBlock title="Other sharing details">
            {response.outreachOtherDetails}
          </InfoBlock>
        ) : null}

        <InfoBlock title="What they want members to do">
          {response.desiredCollaboration}
        </InfoBlock>

        {response.notes.trim() ? (
          <InfoBlock title="Other notes">{response.notes}</InfoBlock>
        ) : null}

        <div className="grid grid-cols-1 gap-5 border-t border-zinc-200 pt-4 lg:grid-cols-[1fr_0.9fr]">
          <div className="flex flex-col gap-3">
            <h3 className="text-sm font-semibold text-zinc-900">
              Internal notes
            </h3>
            {response.notesHistory.length ? (
              <div className="flex flex-col gap-2">
                {response.notesHistory.map((note) => (
                  <NoteItem key={note.id} note={note} />
                ))}
              </div>
            ) : (
              <p className="text-sm text-zinc-500">No internal notes yet.</p>
            )}
          </div>

          <div className="flex flex-col gap-3 rounded-md bg-zinc-50 p-4">
            <h3 className="text-sm font-semibold text-zinc-900">Add note</h3>
            <label className="flex flex-col gap-1 text-sm font-medium text-zinc-700">
              Date
              <input
                type="datetime-local"
                className="rounded border border-zinc-300 bg-white px-3 py-2 text-sm"
                value={noteDate}
                onChange={(event) => onNoteDateChange(event.target.value)}
              />
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium text-zinc-700">
              Note
              <textarea
                className="min-h-28 resize-y rounded border border-zinc-300 bg-white px-3 py-2 text-sm"
                value={noteBody}
                onChange={(event) => onNoteBodyChange(event.target.value)}
                placeholder="Follow-up status, next step, context..."
              />
            </label>
            <Button
              color={ButtonColor.Green}
              className="self-start text-white"
              disabled={savingNote}
              onClick={onAddNote}
            >
              {savingNote ? "Saving..." : "Save note"}
            </Button>
          </div>
        </div>
      </div>
    </article>
  );
}

function InfoBlock({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <p className="text-xs font-semibold uppercase text-zinc-500">{title}</p>
      <p className="whitespace-pre-wrap text-sm leading-relaxed text-zinc-800">
        {children}
      </p>
    </div>
  );
}

function NoteItem({ note }: { note: ActionPartnershipNoteDto }) {
  return (
    <div className="rounded-md border border-zinc-200 p-3">
      <p className="text-xs font-semibold text-zinc-500">
        {formatDateTime(note.noteDate)}
      </p>
      <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-zinc-800">
        {note.body}
      </p>
    </div>
  );
}

export default OutreachPartnershipsPage;
