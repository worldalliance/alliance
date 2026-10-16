import {
  COMMUNITY_DESCRIPTION_MAX_LENGTH,
  COMMUNITY_NAME_MAX_LENGTH,
} from "@alliance/common/community";
import { CommunityDto } from "@alliance/shared/client";
import { groupSettings } from "@alliance/shared/lib/copy";
import { sharp_allowed_mime_types } from "@alliance/sharedweb/lib/config";
import AppMarkdownWrapper from "@alliance/sharedweb/ui/AppMarkdownWrapper";
import { AvatarProfile } from "@alliance/sharedweb/ui/Avatar";
import Button, { ButtonColor } from "@alliance/sharedweb/ui/Button";
import CharacterLimitNotice from "@alliance/sharedweb/ui/CharacterLimitNotice";
import { CommunityEditor } from "../lib/useCommunityEditor";
import ImageEditor from "./ImageEditor";

const CommunityProfile = ({
  community,
  amLeader,
  memberCount,
  editor,
}: {
  community: CommunityDto;
  amLeader: boolean;
  memberCount: number;
  editor: CommunityEditor;
}) => {
  const {
    isEditing,
    setIsEditing,
    editName,
    setEditName,
    editDescription,
    setEditDescription,
    editPublic,
    setEditPublic,
    editAllowMemberInvites,
    setEditAllowMemberInvites,
    editAllowStaffAssignments,
    setEditAllowStaffAssignments,
    editMaxCapacity,
    setEditMaxCapacity,
    editPhotoUrl,
    setEditPhotoUrl,
    photoEditorKey,
    isSaving,
    error,
    isPhotoUploadPending,
    useMaxCapacity,
    handleSave,
    handleCancel,
    handleDelete,
  } = editor;
  const canDelete = amLeader && community.users.length === 1;

  return (
    <>
      {isEditing ? (
        <ImageEditor
          key={photoEditorKey}
          className="mt-[-55px]"
          initialImageUrl={editPhotoUrl}
          onChange={setEditPhotoUrl}
          canRemove
          allowedMimeTypes={sharp_allowed_mime_types}
          isUploading={isPhotoUploadPending}
        />
      ) : (
        <AvatarProfile
          pfp={community.photo ?? null}
          size="huge"
          className="mt-[-55px]"
        />
      )}
      <div className="absolute right-0 top-0 z-10 flex flex-row flex-wrap items-start justify-end gap-2 p-5">
        {amLeader && (
          <>
            {isEditing ? (
              <div className="flex flex-row flex-wrap justify-end gap-x-1 gap-y-1">
                {canDelete && (
                  <Button
                    color={ButtonColor.Red}
                    onClick={handleDelete}
                    disabled={isSaving}
                  >
                    Delete
                  </Button>
                )}
                <Button
                  color={ButtonColor.Light}
                  onClick={handleCancel}
                  disabled={isSaving}
                >
                  Cancel
                </Button>
                <Button
                  color={ButtonColor.Blue}
                  onClick={handleSave}
                  disabled={isSaving || !editName.trim()}
                >
                  {isSaving ? "Saving..." : "Save"}
                </Button>
              </div>
            ) : (
              <Button
                color={ButtonColor.White}
                onClick={() => setIsEditing(true)}
              >
                Edit
              </Button>
            )}
          </>
        )}
      </div>
      <div className="flex flex-col gap-y-4 mb-2 mt-3">
        {isEditing ? (
          <div className="flex flex-col gap-y-4">
            <div className="flex flex-col gap-1">
              <input
                type="text"
                value={editName}
                maxLength={COMMUNITY_NAME_MAX_LENGTH}
                onChange={(e) => setEditName(e.target.value)}
                className="text-title-small w-full border-none !bg-zinc-100 px-2 -mx-2 rounded focus:outline-none"
                placeholder="Enter group name"
              />
              <CharacterLimitNotice
                value={editName}
                max={COMMUNITY_NAME_MAX_LENGTH}
              />
            </div>
            <div className="flex flex-col gap-1">
              <textarea
                value={editDescription}
                maxLength={COMMUNITY_DESCRIPTION_MAX_LENGTH}
                onChange={(e) => setEditDescription(e.target.value)}
                rows={6}
                className="w-full border-none !bg-zinc-100 px-2 -mx-2 rounded focus:outline-none p-2"
                placeholder="Enter group description..."
              />
              <CharacterLimitNotice
                value={editDescription}
                max={COMMUNITY_DESCRIPTION_MAX_LENGTH}
              />
            </div>
            <div className="mt-3 rounded border border-zinc-200 bg-zinc-50 p-3">
              <div className="flex flex-col gap-y-3">
                <label
                  className="flex items-start gap-x-2 text-black text-sm font-semibold"
                  htmlFor="public"
                >
                  <input
                    id="public"
                    type="checkbox"
                    checked={editPublic}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      setEditPublic(checked);
                      if (checked) {
                        setEditAllowMemberInvites(true);
                        setEditAllowStaffAssignments(true);
                      }
                    }}
                    className="mt-1"
                  />
                  <div>
                    <p className="text-base font-medium">
                      {groupSettings.public.name}
                    </p>
                    <p className="text-sm text-zinc-500 font-normal">
                      {groupSettings.public.explanation}
                    </p>
                  </div>
                </label>
                <label
                  className="flex items-start gap-x-2 text-black text-sm font-semibold"
                  htmlFor="allowMemberInvites"
                >
                  <input
                    id="allowMemberInvites"
                    type="checkbox"
                    checked={editAllowMemberInvites}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      setEditAllowMemberInvites(checked);
                    }}
                    disabled={editPublic}
                    className="mt-1"
                  />
                  <div>
                    <p className="text-base font-medium">
                      {groupSettings.allowMemberInvites.name}
                    </p>
                    <p className="text-sm text-zinc-500 font-normal">
                      {groupSettings.allowMemberInvites.explanation}
                    </p>
                  </div>
                </label>
                <label
                  className="flex items-start gap-x-2 text-black text-sm font-semibold"
                  htmlFor="allowStaffAssignments"
                >
                  <input
                    id="allowStaffAssignments"
                    type="checkbox"
                    checked={editAllowStaffAssignments}
                    onChange={(e) =>
                      setEditAllowStaffAssignments(e.target.checked)
                    }
                    disabled={editPublic}
                    className="mt-1"
                  />
                  <div>
                    <p className="text-base font-medium">
                      {groupSettings.allowStaffAssignments.name}
                    </p>
                    <p className="text-sm text-zinc-500 font-normal">
                      {groupSettings.allowStaffAssignments.explanation}
                    </p>
                  </div>
                </label>
              </div>
              {useMaxCapacity && (
                <div className="mt-4">
                  <label
                    className="text-black font-medium"
                    htmlFor="maxCapacity"
                  >
                    <p className="text-base font-medium">
                      {groupSettings.maxCapacity.name}
                      {` (${memberCount} members)`}
                    </p>
                    <p className="text-sm text-zinc-500 font-normal">
                      {groupSettings.maxCapacity.explanation}
                    </p>
                  </label>
                  <input
                    id="maxCapacity"
                    type="number"
                    min={Math.max(memberCount, 1)}
                    value={editMaxCapacity ?? ""}
                    onChange={(e) => {
                      const value = e.target.value;
                      const parsed = Number(value);
                      setEditMaxCapacity(
                        value === "" || Number.isNaN(parsed) ? null : parsed,
                      );
                    }}
                    className="mt-2 border border-zinc-300 rounded px-3 py-2 w-full bg-white"
                  />
                </div>
              )}
            </div>
            {error && <p className="text-red-500 text-sm mt-1">{error}</p>}
          </div>
        ) : (
          <div className="flex flex-col gap-y-2">
            <div className="flex gap-2">
              <h1 className="text-title-small">{community.name}</h1>
            </div>
            <AppMarkdownWrapper
              markdownContent={community.description}
              className="mb-2 text-base"
            />
          </div>
        )}
      </div>
    </>
  );
};

export default CommunityProfile;
