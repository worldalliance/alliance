import Button, { ButtonVariant } from "../ui/Button";
import { Banner, BannerTone } from "../ui/templates/Banner";

type FailedLoadsBannerProps = {
  /** What failed, lower case: "users". */
  failed: string[];
  /** What the failure means for what is shown: "The graph is incomplete." */
  consequence: string;
  /** BACKCOMPAT(failed-loads-class): ignored, the banner brings its own frame; remove once ActionOverviewTab stops passing it. */
  className?: string;
  /** A box inside the body; false runs edge to edge as `Page`'s `banner`. */
  inline?: boolean;
  onRetry?: () => void;
  retrying?: boolean;
};

/** Names the parts of a page that failed to load, while the rest still renders. */
export const FailedLoadsBanner = ({
  failed,
  consequence,
  inline = true,
  onRetry,
  retrying,
}: FailedLoadsBannerProps) =>
  failed.length > 0 ? (
    <Banner
      tone={BannerTone.Danger}
      inline={inline}
      action={
        onRetry && (
          <Button
            size="small"
            variant={ButtonVariant.Ghost}
            busy={retrying}
            onClick={onRetry}
          >
            Try again
          </Button>
        )
      }
    >
      {`Couldn't load ${failed.join(", ")}. ${consequence}`}
    </Banner>
  ) : null;
