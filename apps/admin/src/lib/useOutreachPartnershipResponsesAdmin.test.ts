import type {
  ActionPartnershipNoteDto,
  ActionPartnershipResponseDto,
  CreateActionPartnershipNoteDto,
} from "@alliance/shared/client";
import { queryKeys } from "@alliance/shared/lib/queryKeys";
import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";
import {
  useAddOutreachPartnershipNoteAdmin,
  useDeleteOutreachPartnershipResponseAdmin,
  useOutreachPartnershipResponsesAdmin,
} from "./useOutreachPartnershipResponsesAdmin";

afterEach(cleanup);

const partnership = (id: number, organizationName: string) =>
  ({
    id,
    organizationName,
    organizationWebsite: "",
    personName: "Sam Example",
    contact: `org${id}@example.com`,
    outreachChannels: ["Newsletter"],
    outreachOtherDetails: "",
    audienceSize: "100",
    desiredCollaboration: "Share the action",
    notes: "",
    createdAt: "2026-01-02T00:00:00.000Z",
    updatedAt: "2026-01-02T00:00:00.000Z",
    notesHistory: [],
  }) satisfies ActionPartnershipResponseDto;

let stored: ActionPartnershipResponseDto[] = [];
let deleteStatus = 200;
const noteBodies: CreateActionPartnershipNoteDto[] = [];

serveApi(
  routes({
    "GET /action-partnerships/responses": () => Response.json(stored),
    "POST /action-partnerships/responses/:id/notes": async ({
      request,
      params,
    }) => {
      const body: CreateActionPartnershipNoteDto = await request.json();
      noteBodies.push(body);
      return Response.json({
        id: 50,
        responseId: Number(params.id),
        noteDate: body.noteDate ?? "2026-01-03T00:00:00.000Z",
        body: body.body,
        createdAt: "2026-01-03T00:00:00.000Z",
        updatedAt: "2026-01-03T00:00:00.000Z",
      } satisfies ActionPartnershipNoteDto);
    },
    "DELETE /action-partnerships/responses/:id": ({ params }) => {
      if (deleteStatus !== 200) {
        return Response.json({}, { status: deleteStatus });
      }
      stored = stored.filter((r) => String(r.id) !== params.id);
      return new Response(null, { status: 200 });
    },
  }),
);

beforeEach(() => {
  stored = [partnership(1, "Org A"), partnership(2, "Org B")];
  deleteStatus = 200;
  noteBodies.length = 0;
});

const cached = (query: ReturnType<typeof queryWrapper>) =>
  query.client.getQueryData<ActionPartnershipResponseDto[]>(
    queryKeys.outreachPartnershipResponsesAdmin(),
  );

const renderResponses = (
  query = queryWrapper(),
  onNoteAdded: (responseId: number) => void = () => {},
) =>
  renderHook(
    () => ({
      responses: useOutreachPartnershipResponsesAdmin(),
      addNote: useAddOutreachPartnershipNoteAdmin({
        onSuccess: onNoteAdded,
        onError: () => {},
      }),
      remove: useDeleteOutreachPartnershipResponseAdmin({ onError: () => {} }),
    }),
    query,
  );

describe("useOutreachPartnershipResponsesAdmin", () => {
  it("loads the responses", async () => {
    const view = renderHook(
      () => useOutreachPartnershipResponsesAdmin(),
      queryWrapper(),
    );

    await waitFor(() => expect(view.result.current.data).toEqual(stored));
  });
});

describe("useAddOutreachPartnershipNoteAdmin", () => {
  it("caches the note on its response first and then reports success", async () => {
    const query = queryWrapper();
    const onNoteAdded = mock((_responseId: number) =>
      cached(query)?.map((r) => r.notesHistory.map((n) => n.body)),
    );
    const view = renderResponses(query, onNoteAdded);
    await waitFor(() =>
      expect(view.result.current.responses.data).toBeDefined(),
    );

    await view.result.current.addNote.mutateAsync({
      responseId: 2,
      body: "Called them back",
      noteDate: "2026-01-04T10:30",
    });

    expect(noteBodies).toEqual([
      {
        body: "Called them back",
        noteDate: new Date("2026-01-04T10:30").toISOString(),
      },
    ]);
    expect(onNoteAdded.mock.calls).toEqual([[2]]);
    expect(onNoteAdded.mock.results).toEqual([
      { type: "return", value: [[], ["Called them back"]] },
    ]);
  });

  it("leaves the note date to the server when none is given", async () => {
    const view = renderResponses();

    await view.result.current.addNote.mutateAsync({
      responseId: 1,
      body: "Emailed",
      noteDate: undefined,
    });

    expect(noteBodies).toEqual([{ body: "Emailed" }]);
  });
});

describe("useDeleteOutreachPartnershipResponseAdmin", () => {
  it("drops the deleted response from the cache", async () => {
    const query = queryWrapper();
    const view = renderResponses(query);
    await waitFor(() =>
      expect(view.result.current.responses.data).toBeDefined(),
    );

    await view.result.current.remove.mutateAsync(1);

    expect(cached(query)?.map((r) => r.id)).toEqual([2]);
  });

  it("drops a response another admin already deleted", async () => {
    deleteStatus = 404;
    const query = queryWrapper();
    const view = renderResponses(query);
    await waitFor(() =>
      expect(view.result.current.responses.data).toBeDefined(),
    );

    await view.result.current.remove.mutateAsync(1);

    expect(cached(query)?.map((r) => r.id)).toEqual([2]);
  });
});
