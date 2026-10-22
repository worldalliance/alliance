import { errorMessage } from "@alliance/common/errorMessage";

type ScheduleQuery = { acknowledgeDeadlineShortening?: boolean };

/**
 * Sends a schedule edit. When the server refuses it because it moves assigned
 * members' deadline earlier (409), asks staff with the server's explanation
 * and resends it acknowledged. Resolves `null` if staff decline.
 */
export async function sendConfirmingDeadlineShortening<
  T extends { error?: unknown; response?: Response },
>(params: {
  send: (query: ScheduleQuery) => Promise<T>;
  confirm: (opts: {
    title: string;
    message: string;
    confirmLabel: string;
  }) => Promise<boolean>;
}): Promise<T | null> {
  const { send, confirm } = params;
  const first = await send({});
  if (first.response?.status !== 409) return first;
  const confirmed = await confirm({
    title: "Move the deadline earlier?",
    message: errorMessage({
      error: first.error,
      fallback: "This moves the deadline earlier for assigned members.",
    }),
    confirmLabel: "Move deadline earlier",
  });
  return confirmed ? send({ acknowledgeDeadlineShortening: true }) : null;
}
