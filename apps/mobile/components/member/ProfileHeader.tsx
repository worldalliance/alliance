import type { ProfileDto } from "@alliance/shared/client";
import { roleBadges } from "@alliance/shared/lib/copy";
import { useProfileDraft } from "@alliance/shared/lib/useProfileDraft";
import { useMessageableUsersQuery } from "@alliance/shared/lib/user";
import { cn } from "@alliance/shared/styles/util";
import { router } from "expo-router";
import { Edit, Menu, MessageSquare } from "lucide-react-native";
import { useCallback, useState, type ReactNode } from "react";
import {
  Alert,
  Pressable,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useAppDrawer } from "../../lib/AppDrawerContext";
import { useAuth } from "../../lib/AuthContext";
import { pickImageDataUri } from "../../lib/pickImageDataUri";
import { colors } from "../../lib/style/colors";
import AppMarkdownWrapper from "../AppMarkdownWrapper";
import { ImageLightboxModal } from "../ImageLightbox";
import ProfileImage, { resolveProfileImageUri } from "../ProfileImage";
import BackButton from "../system/BackButton";
import Button, { ButtonColor, ButtonSize } from "../system/Button";
import Text, { FontWeight } from "../system/Text";
import FriendRequestButton from "./FriendRequestButton";

export default function ProfileHeader({
  profile,
  isMe,
  completedActionCount,
  children,
}: {
  profile: ProfileDto;
  isMe: boolean;
  completedActionCount: number;
  children: ReactNode;
}) {
  const { isAuthenticated } = useAuth();
  const { openDrawer, isPermanent } = useAppDrawer();
  const { ids: messageableIds } = useMessageableUsersQuery({
    enabled: isAuthenticated,
  });
  const {
    isEditing,
    setIsEditing,
    name: editName,
    setName: setEditName,
    bio: editBio,
    setBio: setEditBio,
    avatarUrl: editAvatarUrl,
    setAvatarUrl: setEditAvatarUrl,
    isSaving: isSavingProfile,
    save: saveProfile,
    cancel: handleCancelEdit,
  } = useProfileDraft({ userId: profile.id, profile, isMe });
  const [isPickingAvatar, setIsPickingAvatar] = useState(false);
  const [pfpLightboxOpen, setPfpLightboxOpen] = useState(false);

  const handlePickAvatar = useCallback(async () => {
    if (isPickingAvatar) return;
    setIsPickingAvatar(true);
    try {
      const picked = await pickImageDataUri();
      if (!picked.ok) {
        console.error("Failed to pick image", picked.error);
        Alert.alert("Upload failed", "Unable to select that photo.");
        return;
      }
      if (picked.value) {
        setEditAvatarUrl(picked.value.dataUri);
      }
    } finally {
      setIsPickingAvatar(false);
    }
  }, [isPickingAvatar, setEditAvatarUrl]);

  const handleSaveProfile = useCallback(async () => {
    if (!isMe || isSavingProfile) return;

    const saved = await saveProfile();
    if (!saved.ok) {
      console.error("Failed to save profile", saved.error);
    }
  }, [isMe, isSavingProfile, saveProfile]);

  const badgeStyles = "text-xs text-white px-2 py-0.5 rounded";
  const profileNavBar = (
    <View className="flex-row items-center px-2 pt-1">
      {router.canGoBack() ? (
        <BackButton />
      ) : !isPermanent ? (
        <Pressable onPress={openDrawer} className="p-2">
          <Menu size={25} color={colors.text.icon} strokeWidth={2.5} />
        </Pressable>
      ) : null}
    </View>
  );

  return (
    <>
      {profileNavBar}
      <View className="p-4 pt-4 gap-4">
        <View className="flex flex-row items-center gap-3">
          {isEditing ? (
            <TouchableOpacity
              onPress={handlePickAvatar}
              className="border-zinc-200 rounded-lg p-1 border-dashed border-2 relative"
            >
              <ProfileImage pfp={editAvatarUrl} size="larger" />
              <View className="absolute top-0 left-0 right-0 bottom-0 flex items-center justify-center ">
                <Edit size={24} color="#fff" />
              </View>
            </TouchableOpacity>
          ) : (
            <>
              <TouchableOpacity
                onPress={() =>
                  profile.profilePicture && setPfpLightboxOpen(true)
                }
                activeOpacity={profile.profilePicture ? 0.9 : 1}
              >
                <ProfileImage pfp={profile.profilePicture} size="larger" />
              </TouchableOpacity>
              <ImageLightboxModal
                uri={
                  pfpLightboxOpen && profile.profilePicture
                    ? resolveProfileImageUri(profile.profilePicture)
                    : null
                }
                onClose={() => setPfpLightboxOpen(false)}
              />
            </>
          )}
          <View className="gap-1">
            {isEditing ? (
              <TextInput
                className="border border-zinc-200 rounded-lg px-3 py-2 text-lg w-full"
                value={editName}
                onChangeText={setEditName}
                placeholder="Name"
                placeholderTextColor="#9ca3af"
              />
            ) : (
              <View className="flex-row items-center flex-wrap gap-2 justify-center">
                <Text
                  className="text-xl text-zinc-900"
                  weight={FontWeight.Semibold}
                >
                  {profile.displayName}
                </Text>
                {profile.staff && (
                  <View className={cn("bg-staff", badgeStyles)}>
                    <Text className="text-white text-sm">
                      {roleBadges.staff.label}
                    </Text>
                  </View>
                )}
                {!profile.staff && profile.ambassador && (
                  <View className={cn("bg-red-500", badgeStyles)}>
                    <Text className="text-white text-xs">
                      {roleBadges.ambassador.label}
                    </Text>
                  </View>
                )}
                {!profile.staff && profile.isCommunityLeader && (
                  <View className={cn("bg-grouplead", badgeStyles)}>
                    <Text className="text-white text-xs">
                      {roleBadges.grouplead.label}
                    </Text>
                  </View>
                )}
                {!profile.hasActiveContract && (
                  <View className={cn("bg-zinc-200", badgeStyles)}>
                    <Text className="text-zinc-700 text-xs">Observer</Text>
                  </View>
                )}
                {isMe && (
                  <TouchableOpacity
                    onPress={() => setIsEditing(true)}
                    activeOpacity={0.7}
                    className="ml-2"
                  >
                    <Edit size={20} />
                  </TouchableOpacity>
                )}
              </View>
            )}
            <Text className="text-sm text-zinc-500">
              <Text className="text-sm text-black">{completedActionCount}</Text>{" "}
              actions
            </Text>
          </View>
          {!isMe && isAuthenticated && messageableIds.has(profile.id) && (
            <View className="ml-auto">
              <TouchableOpacity
                onPress={() => router.push(`/messages/new?to=${profile.id}`)}
                activeOpacity={0.7}
                className="p-2"
                accessibilityLabel={`Message ${profile.displayName}`}
              >
                <MessageSquare size={24} color={colors.text.icon} />
              </TouchableOpacity>
            </View>
          )}
        </View>
        {(!isMe || isEditing) && (
          <View className="flex-row items-center gap-3">
            {isMe ? (
              isEditing ? (
                <>
                  <Button
                    title="Cancel"
                    color={ButtonColor.Light}
                    size={ButtonSize.Medium}
                    onPress={handleCancelEdit}
                  />
                  <Button
                    title={isSavingProfile ? "Saving..." : "Save"}
                    color={ButtonColor.Black}
                    size={ButtonSize.Medium}
                    onPress={handleSaveProfile}
                    disabled={isSavingProfile}
                  />
                </>
              ) : null
            ) : (
              <FriendRequestButton userId={profile.id} />
            )}
          </View>
        )}

        <View>
          {isEditing ? (
            <TextInput
              className="border border-zinc-200 rounded-lg px-3 py-3 text-base min-h-24"
              value={editBio}
              onChangeText={setEditBio}
              placeholder="Write something about yourself..."
              placeholderTextColor="#9ca3af"
              multiline
            />
          ) : profile.profileDescription ? (
            <AppMarkdownWrapper>
              {profile.profileDescription}
            </AppMarkdownWrapper>
          ) : null}
        </View>

        {children}
      </View>
    </>
  );
}
