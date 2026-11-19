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
    const saved = savedProfile(profile);
    setName(saved.name);
    setBio(saved.bio);
    setAvatarUrl(saved.avatarUrl);
  }, [profile]);

  useEffect(() => {
    if (!isMe || isEditing) return;
    reset();
  }, [reset, isMe, isEditing]);

  const save = useCallback(async (): Promise<Result<unknown>> => {
    const result = await R.fromPromise(
      updateProfile.mutateAsync({
        name,
        profileDescription: bio,
        profilePicture: changedPhoto({
          current: profile?.profilePicture ?? null,
          next: avatarUrl,
        }),
      }),
    );
    if (result.ok) setIsEditing(false);
    return result;
  }, [updateProfile, name, bio, avatarUrl, profile?.profilePicture]);

  const cancel = useCallback(() => {
    reset();
    setIsEditing(false);
  }, [reset]);

  const saved = profile ? savedProfile(profile) : null;
  const dirty =
    isEditing &&
    saved !== null &&
    (name !== saved.name || bio !== saved.bio || avatarUrl !== saved.avatarUrl);

  return {
    isEditing,
    /** Editing, with a value that differs from the saved profile. */
    dirty,
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

function savedProfile(profile: ProfileDto) {
  return {
    name: profile.displayName || "",
    bio: profile.profileDescription || "",
    avatarUrl: profile.profilePicture || null,
  };
}
