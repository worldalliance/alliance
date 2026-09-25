import { CONVERSATION_TITLE_MAX_LENGTH } from "@alliance/common/conversation";
import {
  conversationAddParticipant,
  ConversationDto,
  conversationLeave,
  conversationRemoveParticipant,
  conversationUpdateInfo,
  ProfileDto,
} from "@alliance/shared/client";
import {
  canEditConversationInfo,
  canEditConversationMembers,
  canLeaveConversation,
} from "@alliance/shared/lib/messages";
import {
  type Explanation,
  sendOrExplain,
} from "@alliance/shared/lib/sendOrExplain";
import { useOneAtATime } from "@alliance/shared/lib/useOneAtATime";
import { CardStyle } from "@alliance/shared/styles/card";
import { cn } from "@alliance/shared/styles/util";
import { sharp_allowed_mime_types } from "@alliance/sharedweb/lib/config";
import { AvatarProfile } from "@alliance/sharedweb/ui/Avatar";
import Button, { ButtonColor } from "@alliance/sharedweb/ui/Button";
import Card from "@alliance/sharedweb/ui/Card";
import CharacterLimitNotice from "@alliance/sharedweb/ui/CharacterLimitNotice";
import List from "@alliance/sharedweb/ui/List";
import Spinner from "@alliance/sharedweb/ui/Spinner";
import { milliseconds } from "date-fns";
import { ChevronLeft, ChevronRight, SquarePen, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { href, Link } from "react-router";
import { useAuth } from "../lib/AuthContext";
import ImageEditor from "./ImageEditor";
import LoadFailed from "./LoadFailed";

export interface ConversationInfoPanelProps {
  selectedConvo: ConversationDto;
  handleConversationUpdated: (conversation: ConversationDto) => void;
  friends: ProfileDto[] | null;
  friendsFailure: { onRetry: () => void; retrying: boolean } | null;
  onLeave: () => void;
  onClose: () => void;
}

const ConversationInfoPanel = ({
  selectedConvo,
  handleConversationUpdated,
  friends,
  friendsFailure,
  onLeave,
  onClose,
}: ConversationInfoPanelProps) => {
  const { user } = useAuth();

  const canEditInfo = canEditConversationInfo(selectedConvo, user?.id);
  const canEditMembers = canEditConversationMembers(selectedConvo, user?.id);

  const [addMemberSearch, setAddMemberSearch] = useState<string>("");
  const [isEditingGroup, setIsEditingGroup] = useState<boolean>(false);
  const [editingGroupTitle, setEditingGroupTitle] = useState<string>("");
  const [editingGroupPhoto, setEditingGroupPhoto] = useState<string | null>(
    null,
  );
  const { busy: changingMembers, run: changeMembers } = useOneAtATime();
  const [error, setError] = useState<string | null>(null);
  const showExplanation = ({ title, message }: Explanation) =>
    setError(`${title}. ${message}`);

  useEffect(() => {
    if (!canEditInfo) setIsEditingGroup(false);
  }, [canEditInfo]);

  const handleRemoveParticipant = (userId: number) =>
    changeMembers(async () => {
      setError(null);
      const removed = await sendOrExplain({
        send: conversationRemoveParticipant,
        options: {
          path: { conversationId: selectedConvo.id, userId },
        },
        action: "remove that member",
      });
      if (!removed.ok) {
        showExplanation(removed.error);
        return;
      }
      handleConversationUpdated(removed.value);
    });

  const handleLeaveGroup = () =>
    changeMembers(async () => {
      setError(null);
      const left = await sendOrExplain({
        send: conversationLeave,
        options: {
          path: { conversationId: selectedConvo.id },
        },
        action: "leave the group",
      });
      if (!left.ok) {
        showExplanation(left.error);
        return;
      }
      onLeave();
    });

  const filteredFriends = useMemo(() => {
    if (addMemberSearch.length === 0) return [];
    return friends?.filter(
      (friend) =>
        friend.displayName
          .toLowerCase()
          .includes(addMemberSearch.toLowerCase()) &&
        !selectedConvo.participants.some(
          (participant) => participant.user.id === friend.id,
        ),
    );
  }, [friends, addMemberSearch, selectedConvo.participants]);

  const [justAddedMember, setJustAddedMember] = useState<number | null>(null);
  const { busy: isSaving, run: save } = useOneAtATime();

  useEffect(() => {
    if (justAddedMember) {
      setTimeout(
        () => {
          setJustAddedMember(null);
        },
        milliseconds({ seconds: 2 }),
      );
    }
  }, [justAddedMember]);

  const handleSaveGroup = () =>
    save(async () => {
      setError(null);
      const saved = await sendOrExplain({
        send: conversationUpdateInfo,
        options: {
          path: { conversationId: selectedConvo.id },
          body: {
            title: editingGroupTitle,
            photo: editingGroupPhoto ?? undefined,
          },
        },
        action: "save the group",
      });
      if (!saved.ok) {
        showExplanation(saved.error);
        return;
      }
      handleConversationUpdated(saved.value);
      setIsEditingGroup(false);
    });

  const handleAddMember = (userId: number) =>
    changeMembers(async () => {
      setError(null);
      const added = await sendOrExplain({
        send: conversationAddParticipant,
        options: {
          path: { conversationId: selectedConvo.id },
          body: { userId },
        },
        action: "add that member",
      });
      if (!added.ok) {
        showExplanation(added.error);
        return;
      }
      handleConversationUpdated(added.value);
      setAddMemberSearch("");
      setJustAddedMember(userId);
    });

  return (
    <div className="flex flex-col min-h-0 my-auto">
      {error && (
        <p role="alert" className="text-red-500 px-14 py-2 text-center">
          {error}
        </p>
      )}
      <div className="overflow-y-auto relative flex flex-col items-center">
        <div className="flex flex-col items-center px-8 w-full gap-y-2 mt-20">
          {isEditingGroup ? (
            <ImageEditor
              key={0}
              className="mt-[-55px]"
              initialImageUrl={editingGroupPhoto}
              onChange={setEditingGroupPhoto}
              allowedMimeTypes={sharp_allowed_mime_types}
            />
          ) : (
            <AvatarProfile
              pfp={selectedConvo.photo ?? null}
              size="huge"
              className="mb-2"
            />
          )}
          {selectedConvo.type === "direct" ? (
            <>
              <Link
                to={href(`/member/:id`, {
                  id: selectedConvo.participants
                    .find((participant) => participant.user.id !== user?.id)!
                    .user.id.toString(),
                })}
                className="flex flex-row p-2 gap-2 hover:bg-zinc-100 rounded-md pl-4 items-center"
              >
                <p className="font-semibold text-xl text-center">
                  {selectedConvo.title}
                </p>
                <div>
                  <ChevronRight size="20" />
                </div>
              </Link>
              <p className="text-sm text-zinc-500">Direct message</p>
            </>
          ) : isEditingGroup ? (
            <div className="flex flex-row items-center gap-x-5">
              <div className="flex flex-col items-center">
                <input
                  type="text"
                  className="font-semibold text-xl text-center active:outline-none focus:outline-none border-b border-zinc-200 pb-1"
                  value={editingGroupTitle}
                  maxLength={CONVERSATION_TITLE_MAX_LENGTH}
                  onChange={(e) => setEditingGroupTitle(e.target.value)}
                />
                <CharacterLimitNotice
                  value={editingGroupTitle}
                  max={CONVERSATION_TITLE_MAX_LENGTH}
                />
              </div>
              <Button
                color={ButtonColor.Stone}
                onClick={handleSaveGroup}
                disabled={isSaving || !editingGroupTitle.trim()}
                className="flex flex-row items-center gap-x-2"
              >
                {isSaving && <Spinner size="small" />}
                Save
              </Button>
            </div>
          ) : (
            <div className="flex flex-row items-center gap-x-1">
              <p className="font-semibold text-xl text-center break-words max-w-[500px]">
                {selectedConvo.title}
              </p>
              {canEditInfo && (
                <button
                  type="button"
                  aria-label="Edit group"
                  className="cursor-pointer hover:bg-zinc-100 rounded-md p-2"
                  onClick={() => {
                    setEditingGroupTitle(selectedConvo.title);
                    setEditingGroupPhoto(selectedConvo.photo ?? null);
                    setIsEditingGroup(true);
                  }}
                >
                  <SquarePen className="h-4 w-4 text-zinc-500" />
                </button>
              )}
            </div>
          )}
        </div>
        {selectedConvo.type !== "direct" && (
          <div className="flex flex-col p-2 px-5 gap-4 w-full items-center max-w-[500px] mb-20">
            <p className="text-center">
              {selectedConvo.participants.length} members
            </p>

            {selectedConvo.type === "community" && (
              <p className="text-sm center">
                <span className="text-zinc-500">
                  This is a chat with everyone in
                </span>{" "}
                <Link
                  to={href("/groups")}
                  className="text-green hover:underline"
                >
                  {selectedConvo.community?.name}
                </Link>
              </p>
            )}
            <List className="w-full">
              {selectedConvo.participants.map((participant) => (
                <div
                  key={participant.user.id}
                  className="hover:bg-zinc-100 flex flex-row items-center"
                >
                  <Link
                    to={href("/member/:id", {
                      id: participant.user.id.toString(),
                    })}
                    className="p-4 flex-1 flex flex-row items-center gap-x-3 justify-between"
                  >
                    <div className="flex flex-row items-center gap-x-3">
                      <AvatarProfile
                        pfp={participant.user.profilePicture}
                        size="large"
                      />
                      <p>{participant.user.displayName}</p>
                    </div>
                    {participant.state == "invited" &&
                      (justAddedMember === participant.user.id ? (
                        <p className="text-green">Invite sent!</p>
                      ) : (
                        <p className="text-zinc-500">Invited</p>
                      ))}
                  </Link>
                  {canEditMembers && participant.user.id !== user?.id && (
                    <Button
                      color={ButtonColor.Transparent}
                      title={`Remove ${participant.user.displayName}`}
                      onClick={() => {
                        handleRemoveParticipant(participant.user.id);
                      }}
                      disabled={changingMembers}
                      className="hover:!bg-zinc-200 !px-2 mr-4"
                    >
                      <X size="18" color="var(--color-red-400)" />
                    </Button>
                  )}
                </div>
              ))}
            </List>
            {canEditMembers && friendsFailure && (
              <LoadFailed
                message="Couldn't load the people you can add."
                {...friendsFailure}
              />
            )}
            {canEditMembers && !friendsFailure && (
              <Card
                style={CardStyle.LightGrey}
                className="w-full !p-0 relative group"
              >
                <input
                  type="text"
                  placeholder={
                    friends === null ? "Loading members..." : "Add member..."
                  }
                  disabled={friends === null}
                  className="text-zinc-800 !bg-transparent p-4 active:outline-none focus:outline-none"
                  value={addMemberSearch}
                  onChange={(e) => setAddMemberSearch(e.target.value)}
                />
                {filteredFriends && filteredFriends.length > 0 && (
                  <div className="absolute top-full bg-white w-full border border-zinc-200 rounded rounded-t-none">
                    {filteredFriends.map((friend) => (
                      <div
                        key={friend.id}
                        className={cn(
                          "flex flex-row items-center gap-x-3 cursor-pointer hover:bg-zinc-100 p-4 rounded-md",
                          changingMembers &&
                            "opacity-50 cursor-not-allowed pointer-events-none",
                        )}
                        onClick={() => {
                          handleAddMember(friend.id);
                        }}
                      >
                        <AvatarProfile
                          pfp={friend.profilePicture}
                          size="large"
                        />
                        <p>{friend.displayName}</p>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            )}

            {canLeaveConversation(selectedConvo) && (
              <Button
                color={ButtonColor.Transparent}
                onClick={handleLeaveGroup}
                disabled={changingMembers}
                className="self-end text-zinc-500"
              >
                Leave group
              </Button>
            )}
          </div>
        )}
      </div>
      <Button
        color={ButtonColor.Transparent}
        onClick={onClose}
        className="!px-2 !py-2 mx-auto absolute! top-5 left-5"
      >
        <ChevronLeft size="20" />
      </Button>
    </div>
  );
};

export default ConversationInfoPanel;
