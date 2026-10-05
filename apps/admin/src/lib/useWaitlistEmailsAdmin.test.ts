import type {
  PreviewWaitlistEmailDto,
  WaitlistEmailPreviewDto,
} from "@alliance/shared/client/types.gen";
import { queryKeys } from "@alliance/shared/lib/queryKeys";
import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { cleanup, renderHook, waitFor } from "@testing-library/react";
import {
  useRetryWaitlistEmailAdmin,
  useSendTestWaitlistEmailAdmin,
  useSendWaitlistEmailAdmin,
  useWaitlistEmailPreviewAdmin,
} from "./useWaitlistEmailsAdmin";

afterEach(cleanup);

const previewOf = (selected: number) =>
  ({
    selected,
    unsubscribed: 0,
    spam: 0,
    claimed: 0,
    recipientIds: [],
    waiting: selected,
    withoutOrganization: 0,
    withoutGroup: 0,
    inFullGroup: 0,
    alreadySent: 0,
    sample: null,
  }) satisfies WaitlistEmailPreviewDto;

const draft = (entryIds: number[]) =>
  ({
    subject: "Hi",
    body: "Hello",
    entryIds,
    includeClaimed: false,
  }) satisfies PreviewWaitlistEmailDto;

const requests: unknown[] = [];
let writeStatus = 200;

const write =
  (path: string) =>
  async ({
    request,
    params,
  }: {
    request: Request;
    params: Record<string, string>;
  }) => {
    requests.push({ path, ...params, ...(await request.json()) });
    return Response.json({}, { status: writeStatus });
  };

serveApi(
  routes({
    "POST /waitlist/admin/emails/preview": async ({ request }) => {
      const body: PreviewWaitlistEmailDto = await request.json();
      requests.push(body);
      return Response.json(previewOf(body.entryIds.length));
    },
    "POST /waitlist/admin/emails/test": write("test"),
    "POST /waitlist/admin/emails": write("send"),
    "POST /waitlist/admin/emails/:id/retry": write("retry"),
  }),
);

afterEach(() => {
  requests.length = 0;
  writeStatus = 200;
});

const callbacks = () => ({
  onSuccess: jest.fn(),
  onError: jest.fn(),
  onSettled: jest.fn(),
});

const seeded = (keys: readonly (readonly unknown[])[]) => {
  const query = queryWrapper();
  for (const key of keys) query.client.setQueryData(key, []);
  const invalidated = (key: readonly unknown[]) =>
    query.client.getQueryState(key)?.isInvalidated;
  return { query, invalidated };
};

describe("useWaitlistEmailPreviewAdmin", () => {
  it("previews the draft for the selected entries", async () => {
    const view = renderHook(
      () => useWaitlistEmailPreviewAdmin(draft([1, 2]), { enabled: true }),
      queryWrapper(),
    );

    await waitFor(() => expect(view.result.current.data).toEqual(previewOf(2)));
    expect(requests).toEqual([draft([1, 2])]);
  });

  it("does not preview while disabled", () => {
    const view = renderHook(
      () => useWaitlistEmailPreviewAdmin(draft([1]), { enabled: false }),
      queryWrapper(),
    );

    expect(view.result.current.fetchStatus).toBe("idle");
    expect(requests).toEqual([]);
  });

  it("keeps the previous preview while the next one loads", async () => {
    const view = renderHook(
      ({ entryIds }) =>
        useWaitlistEmailPreviewAdmin(draft(entryIds), { enabled: true }),
      { ...queryWrapper(), initialProps: { entryIds: [1] } },
    );
    await waitFor(() => expect(view.result.current.data).toEqual(previewOf(1)));

    view.rerender({ entryIds: [1, 2, 3] });

    expect(view.result.current.isPlaceholderData).toBe(true);
    expect(view.result.current.data).toEqual(previewOf(1));
    await waitFor(() => expect(view.result.current.data).toEqual(previewOf(3)));
  });
});

