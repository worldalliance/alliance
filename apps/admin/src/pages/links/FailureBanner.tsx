import Button, { ButtonVariant } from "../../ui/Button";
import { Banner, BannerTone } from "../../ui/templates/Banner";

/** A failed write from a row, said once at the head of the tab until dismissed. */
export function FailureBanner({
  message,
  onDismiss,
}: {
  message: string | null;
  onDismiss: () => void;
}) {
  if (!message) return null;
  return (
    <Banner
      tone={BannerTone.Danger}
      action={
        <Button size="small" variant={ButtonVariant.Ghost} onClick={onDismiss}>
          Dismiss
        </Button>
      }
    >
      {message}
    </Banner>
  );
}
