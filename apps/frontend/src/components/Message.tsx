import type { MessageDto } from "@alliance/shared/client";
import { formatTime } from "@alliance/shared/lib/utils";
import { cn } from "@alliance/shared/styles/util";
import AppMarkdownWrapper from "@alliance/sharedweb/ui/AppMarkdownWrapper";
import { AvatarProfile } from "@alliance/sharedweb/ui/Avatar";
import Button, { ButtonColor } from "@alliance/sharedweb/ui/Button";
import { ImageThumbnailGrid } from "@alliance/sharedweb/ui/ImageLightbox";
import UserDisplayName from "@alliance/sharedweb/ui/UserDisplayName";
import { Reply } from "lucide-react";
import { useCallback } from "react";
import { Link, href } from "react-router";

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

  const handleReplyTo = useCallback(() => {
    setReplyingTo(message.id);
  }, [message.id, setReplyingTo]);

  return (
    <>
      <div
        className={cn(
          "bg-white hover:bg-zinc-100",
          "flex flex-col items-start",
          "rounded-md",
          "px-2 py-1",
          "group relative",
          isFirstInGroup ? "pt-2" : "pt-1 pr-7",
          isFocused && "!bg-green/20",
          className,
        )}
        ref={ref}
      >
        {message.replyTo && isFirstInReplyGroup && (
          <div
            className="text-zinc-500 text-sm flex flex-row items-center gap-x-1 my-1 cursor-pointer ml-9"
            onClick={() => handleFocusReply(message.replyTo!.id)}
          >
            <Reply size={15} />
            <AvatarProfile
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
                <AvatarProfile
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
                    ambassador={message.author.ambassador}
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
              <ImageThumbnailGrid
                images={attachments}
                className="mt-2"
                imageClassName="border border-zinc-200"
              />
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
    </>
  );
};

export default Message;