describe("useSendTestWaitlistEmailAdmin", () => {
  it("sends the test email for the entry", async () => {
    const on = callbacks();
    const view = renderHook(
      () => useSendTestWaitlistEmailAdmin(on),
      queryWrapper(),
    );

    view.result.current.mutate({ subject: "Hi", body: "Hello", entryId: 4 });

    await waitFor(() => expect(on.onSettled).toHaveBeenCalled());
    expect(requests).toEqual([
      { path: "test", subject: "Hi", body: "Hello", entryId: 4 },
    ]);
    expect(on.onSuccess).toHaveBeenCalled();
  });

  it("reports a refusal", async () => {
    writeStatus = 403;
    const on = callbacks();
    const view = renderHook(
      () => useSendTestWaitlistEmailAdmin(on),
      queryWrapper(),
    );

    view.result.current.mutate({ subject: "Hi", body: "Hello", entryId: 4 });

    await waitFor(() => expect(on.onSettled).toHaveBeenCalled());
    expect(on.onError).toHaveBeenCalled();
    expect(on.onSuccess).not.toHaveBeenCalled();
  });
});

describe("useSendWaitlistEmailAdmin", () => {
  const email = {
    subject: "Hi",
    body: "Hello",
    entryIds: [1, 2],
    includeClaimed: false,
    mobilize: true,
    requestId: "request-1",
  };
  const refreshed = [
    queryKeys.waitlistEntriesAdminAll(),
    queryKeys.waitlistEmailPreviewAdminAll(),
  ];

  it("sends the email, passes back the recipients, and refreshes", async () => {
    const on = callbacks();
    const { query, invalidated } = seeded(refreshed);
    const view = renderHook(() => useSendWaitlistEmailAdmin(on), query);

    view.result.current.mutate({ email, recipients: 2 });

    await waitFor(() =>
      expect(refreshed.map(invalidated)).toEqual([true, true]),
    );
    expect(requests).toEqual([{ path: "send", ...email }]);
    expect(on.onSuccess).toHaveBeenCalledWith(2);
    expect(on.onSettled).toHaveBeenCalled();
  });

  it("refreshes after a refusal too", async () => {
    writeStatus = 409;
    const on = callbacks();
    const { query, invalidated } = seeded(refreshed);
    const view = renderHook(() => useSendWaitlistEmailAdmin(on), query);

    view.result.current.mutate({ email, recipients: 2 });

    await waitFor(() =>
      expect(refreshed.map(invalidated)).toEqual([true, true]),
    );
    expect(on.onError).toHaveBeenCalled();
    expect(on.onSuccess).not.toHaveBeenCalled();
  });
});

describe("useRetryWaitlistEmailAdmin", () => {
  const refreshed = [
    queryKeys.waitlistEmailAdmin(7),
    queryKeys.waitlistEmailsAdmin(),
  ];

  it.each([true, false])(
    "retries with includeUncertain %s and refreshes the email",
    async (includeUncertain) => {
      const on = callbacks();
      const { query, invalidated } = seeded([
        ...refreshed,
        queryKeys.waitlistEmailAdmin(8),
      ]);
      const view = renderHook(() => useRetryWaitlistEmailAdmin(7, on), query);

      view.result.current.mutate(includeUncertain);

      await waitFor(() =>
        expect(refreshed.map(invalidated)).toEqual([true, true]),
      );
      expect(invalidated(queryKeys.waitlistEmailAdmin(8))).toBe(false);
      expect(requests).toEqual([{ path: "retry", id: "7", includeUncertain }]);
      expect(on.onSuccess).toHaveBeenCalled();
      expect(on.onSettled).toHaveBeenCalled();
    },
  );

  it("refreshes after a refusal too", async () => {
    writeStatus = 409;
    const on = callbacks();
    const { query, invalidated } = seeded(refreshed);
    const view = renderHook(() => useRetryWaitlistEmailAdmin(7, on), query);

    view.result.current.mutate(false);

    await waitFor(() =>
      expect(refreshed.map(invalidated)).toEqual([true, true]),
    );
    expect(on.onError).toHaveBeenCalled();
    expect(on.onSuccess).not.toHaveBeenCalled();
  });
});
