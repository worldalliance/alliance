import { UnrenderableReason } from "@alliance/common/forms/unrenderable";
import {
  CONTENT_PROBLEM_ADVICE,
  ReportUnrenderable,
  UnrenderableSubject,
  unrenderableTitle,
  type UnrenderableContent,
} from "@alliance/shared/forms/unrenderable";
import Button, { ButtonColor } from "../ui/Button";

const MEMBER_ADVICE: Record<UnrenderableReason, string | null> = {
  [UnrenderableReason.OutdatedClient]: null,
  [UnrenderableReason.ContentProblem]: CONTENT_PROBLEM_ADVICE,
};

const OFFERS_RELOAD: Record<UnrenderableReason, boolean> = {
  [UnrenderableReason.OutdatedClient]: true,
  [UnrenderableReason.ContentProblem]: false,
};

export default function UnrenderableNotice({
  subject,
  reason,
  detail = null,
  content,
  showDetail = false,
}: {
  subject: UnrenderableSubject;
  reason: UnrenderableReason;
  detail?: string | null;
  content: UnrenderableContent;
  /** For admin views: a neutral title and `detail` in place of member advice, unreported. */
  showDetail?: boolean;
}) {
  return (
    <div
      className="flex flex-col items-start gap-3 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-amber-900"
      role="alert"
    >
      {!showDetail && (
        <ReportUnrenderable
          subject={subject}
          reason={reason}
          detail={detail}
          content={content}
        />
      )}
      <div>
        <p className="font-medium">
          {showDetail
            ? `This ${subject} can't be displayed`
            : unrenderableTitle(subject, reason)}
        </p>
        {showDetail && detail !== null ? (
          <p className="mt-1 text-sm">{detail}</p>
        ) : (
          MEMBER_ADVICE[reason] !== null && (
            <p className="mt-1 text-sm">{MEMBER_ADVICE[reason]}</p>
          )
        )}
      </div>
      {OFFERS_RELOAD[reason] && (
        <Button
          color={ButtonColor.Black}
          onClick={() => window.location.reload()}
        >
          Reload page
        </Button>
      )}
    </div>
  );
}
