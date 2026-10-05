import type { WaitlistEmailTemplateDto } from "@alliance/shared/client/types.gen";
import { queryKeys } from "@alliance/shared/lib/queryKeys";
import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { cleanup, renderHook, waitFor } from "@testing-library/react";
import {
  useDeleteWaitlistEmailTemplateAdmin,
  useSaveWaitlistEmailTemplateAdmin,
  useWaitlistEmailTemplatesAdmin,
} from "./useWaitlistEmailTemplatesAdmin";

afterEach(cleanup);

const template = {
  id: 8,
  name: "Invitation",
  subject: "You're invited, #{name}",
  body: "Join: #{signupLink}",
  updatedAt: "2026-08-01T00:00:00.000Z",
} satisfies WaitlistEmailTemplateDto;

let stored: WaitlistEmailTemplateDto[] = [template];
let writeStatus = 200;

const refuse = () => {
  stored = [{ ...template, name: "Changed elsewhere" }];
  return Response.json({}, { status: writeStatus });
};

serveApi(
  routes({
    "GET /waitlist/admin/email-templates": () => Response.json(stored),
    "POST /waitlist/admin/email-templates": async ({ request }) => {
      if (writeStatus !== 200) return refuse();
      const body: Omit<WaitlistEmailTemplateDto, "id" | "updatedAt"> =
        await request.json();
      const created = { ...template, ...body, id: 9 };
      stored = [...stored, created];
      return Response.json(created);
    },
    "PUT /waitlist/admin/email-templates/:id": async ({ request, params }) => {
      if (writeStatus !== 200) return refuse();
      const body: Omit<WaitlistEmailTemplateDto, "id" | "updatedAt"> =
        await request.json();
      const saved = { ...template, ...body, id: Number(params.id) };
      stored = stored.map((t) => (t.id === saved.id ? saved : t));
      return Response.json(saved);
    },
    "DELETE /waitlist/admin/email-templates/:id": ({ params }) => {
      if (writeStatus !== 200) return refuse();
      stored = stored.filter((t) => String(t.id) !== params.id);
      return Response.json(null);
    },
  }),
);

afterEach(() => {
  stored = [template];
  writeStatus = 200;
});

// Records the list as written by the hook, before the invalidation refetch.
const callbacks = (query: ReturnType<typeof queryWrapper>) => {
  const listed: { onSuccess?: WaitlistEmailTemplateDto[] } = {};
  return {
    listed,
    onSuccess: jest.fn(() => {
      listed.onSuccess = query.client.getQueryData(
        queryKeys.waitlistEmailTemplatesAdmin(),
      );
    }),
    onError: jest.fn(),
    onSettled: jest.fn(),
  };
};

describe("useWaitlistEmailTemplatesAdmin", () => {
  it("loads the templates", async () => {
    const view = renderHook(
      () => useWaitlistEmailTemplatesAdmin(),
      queryWrapper(),
    );

    await waitFor(() => expect(view.result.current.data).toEqual([template]));
  });
});

describe("useSaveWaitlistEmailTemplateAdmin", () => {
  const renderSave = () => {
    const query = queryWrapper();
    const cb = callbacks(query);
    const view = renderHook(
      () => ({
        templates: useWaitlistEmailTemplatesAdmin(),
        save: useSaveWaitlistEmailTemplateAdmin(cb),
      }),
      query,
    );
    return { view, cb };
  };
  const draft = { name: "Reminder", subject: "Still there?", body: "Reply" };

  it("adds a created template to the list", async () => {
    const { view, cb } = renderSave();
    await waitFor(() =>
      expect(view.result.current.templates.data).toBeTruthy(),
    );

    view.result.current.save.mutate({ id: null, body: draft });

    await waitFor(() =>
      expect(view.result.current.templates.data?.map((t) => t.name)).toEqual([
        "Invitation",
        "Reminder",
      ]),
    );
    expect(cb.onSuccess).toHaveBeenCalledWith(
      expect.objectContaining({ id: 9, name: "Reminder" }),
      null,
    );
    expect(cb.listed.onSuccess?.map((t) => t.name)).toEqual([
      "Invitation",
      "Reminder",
    ]);
    expect(cb.onSettled).toHaveBeenCalled();
  });

  it("replaces an updated template in the list", async () => {
    const { view, cb } = renderSave();
    await waitFor(() =>
      expect(view.result.current.templates.data).toBeTruthy(),
    );

    view.result.current.save.mutate({ id: 8, body: draft });

    await waitFor(() =>
      expect(view.result.current.templates.data).toEqual([
        { ...template, ...draft },
      ]),
    );
    expect(cb.onSuccess).toHaveBeenCalledWith(
      expect.objectContaining({ id: 8 }),
      8,
    );
    expect(cb.listed.onSuccess).toEqual([{ ...template, ...draft }]);
  });

  it("refetches the list after a refused save", async () => {
    writeStatus = 409;
    const { view, cb } = renderSave();
    await waitFor(() =>
      expect(view.result.current.templates.data).toBeTruthy(),
    );

    view.result.current.save.mutate({ id: 8, body: draft });

    await waitFor(() =>
      expect(view.result.current.templates.data?.[0].name).toBe(
        "Changed elsewhere",
      ),
    );
    expect(cb.onError).toHaveBeenCalled();
    expect(cb.onSuccess).not.toHaveBeenCalled();
    expect(cb.onSettled).toHaveBeenCalled();
  });
});

describe("useDeleteWaitlistEmailTemplateAdmin", () => {
  const renderDelete = () => {
    const query = queryWrapper();
    const cb = callbacks(query);
    const view = renderHook(
      () => ({
        templates: useWaitlistEmailTemplatesAdmin(),
        remove: useDeleteWaitlistEmailTemplateAdmin(cb),
      }),
      query,
    );
    return { view, cb };
  };

  it("drops a deleted template from the list", async () => {
    const { view, cb } = renderDelete();
    await waitFor(() =>
      expect(view.result.current.templates.data).toBeTruthy(),
    );

    view.result.current.remove.mutate(template);

    await waitFor(() => expect(view.result.current.templates.data).toEqual([]));
    expect(cb.onSuccess).toHaveBeenCalledWith(template);
    expect(cb.listed.onSuccess).toEqual([]);
    expect(cb.onSettled).toHaveBeenCalled();
  });

  it("refetches the list after a refused delete", async () => {
    writeStatus = 409;
    const { view, cb } = renderDelete();
    await waitFor(() =>
      expect(view.result.current.templates.data).toBeTruthy(),
    );

    view.result.current.remove.mutate(template);

    await waitFor(() =>
      expect(view.result.current.templates.data?.[0].name).toBe(
        "Changed elsewhere",
      ),
    );
    expect(cb.onError).toHaveBeenCalled();
    expect(cb.onSuccess).not.toHaveBeenCalled();
    expect(cb.onSettled).toHaveBeenCalled();
  });
});
