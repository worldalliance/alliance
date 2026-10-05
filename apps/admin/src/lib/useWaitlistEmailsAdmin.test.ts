import type {
  PreviewWaitlistEmailDto,
  WaitlistEmailPreviewDto,
} from "@alliance/shared/client/types.gen";
import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { cleanup, renderHook, waitFor } from "@testing-library/react";
import { useWaitlistEmailPreviewAdmin } from "./useWaitlistEmailsAdmin";

afterEach(cleanup);

const previewOf = (selected: number) =>
  ({
    selected,
    unsubscribed: 0,
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

serveApi(
  routes({
    "POST /waitlist/admin/emails/preview": async ({ request }) => {
      const body: PreviewWaitlistEmailDto = await request.json();
      requests.push(body);
      return Response.json(previewOf(body.entryIds.length));
    },
  }),
);

afterEach(() => {
  requests.length = 0;
});

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
