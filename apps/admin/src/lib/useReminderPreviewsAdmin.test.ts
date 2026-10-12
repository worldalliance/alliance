import type {
  PreviewEmailHtmlDto,
  PreviewTextDto,
} from "@alliance/shared/client/types.gen";
import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { cleanup, renderHook, waitFor } from "@testing-library/react";
import {
  useReminderEmailPreviewAdmin,
  useReminderTextPreviewAdmin,
} from "./useReminderPreviewsAdmin";

afterEach(cleanup);

const requests: unknown[] = [];

serveApi(
  routes({
    "POST /actions/previewEmailHtml/:eventId": async ({ request, params }) => {
      const body: PreviewEmailHtmlDto = await request.json();
      requests.push({ ...params, ...body });
      return Response.json({
        subject: `${body.emailSubject} (${body.taskCount})`,
        html: `<p>${body.emailMessage}</p>`,
      });
    },
    "POST /actions/previewTextMessage/:eventId": async ({
      request,
      params,
    }) => {
      const body: PreviewTextDto = await request.json();
      requests.push({ ...params, ...body });
      return Response.json({ text: `${body.textMessage} (${body.taskCount})` });
    },
  }),
);

afterEach(() => {
  requests.length = 0;
});

describe("useReminderEmailPreviewAdmin", () => {
  it("renders the email for the event", async () => {
    const view = renderHook(
      () =>
        useReminderEmailPreviewAdmin(3, {
          emailMessage: "Hello",
          emailSubject: "Hi",
          taskCount: 2,
        }),
      queryWrapper(),
    );

    await waitFor(() =>
      expect(view.result.current.data).toEqual({
        subject: "Hi (2)",
        html: "<p>Hello</p>",
      }),
    );
    expect(requests).toEqual([
      { eventId: "3", emailMessage: "Hello", emailSubject: "Hi", taskCount: 2 },
    ]);
  });

  it("does not load without a preview", () => {
    const view = renderHook(
      () => useReminderEmailPreviewAdmin(3, null),
      queryWrapper(),
    );

    expect(view.result.current.fetchStatus).toBe("idle");
    expect(requests).toEqual([]);
  });
});

describe("useReminderTextPreviewAdmin", () => {
  it("renders the message for the event", async () => {
    const view = renderHook(
      () => useReminderTextPreviewAdmin(3, { textMessage: "Go", taskCount: 1 }),
      queryWrapper(),
    );

    await waitFor(() => expect(view.result.current.data).toBe("Go (1)"));
    expect(requests).toEqual([
      { eventId: "3", textMessage: "Go", taskCount: 1 },
    ]);
  });

  it("does not load without an event", () => {
    const view = renderHook(
      () =>
        useReminderTextPreviewAdmin(null, { textMessage: "Go", taskCount: 1 }),
      queryWrapper(),
    );

    expect(view.result.current.fetchStatus).toBe("idle");
    expect(requests).toEqual([]);
  });

  it("shares one request between identical previews", async () => {
    const query = queryWrapper();
    const preview = { textMessage: "Go", taskCount: 1 };
    const view = renderHook(
      () => [
        useReminderTextPreviewAdmin(3, preview),
        useReminderTextPreviewAdmin(3, { ...preview }),
      ],
      query,
    );

    await waitFor(() =>
      expect(view.result.current.map((result) => result.data)).toEqual([
        "Go (1)",
        "Go (1)",
      ]),
    );
    expect(requests).toHaveLength(1);
  });
});
