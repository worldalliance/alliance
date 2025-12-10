import {
  conversationAddParticipant,
  ConversationDto,
  conversationLeave,
  conversationRemoveParticipant,
  conversationUpdateInfo,
  ProfileDto,
} from "@alliance/shared/client";
import ProfileImage from "@alliance/shared/ui/ProfileImage";
import { Link, href } from "react-router";
import Card, { CardStyle } from "@alliance/shared/ui/Card";
import List from "@alliance/shared/ui/List";
import Button, { ButtonColor } from "@alliance/shared/ui/Button";
import DeleteIcon from "@alliance/shared/ui/icons/DeleteIcon";
import { useAuth } from "../lib/AuthContext";
import { useEffect, useMemo, useState } from "react";
import CreateIcon from "@alliance/shared/ui/icons/CreateIcon";
import { sharp_allowed_mime_types } from "@alliance/shared/lib/config";
import ProfileImageEditor from "./ProfileImageEditor";
import { ChevronLeft, ChevronRight } from "lucide-react";
import Spinner from "./Spinner";

export interface ConversationInfoPanelProps {
  selectedConvo: ConversationDto;
  handleConversationUpdated: (conversation: ConversationDto) => void;
  friends: ProfileDto[] | null;
  isAdmin: boolean;
  onLeave: () => void;
  onClose: () => void;
}

