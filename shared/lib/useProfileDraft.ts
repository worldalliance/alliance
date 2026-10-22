import { changedPhoto } from "@alliance/common/image-src";
import { R, type Result } from "@alliance/common/result";
import { useCallback, useEffect, useState } from "react";
import type { ProfileDto } from "../client";
import { useUpdateProfileMutation } from "./user";

export function useProfileDraft({
  userId,
  profile,
  isMe,
}: {
  userId: number;
  profile: ProfileDto | null | undefined;
  isMe: boolean;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState("");
  const [bio, setBio] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const updateProfile = useUpdateProfileMutation(userId);

  useEffect(() => {
    setIsEditing(false);
  }, [userId]);

  const reset = useCallback(() => {
    if (!profile) return;
    setName(profile.displayName || "");
    setBio(profile.profileDescription || "");
    setAvatarUrl(profile.profilePicture || null);
  }, [profile]);

  useEffect(() => {
    if (!isMe || isEditing) return;
    reset();
  }, [reset, isMe, isEditing]);

  const save = useCallback(async (): Promise<Result<unknown>> => {
    const saved = await R.fromPromise(
      updateProfile.mutateAsync({
        name,
        profileDescription: bio,
        profilePicture: changedPhoto({
          current: profile?.profilePicture ?? null,
          next: avatarUrl,
        }),
      }),
    );
    if (saved.ok) setIsEditing(false);
    return saved;
  }, [updateProfile, name, bio, avatarUrl, profile?.profilePicture]);

  const cancel = useCallback(() => {
    reset();
    setIsEditing(false);
  }, [reset]);

  return {
    isEditing,
    setIsEditing,
    name,
    setName,
    bio,
    setBio,
    avatarUrl,
    setAvatarUrl,
    isSaving: updateProfile.isPending,
    save,
    cancel,
  };
}
