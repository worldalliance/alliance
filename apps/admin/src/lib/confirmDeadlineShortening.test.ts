import { describe, expect, it, mock } from "bun:test";
import { sendConfirmingDeadlineShortening } from "./confirmDeadlineShortening";

type Query = { acknowledgeDeadlineShortening?: boolean };
type ConfirmOptions = {
  title: string;
  message: string;
  confirmLabel: string;
};

const reply = (status: number, error?: unknown) => ({
  response: new Response(null, { status }),
  error,
});

describe("sendConfirmingDeadlineShortening", () => {
  it("returns a result the server accepted without asking", async () => {
    const send = mock(async (_query: Query) => reply(200));
    const confirm = mock(async (_opts: ConfirmOptions) => true);

    const result = await sendConfirmingDeadlineShortening({ send, confirm });

    expect(result?.response.status).toBe(200);
    expect(confirm).not.toHaveBeenCalled();
    expect(send.mock.calls).toEqual([[{}]]);
  });

  it("shows the server's explanation and resends acknowledged once confirmed", async () => {
    const send = mock(async (query: Query) =>
      "acknowledgeDeadlineShortening" in query
        ? reply(200)
        : reply(409, { message: '"Action" (3 assigned)' }),
    );
    const confirm = mock(async (_opts: ConfirmOptions) => true);

    const result = await sendConfirmingDeadlineShortening({ send, confirm });

    expect(result?.response.status).toBe(200);
    expect(confirm.mock.calls[0]).toEqual([
      {
        title: "Move the deadline earlier?",
        message: '"Action" (3 assigned)',
        confirmLabel: "Move deadline earlier",
      },
    ]);
    expect(send.mock.calls).toEqual([
      [{}],
      [{ acknowledgeDeadlineShortening: true }],
    ]);
  });

  it("sends nothing more when staff decline", async () => {
    const send = mock(async (_query: Query) => reply(409));
    const confirm = mock(async (_opts: ConfirmOptions) => false);

    expect(await sendConfirmingDeadlineShortening({ send, confirm })).toBe(
      null,
    );
    expect(send).toHaveBeenCalledTimes(1);
  });
});