const ConversationInfoPanel = ({
  selectedConvo,
  isAdmin,
  handleConversationUpdated,
  friends,
  onLeave,
  onClose,
}: ConversationInfoPanelProps) => {
  const { user } = useAuth();

  const participantMe = useMemo(() => {
    return selectedConvo.participants.find(
      (participant) => participant.user.id === user?.id
    );
  }, [selectedConvo, user]);

  const [addMemberSearch, setAddMemberSearch] = useState<string>("");
  const [isEditingGroup, setIsEditingGroup] = useState<boolean>(false);
  const [editingGroupTitle, setEditingGroupTitle] = useState<string>(
    selectedConvo.title
  );
  const [editingGroupPhoto, setEditingGroupPhoto] = useState<string | null>(
    selectedConvo.photo ?? null
  );

  const handleRemoveParticipant = async (userId: number) => {
    const response = await conversationRemoveParticipant({
      path: { conversationId: selectedConvo.id, userId },
    });
    if (response.data) {
      handleConversationUpdated(response.data);
    }
  };

  const handleLeaveGroup = async () => {
    const response = await conversationLeave({
      path: { conversationId: selectedConvo.id },
    });
    if (response.data) {
      onLeave();
    }
  };

  const filteredFriends = useMemo(() => {
    if (addMemberSearch.length === 0) return [];
    return friends?.filter(
      (friend) =>
        friend.displayName
          .toLowerCase()
          .includes(addMemberSearch.toLowerCase()) &&
        !selectedConvo.participants.some(
          (participant) => participant.user.id === friend.id
        )
    );
  }, [friends, addMemberSearch, selectedConvo.participants]);

  const [justAddedMember, setJustAddedMember] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (justAddedMember) {
      setTimeout(() => {
        setJustAddedMember(null);
      }, 2000);
    }
  }, [justAddedMember]);

  const handleSaveGroup = async () => {
    setIsSaving(true);
    const response = await conversationUpdateInfo({
      path: { conversationId: selectedConvo.id },
      body: { title: editingGroupTitle, photo: editingGroupPhoto ?? undefined },
    });
    if (response.data) {
      handleConversationUpdated(response.data);
      setIsEditingGroup(false);
      setEditingGroupTitle(response.data.title);
      setEditingGroupPhoto(response.data.photo ?? null);
    }
    setIsSaving(false);
  };

  const handleAddMember = async (userId: number) => {
    const response = await conversationAddParticipant({
      path: { conversationId: selectedConvo.id },
      body: { userId },
    });
    if (response.data) {
      handleConversationUpdated(response.data);
      setAddMemberSearch("");
      setJustAddedMember(userId);
    }
  };

  return (
    <div className="flex-1 relative flex flex-col items-center justify-center">
      <div className="flex flex-col items-center px-8 w-full gap-y-2 mt-20">
        {isEditingGroup ? (
          <ProfileImageEditor
            key={0}
            className="mt-[-55px]"
            initialImageUrl={editingGroupPhoto}
            onChange={setEditingGroupPhoto}
            allowedMimeTypes={sharp_allowed_mime_types}
          />
        ) : (
          <ProfileImage
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
            <input
              type="text"
              className="font-semibold text-xl text-center active:outline-none focus:outline-none border-b border-zinc-200 pb-1"
              disabled={selectedConvo.type === "community"}
              value={editingGroupTitle}
              onChange={(e) => setEditingGroupTitle(e.target.value)}
            />
            <Button
              color={ButtonColor.Stone}
              onClick={handleSaveGroup}
              disabled={isSaving}
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
            {selectedConvo.type !== "community" && (
              <div
                className="cursor-pointer hover:bg-zinc-100 rounded-md p-2"
                onClick={() => setIsEditingGroup(true)}
              >
                <CreateIcon size="medium" fill="var(--color-zinc-500)" />
              </div>
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
              <Link to={href("/groups")} className="text-green hover:underline">
                {selectedConvo.community?.name}
              </Link>
            </p>
          )}
          <List className={`w-full`}>
            {selectedConvo.participants.map((participant) => (
              <Link
                key={participant.user.id}
                to={href("/member/:id", { id: participant.user.id.toString() })}
                className="p-4 hover:bg-zinc-100 flex flex-row items-center gap-x-3 justify-between"
              >
                <div className="flex flex-row items-center gap-x-3">
                  <ProfileImage
                    pfp={participant.user.profilePicture}
                    size="large"
                  />
                  <p>{participant.user.displayName}</p>
                </div>
                {isAdmin &&
                  participant.user.id !== user?.id &&
                  selectedConvo.type === "multiple" && (
                    <Button
                      color={ButtonColor.Transparent}
                      onClick={(e) => {
                        e.preventDefault();
                        handleRemoveParticipant(participant.user.id);
                      }}
                      className="hover:!bg-zinc-200 !px-2"
                    >
                      <DeleteIcon size="large" fill="var(--color-red-400)" />
                    </Button>
                  )}
                {participant.state == "invited" &&
                  (justAddedMember === participant.user.id ? (
                    <p className="text-green">Invite sent!</p>
                  ) : (
                    <p className="text-zinc-500 mr-2">Invited</p>
                  ))}
              </Link>
            ))}
          </List>
          {selectedConvo.type === "multiple" &&
            (participantMe?.role === "admin" ||
              participantMe?.role === "owner") && (
              <Card
                style={CardStyle.LightGrey}
                className="w-full !p-0 relative group"
              >
                <input
                  type="text"
                  placeholder="Add member..."
                  className="text-zinc-800 !bg-transparent p-4 active:outline-none focus:outline-none"
                  value={addMemberSearch}
                  onChange={(e) => setAddMemberSearch(e.target.value)}
                />
                {filteredFriends && filteredFriends.length > 0 && (
                  <div className="absolute top-full bg-white w-full border border-zinc-200 rounded rounded-t-none">
                    {filteredFriends.map((friend) => (
                      <div
                        key={friend.id}
                        className="flex flex-row items-center gap-x-3 cursor-pointer hover:bg-zinc-100 p-4 rounded-md"
                        onClick={() => {
                          handleAddMember(friend.id);
                        }}
                      >
                        <ProfileImage
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

          {selectedConvo.type === "multiple" && (
            <Button
              color={ButtonColor.Transparent}
              onClick={handleLeaveGroup}
              className="self-end text-zinc-500"
            >
              Leave group
            </Button>
          )}
        </div>
      )}
      <Button
        color={ButtonColor.Transparent}
        onClick={onClose}
        className="!px-2 !py-2 mx-auto absolute top-5 left-5"
      >
        <ChevronLeft size="20" />
      </Button>
    </div>
  );
};

export default ConversationInfoPanel;
