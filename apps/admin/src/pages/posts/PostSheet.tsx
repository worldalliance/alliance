import type { PostDto } from "@alliance/shared/client";
import { ChevronDown, ChevronUp } from "lucide-react";
import { formatDate } from "../../lib/formatDate";
import { LAUNCH_TIME_ZONE } from "../../lib/launchTimeZone";
import Button, { ButtonVariant } from "../../ui/Button";
import { EmptyState } from "../../ui/EmptyState";
import { PersonChip } from "../../ui/PersonCell";
import Sheet from "../../ui/Sheet";
import { PostSettingsForm } from "./PostSettingsForm";

/**
 * The open post's settings. `post` is `null` when the URL names a post the
 * list doesn't hold.
 */
export function PostSheet({
  post,
  onClose,
  onStep,
  position,
}: {
  post: PostDto | null;
  onClose: () => void;
  onStep: (to: PostDto) => void;
  position: { previous?: PostDto; next?: PostDto };
}) {
  return (
    <Sheet
      open
      onClose={onClose}
      title={post ? post.title : "Post not found"}
      headerActions={
        post && (
          <>
            <Button
              size="small"
              variant={ButtonVariant.Ghost}
              aria-label="Previous post"
              title="Previous post"
              disabled={!position.previous}
              onClick={() => position.previous && onStep(position.previous)}
            >
              <ChevronUp aria-hidden="true" className="size-4" />
            </Button>
            <Button
              size="small"
              variant={ButtonVariant.Ghost}
              aria-label="Next post"
              title="Next post"
              disabled={!position.next}
              onClick={() => position.next && onStep(position.next)}
            >
              <ChevronDown aria-hidden="true" className="size-4" />
            </Button>
          </>
        )
      }
    >
      {post ? (
        <>
          <p className="flex flex-wrap items-center gap-x-1.5 border-b border-line px-card py-3 text-fg-muted">
            By
            <PersonChip
              userId={post.author.id}
              name={post.author.displayName}
              profilePicture={post.author.profilePicture}
              link
            />
            · {formatDate(post.createdAt, { timeZone: LAUNCH_TIME_ZONE })}
          </p>
          <PostSettingsForm key={post.id} post={post} />
        </>
      ) : (
        <EmptyState
          title="Post not found"
          description="It isn't among the forum's posts. It may have been deleted."
          action={
            <Button variant={ButtonVariant.Default} onClick={onClose}>
              Back to forum posts
            </Button>
          }
        />
      )}
    </Sheet>
  );
}
