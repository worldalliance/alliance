import { R } from "@alliance/common/result";
import type { Logger } from "@nestjs/common";

export async function sendBestEffort(params: {
  logger: Logger;
  what: string;
  send: () => Promise<unknown>;
}): Promise<void> {
  const { logger, what, send } = params;
  const sent = await R.fromPromiseFn(send);
  if (R.isFailure(sent)) {
    logger.error(`Failed to send ${what}`, sent.error);
  }
}
