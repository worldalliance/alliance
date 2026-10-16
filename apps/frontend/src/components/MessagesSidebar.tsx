import type { ConversationDto } from "@alliance/shared/client";
import {
  getConversationPreview,
  getMessageRequestPreview,
} from "@alliance/shared/lib/conversations";
import { cn } from "@alliance/shared/styles/util";
import { AvatarProfile } from "@alliance/sharedweb/ui/Avatar";
import Button, { ButtonColor } from "@alliance/sharedweb/ui/Button";
import { Plus } from "lucide-react";

export interface MessagesSidebarProps {
  conversations: ConversationDto[];
  pendingInvites: ConversationDto[];
  selectedConvoId: number | null;
  currentUserId: number | undefined;
  search: string;
  onSearchChange: (search: string) => void;
  onSelect: (conversationId: number) => () => void;
  onCreate: () => void;
}

const MessagesSidebar = ({
  conversations,
  pendingInvites,
  selectedConvoId,
  currentUserId,
  search,
  onSearchChange,
  onSelect,
  onCreate,
}: MessagesSidebarProps) => {
  const filteredConversations = conversations.filter((convo) =>
    convo.title.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div>
      <div className="p-4">
        <div className="flex flex-row items-center justify-between gap-x-2 mb-3">
          <p className="text-2xl font-semibold">Chats</p>
          <Button
            color={ButtonColor.Transparent}
            size="small"
            onClick={onCreate}
            className="!px-2"
            title="New chat"
          >
            <Plus size="18" />
          </Button>
        </div>
        <input
          placeholder="Search"
          className="w-full rounded-md p-2 !bg-zinc-100 text-black focus:outline-none text-[16px]"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          autoFocus
        />
      </div>
      <div>
        {pendingInvites.length > 0 && (
          <div className="mt-2">
            <p className="text-sm text-zinc-500 font-medium px-4">
              New message requests
            </p>
            <div className="flex flex-col mt-2">
              {pendingInvites.map((conversation) => (
                <div
                  key={conversation.id}
                  className={cn(
                    "p-4 hover:bg-zinc-50 cursor-pointer rounded-lg mx-2 flex flex-row justify-between items-center gap-x-3 transition-colors",
                    selectedConvoId === conversation.id
                      ? "bg-zinc-100"
                      : "bg-white",
                  )}
                  onClick={onSelect(conversation.id)}
                >
                  <div className="flex flex-row items-center gap-x-3">
                    <AvatarProfile
                      pfp={conversation.photo ?? null}
                      size="large"
                    />
                    <div className="flex flex-col">
                      <span className="font-medium line-clamp-2">
                        {conversation.title}
                      </span>
                      <span className="text-sm text-zinc-500 line-clamp-1">
                        {getMessageRequestPreview(conversation)}
                      </span>
                    </div>
                  </div>
                  <div className="font-semibold text-xs text-white bg-red-500 rounded-md flex justify-center items-center w-6 h-6 shrink-0">
                    {conversation.unreadCount || 1}
                  </div>
                </div>
              ))}
            </div>
            <p className="text-sm text-zinc-500 font-medium px-4 py-2">
              Conversations
            </p>
          </div>
        )}
        {filteredConversations.map((conversation) => (
          <div
            key={conversation.id}
            className={cn(
              "p-4 hover:bg-zinc-50 cursor-pointer rounded-lg mx-2 flex flex-row justify-between items-center gap-x-3 transition-colors",
              selectedConvoId === conversation.id ? "bg-zinc-100" : "bg-white",
            )}
            onClick={onSelect(conversation.id)}
          >
            <div className="flex flex-row items-center gap-x-3">
              <AvatarProfile pfp={conversation.photo ?? null} size="large" />
              <div className="flex flex-col">
                <span className="font-medium line-clamp-1">
                  {conversation.title}
                </span>
                <span className="text-sm text-zinc-500 line-clamp-1">
                  {getConversationPreview(conversation, currentUserId)}
                </span>
              </div>
            </div>
            <div>
              {conversation.unreadCount > 0 && (
                <div className="font-semibold text-xs text-white bg-red-500 rounded-md flex justify-center items-center w-6 h-6">
                  {conversation.unreadCount}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default MessagesSidebar;
