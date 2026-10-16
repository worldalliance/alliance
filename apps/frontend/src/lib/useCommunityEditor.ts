import {
  isMaxCapacityRequired,
  validateCommunitySettings,
} from "@alliance/common/community";
import { errorMessage } from "@alliance/common/errorMessage";
import { changedPhoto } from "@alliance/common/image-src";
import {
  CommunityDto,
  communityDelete,
  communityUpdate,
} from "@alliance/shared/client";
import { useCallback, useEffect, useState } from "react";

export type CommunityEditor = ReturnType<typeof useCommunityEditor>;

export function useCommunityEditor(params: {
  community: CommunityDto | null;
  memberCount: number;
  onUpdated: (community: CommunityDto) => void;
  onDeleted: (communityId: number) => void;
}) {
  const { community, memberCount, onUpdated, onDeleted } = params;

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
      const response = await communityUpdate({
        path: { communityId: community.id },
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

      if (response.data) {
        onUpdated(response.data);
        setIsEditing(false);
      } else {
        setError(
          errorMessage({
            error: response.error,
            fallback: "Failed to update group",
          }),
        );
      }
    } catch (err) {
      console.error("Failed to update group:", err);
      setError("Failed to update group");
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
    onUpdated,
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
      const response = await communityDelete({
        path: { communityId: community.id },
      });
      if (response.error) {
        setError(
          errorMessage({
            error: response.error,
            fallback: "Failed to delete community",
          }),
        );
      } else {
        onDeleted(community.id);
      }
    } catch (err) {
      console.error("Failed to delete community:", err);
      setError("Failed to delete community");
    } finally {
      setIsSaving(false);
    }
  }, [community, isSaving, onDeleted]);

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
