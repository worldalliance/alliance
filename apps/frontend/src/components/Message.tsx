import type { MessageDto } from "@alliance/shared/client";
import Button, { ButtonColor } from "@alliance/sharedweb/ui/Button";
import ProfileImage from "@alliance/sharedweb/ui/ProfileImage";
import { Reply, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Link, href } from "react-router";
import UserDisplayName from "@alliance/sharedweb/ui/UserDisplayName";
import { formatTime } from "@alliance/shared/lib/utils";
import AppMarkdownWrapper from "@alliance/sharedweb/ui/AppMarkdownWrapper";

const Message = ({
  message,
  className,
  isFirstInGroup,
  isFocused,
  setReplyingTo,
  isFirstInReplyGroup,
  handleFocusReply,
  ref,
}: {
  message: MessageDto;
  className?: string;
  isFirstInGroup?: boolean;
  isFirstInReplyGroup?: boolean;
  isFocused?: boolean;
  setReplyingTo: (messageId: string) => void;
  handleFocusReply: (messageId: string) => void;
  ref: React.RefObject<HTMLDivElement | null> | null;
}) => {
  const attachments = message.attachments ?? [];
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const lightboxSrc =
    lightboxIndex !== null ? attachments[lightboxIndex] : null;

  useEffect(() => {
    if (lightboxIndex === null) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setLightboxIndex(null);
      } else if (e.key === "ArrowRight" && attachments.length > 1) {
        setLightboxIndex((idx) =>
          idx === null ? 0 : (idx + 1 + attachments.length) % attachments.length
        );
      } else if (e.key === "ArrowLeft" && attachments.length > 1) {
        setLightboxIndex((idx) =>
          idx === null ? 0 : (idx - 1 + attachments.length) % attachments.length
        );
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [attachments.length, lightboxIndex]);

  const handleReplyTo = useCallback(() => {
    setReplyingTo(message.id);
  }, [message.id, setReplyingTo]);

  return (
    <>
      <div
        className={`${className} bg-white hover:bg-zinc-100 items-start rounded-md flex flex-col px-2 py-1 group relative ${isFirstInGroup ? "pt-2" : "pt-1 pr-7"
          } ${isFocused ? "!bg-green/20" : ""}`}
        ref={ref}
      >
        {message.replyTo && isFirstInReplyGroup && (
          <div
            className="text-zinc-500 text-sm flex flex-row items-center gap-x-1 my-1 cursor-pointer ml-9"
            onClick={() => handleFocusReply(message.replyTo!.id)}
          >
            <Reply size={15} />
            <ProfileImage
              pfp={message.replyTo.author.profilePicture}
              size="mini"
            />
            Replying to: {message.replyTo.body || "image"}
          </div>
        )}
        <div className="flex flex-row gap-x-3">
          <div className="w-8 shrink-0 mt-1">
            {isFirstInGroup && (
              <Link
                to={href("/member/:id", { id: message.author.id.toString() })}
              >
                <ProfileImage
                  pfp={message.author.profilePicture}
                  size="medium"
                />
              </Link>
            )}
          </div>
          <div className="flex flex-col">
            {isFirstInGroup && (
              <div className="flex flex-row items-center">
                <Link
                  to={href("/member/:id", { id: message.author.id.toString() })}
                  className="font-medium"
                >
                  <UserDisplayName
                    staff={message.author.staff}
                    grouplead={message.author.isCommunityLeader}
                  >
                    {message.author.displayName}
                  </UserDisplayName>
                </Link>
                {message.createdAt && (
                  <span className="text-zinc-500 text-sm ml-2 mt-px">
                    {formatTime(new Date(message.createdAt), {
                      addSuffix: true,
                    }).replace("less than a minute ago", "now")}
                  </span>
                )}
              </div>
            )}
            {message.body && (
              <AppMarkdownWrapper markdownContent={message.body} />
            )}
            {attachments.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {attachments.map((attachment, idx) => (
                  <img
                    key={`${message.id}-attachment-${idx}`}
                    src={attachment}
                    onClick={() => setLightboxIndex(idx)}
                    className="w-28 h-28 object-cover rounded border border-zinc-200 cursor-zoom-in"
                  />
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="absolute top-0 right-0 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button
            color={ButtonColor.Transparent}
            onClick={handleReplyTo}
            size="small"
            className="!px-2"
          >
            <Reply size={18} />
          </Button>
        </div>
      </div>

      {lightboxSrc && (
        <div
          className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center px-4"
          onClick={() => setLightboxIndex(null)}
        >
          <div
            className="relative max-h-[90vh] max-w-[90vw]"
            onClick={(e) => e.stopPropagation()}
          >
            <Button
              color={ButtonColor.Transparent}
              onClick={() => setLightboxIndex(null)}
              className="absolute -top-1 -right-9 text-white"
              aria-label="Close"
            >
              <X size={20} />
            </Button>
            <img
              src={lightboxSrc}
              className="max-h-[90vh] max-w-[90vw] object-contain"
            />
          </div>
        </div>
      )}
    </>
  );
};

export default Message;
