import { koraTranscriptPreviewHref } from "../../lib/hrefs";
import Button, { ButtonVariant } from "../../ui/Button";

export function PreviewLink({
  batchId,
  label = "Preview a random transcript",
}: {
  batchId: string;
  label?: string;
}) {
  return (
    <Button
      size="small"
      variant={ButtonVariant.Default}
      to={koraTranscriptPreviewHref(batchId)}
      aria-label={label}
    >
      Preview
    </Button>
  );
}
