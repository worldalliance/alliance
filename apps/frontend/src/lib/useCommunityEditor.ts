import {
  isMaxCapacityRequired,
  validateCommunitySettings,
} from "@alliance/common/community";
import { changedPhoto } from "@alliance/common/image-src";
import { CommunityDto } from "@alliance/shared/client";
import { thrownRefusalMessage } from "@alliance/shared/lib/hey-api";
import {
  DELETE_GROUP_SESSION_EXPIRED,
  UPDATE_GROUP_SESSION_EXPIRED,
  useMyCommunities,
} from "@alliance/shared/lib/useMyCommunities";
import { useCallback, useEffect, useState } from "react";

export type CommunityEditor = ReturnType<typeof useCommunityEditor>;

export function useCommunityEditor(params: {
  community: CommunityDto | null;
  memberCount: number;
  onDeleted: () => void;
}) {
  const { community, memberCount, onDeleted } = params;
  const { saveCommunity, deleteCommunity } = useMyCommunities();

  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState<string>("");
  const [editDescription, setEditDescription] = useState<string>("");
  const [editPublic, setEditPublic] = useState<boolean>(false);
  const [editAllowMemberInvites, setEditAllowMemberInvites] =
    useState<boolean>(true);
  const [editAllowStaffAssignments, setEditAllowStaffAssignments] =
    useState<boolean>(true);
  const [editMaxCapacity, setEditMaxCapacity] = useState<number | null>(null);
  const [editPhotoUrl, setEditPhotoUrl] = useState<string | null>(null);
  const [photoEditorKey, setPhotoEditorKey] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const currentPhoto = community?.photo ?? null;
  const isPhotoUploadPending = isSaving && editPhotoUrl !== currentPhoto;
  const useMaxCapacity = isMaxCapacityRequired({
    public: editPublic,
    allowMemberInvites: editAllowMemberInvites,
    allowStaffAssignments: editAllowStaffAssignments,
  });

  const resetDraft = useCallback(
    (from: CommunityDto) => {
      setEditName(from.name);
      setEditDescription(from.description);
      setEditPublic(from.public);
      setEditAllowMemberInvites(from.allowMemberInvites ?? true);
      setEditAllowStaffAssignments(from.allowStaffAssignments ?? true);
      setEditMaxCapacity(
        from.maxCapacity === null
          ? null
          : Math.max(from.maxCapacity, memberCount),
      );
      setEditPhotoUrl(from.photo ?? null);
    },
    [memberCount],
  );

  useEffect(() => {
    if (community) {
      resetDraft(community);
      setIsEditing(false);
      setError(null);
    }
  }, [community, resetDraft]);

  const handleSave = useCallback(async () => {
    setError(null);
    if (!community || isSaving) return;

    const validated = validateCommunitySettings({
      settings: {
        name: editName,
        public: editPublic,
        allowMemberInvites: editAllowMemberInvites,
        allowStaffAssignments: editAllowStaffAssignments,
        maxCapacity: editMaxCapacity,
      },
      memberCount,
    });
    if (!validated.ok) {
      setError(validated.error);
      return;
    }

    setIsSaving(true);
    setError(null);
    try {
      await saveCommunity({
        communityId: community.id,
        body: {
          name: editName,
          description: editDescription,
          photo: changedPhoto({ current: currentPhoto, next: editPhotoUrl }),
          public: editPublic,
          maxCapacity: validated.value.maxCapacity,
          allowMemberInvites: editAllowMemberInvites,
          allowStaffAssignments: editAllowStaffAssignments,
        },
      });
      setIsEditing(false);
    } catch (err) {
      console.error("Failed to update group:", err);
      setError(
        thrownRefusalMessage({
          error: err,
          fallback: "Failed to update group",
          sessionExpired: UPDATE_GROUP_SESSION_EXPIRED,
        }),
      );
    } finally {
      setIsSaving(false);
    }
  }, [
    community,
    editName,
    editDescription,
    editPublic,
    editAllowMemberInvites,
    editAllowStaffAssignments,
    editMaxCapacity,
    editPhotoUrl,
    currentPhoto,
    isSaving,
    memberCount,
    saveCommunity,
  ]);

  const handleCancel = useCallback(() => {
    if (community) {
      resetDraft(community);
    }
    setPhotoEditorKey((prev) => prev + 1);
    setError(null);
    setIsEditing(false);
  }, [community, resetDraft]);

  const handleDelete = useCallback(async () => {
    if (!community || isSaving) return;

    setIsSaving(true);
    setError(null);
    try {
      await deleteCommunity(community.id);
      onDeleted();
    } catch (err) {
      console.error("Failed to delete community:", err);
      setError(
        thrownRefusalMessage({
          error: err,
          fallback: "Failed to delete community",
          sessionExpired: DELETE_GROUP_SESSION_EXPIRED,
        }),
      );
    } finally {
      setIsSaving(false);
    }
  }, [community, isSaving, deleteCommunity, onDeleted]);

  return {
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
  };
}
