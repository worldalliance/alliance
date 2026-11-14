import { KORA_REVIEW_PATH } from "@alliance/common/kora";
import type { ActionDto } from "@alliance/shared/client";
import { canCompleteAction } from "@alliance/shared/lib/actionUtils";
import { KORA_ACTION_COPY } from "@alliance/shared/lib/koraAction";
import { Link } from "react-router";

const LINK =
  "inline-flex min-h-11 items-center self-start rounded-lg bg-black px-5 font-medium text-white";

/** The task panel of a Kora review action: reviews happen on the review page, not in a form. */
export default function KoraActionTask({ action }: { action: ActionDto }) {
  if (action.viewer?.relation === "completed") {
    return (
      <section className="flex flex-col gap-3" aria-labelledby="kora-task">
        <h2 id="kora-task" className="text-xl font-semibold">
          {KORA_ACTION_COPY.completeHeading}
        </h2>
        <p>{KORA_ACTION_COPY.continueNote}</p>
        <Link to={KORA_REVIEW_PATH} className={LINK}>
          {KORA_ACTION_COPY.reviewMore}
        </Link>
      </section>
    );
  }
  return (
    <section className="flex flex-col gap-3" aria-labelledby="kora-task">
      <h2 id="kora-task" className="text-xl font-semibold">
        {KORA_ACTION_COPY.heading}
      </h2>
      <p>{KORA_ACTION_COPY.intro(action.timeEstimate)}</p>
      {canCompleteAction(action) && (
        <Link to={KORA_REVIEW_PATH} className={LINK}>
          {KORA_ACTION_COPY.start}
        </Link>
      )}
    </section>
  );
}
