import { ExceptionEvent } from "@alliance/common/analytics";
import { refusalMessage } from "@alliance/common/errorMessage";
import { R, type Result } from "@alliance/common/result";
import { captureException } from "./analytics";

const TRY_AGAIN = "Please try again.";

export interface Explanation {
  title: string;
  message: string;
}

/** Sends a generated-client request, and explains a rejection or a refusal in
 * words for the user. `action` finishes "Couldn't …", as in "leave the group". */
export async function sendOrExplain<O, T>(params: {
  send: (options: O & { throwOnError: false }) => Promise<
    ({ data: T; error: undefined } | { data: undefined; error: object }) & {
      response: Response;
    }
  >;
  options: O;
  action: string;
}): Promise<Result<T, Explanation>> {
  const { send, options, action } = params;
  const title = `Couldn't ${action}`;
  // Mobile's client throws on a refusal, and the thrown body has no status.
  const sent = await R.fromPromise(send({ ...options, throwOnError: false }));
  if (!sent.ok) {
    console.error(`Failed to ${action}`, sent.error);
    captureException(ExceptionEvent.RequestFailed, sent.error, { action });
    return R.failure({ title, message: TRY_AGAIN });
  }
  const { data, error, response } = sent.value;
  if (error) {
    console.error(`The server refused to ${action}`, error);
    captureException(ExceptionEvent.RequestFailed, error, {
      action,
      status: response.status,
    });
    return R.failure({
      title,
      message: refusalMessage({
        status: response.status,
        error,
        fallback: TRY_AGAIN,
        sessionExpired: `Your session has expired. Sign in again to ${action}.`,
      }),
    });
  }
  return R.success(data);
}
