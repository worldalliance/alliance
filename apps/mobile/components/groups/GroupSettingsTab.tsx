import {
  getMemberCount,
  isMaxCapacityRequired,
  validateCommunitySettings,
} from "@alliance/common/community";
import { changedPhoto } from "@alliance/common/image-src";
import type {
  CommunityDto,
  CreateCommunityDto,
} from "@alliance/shared/client/types.gen";
import { groupSettings } from "@alliance/shared/lib/copy";
import { thrownRefusalMessage } from "@alliance/shared/lib/hey-api";
import {
  UPDATE_GROUP_SESSION_EXPIRED,
  useMyCommunities,
} from "@alliance/shared/lib/useMyCommunities";
import { Trash2 } from "lucide-react-native";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, TouchableOpacity, View } from "react-native";
import { pickImageDataUri } from "../../lib/pickImageDataUri";
import { colors } from "../../lib/style/colors";
import KeyboardAwareScrollView from "../KeyboardAwareScrollView";
import ProfileImage from "../ProfileImage";
import Button, { ButtonColor, ButtonSize } from "../system/Button";
import Text, { FontWeight } from "../system/Text";
import { CreateGroupForm } from "./CreateGroupForm";

function communityToCreateCommunityDto(c: CommunityDto): CreateCommunityDto {
  const mc = getMemberCount(c);
  return {
    name: c.name,
    description: c.description,
    photo: c.photo ?? "",
    public: c.public,
    allowMemberInvites: c.allowMemberInvites ?? true,
    allowStaffAssignments: c.allowStaffAssignments ?? true,
    maxCapacity: c.maxCapacity === null ? null : Math.max(c.maxCapacity, mc),
  };
}

export function GroupSettingsTab({
  community,
  amLeader,
}: {
  community: CommunityDto;
  amLeader: boolean;
}) {
  const { saveCommunity } = useMyCommunities({});
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<CreateCommunityDto>(() =>
    communityToCreateCommunityDto(community),
  );
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const memberCount = useMemo(() => getMemberCount(community), [community]);

  const requiresMaxCapacity = isMaxCapacityRequired(editForm);

  const resetFormFromCommunity = useCallback((c: CommunityDto) => {
    setEditForm(communityToCreateCommunityDto(c));
  }, []);

  useEffect(() => {
    setIsEditing(false);
    setError(null);
  }, [community.id]);

  useEffect(() => {
    if (isEditing) return;
    resetFormFromCommunity(community);
  }, [community, isEditing, resetFormFromCommunity]);

  const handleCancel = useCallback(() => {
    resetFormFromCommunity(community);
    setIsEditing(false);
    setError(null);
  }, [community, resetFormFromCommunity]);

  const handlePickPhoto = useCallback(async () => {
    const picked = await pickImageDataUri();
    if (!picked.ok) {
      console.error("Failed to pick image", picked.error);
      Alert.alert("Upload failed", "Unable to select that photo.");
      return;
    }
    if (!picked.value) return;
    const { dataUri } = picked.value;
    setEditForm((prev) => ({ ...prev, photo: dataUri }));
    setError(null);
  }, []);

  const handleRemovePhoto = useCallback(() => {
    setEditForm((prev) => ({ ...prev, photo: "" }));
    setError(null);
  }, []);

  const handleSave = useCallback(async () => {
    setError(null);
    const validated = validateCommunitySettings({
      settings: editForm,
      memberCount,
    });
    if (!validated.ok) {
      setError(validated.error);
      return;
    }

    const photoTrim = editForm.photo?.trim();

    setIsSaving(true);
    try {
      await saveCommunity({
        communityId: community.id,
        body: {
          name: validated.value.name,
          description: editForm.description,
          photo: changedPhoto({
            current: community.photo ?? null,
            next: photoTrim || null,
          }),
          public: editForm.public,
          maxCapacity: validated.value.maxCapacity,
          allowMemberInvites: editForm.allowMemberInvites,
          allowStaffAssignments: editForm.allowStaffAssignments,
        },
      });
      setIsEditing(false);
    } catch (err) {
      console.error("Failed to update group", err);
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
  }, [community.id, community.photo, editForm, memberCount, saveCommunity]);

  const requiresCapacityDisplay = isMaxCapacityRequired(community);

  if (!amLeader) {
    return (
      <View className="flex-1 px-4 py-8">
        <Text className="text-zinc-500 text-center">
          Only group leads can change settings.
        </Text>
      </View>
    );
  }

  return (
    <KeyboardAwareScrollView>
      <View className="px-4 gap-4">
        <View className="flex-row flex-wrap justify-end gap-2">
          {isEditing ? (
            <>
              <Button
                color={ButtonColor.Light}
                size={ButtonSize.Small}
                onPress={handleCancel}
                disabled={isSaving}
                title="Cancel"
              />
              <Button
                color={ButtonColor.Blue}
                size={ButtonSize.Small}
                onPress={() => void handleSave()}
                disabled={isSaving || !editForm.name.trim()}
                loading={isSaving}
                title="Save"
              />
            </>
          ) : (
            <Button
              color={ButtonColor.White}
              size={ButtonSize.Small}
              onPress={() => setIsEditing(true)}
              title="Edit"
            />
          )}
        </View>

        {isEditing ? (
          <CreateGroupForm
            variant="settings"
            newCommunity={editForm}
            setNewCommunity={setEditForm}
            requiresMaxCapacity={requiresMaxCapacity}
            error={error}
            setError={setError}
            disabled={isSaving}
            memberCountForCapacityLabel={memberCount}
            headerSlot={
              <View className="flex-row items-center gap-4">
                <ProfileImage
                  pfp={editForm.photo?.trim() ? editForm.photo : null}
                  size="larger"
                />
                <TouchableOpacity
                  onPress={() => void handlePickPhoto()}
                  disabled={isSaving}
                  className="py-2 px-3 rounded-lg border border-zinc-300 bg-white"
                >
                  <Text
                    className="text-sm text-zinc-800"
                    weight={FontWeight.Medium}
                  >
                    Change photo
                  </Text>
                </TouchableOpacity>
                {!!editForm.photo?.trim() && (
                  <TouchableOpacity
                    onPress={handleRemovePhoto}
                    disabled={isSaving}
                    accessibilityLabel="Remove photo"
                    className="p-2 rounded-lg border border-zinc-300 bg-white"
                  >
                    <Trash2 size={16} color={colors.text.icon} />
                  </TouchableOpacity>
                )}
              </View>
            }
          />
        ) : (
          <>
            <View className="flex-row items-center gap-3">
              <ProfileImage pfp={community.photo ?? null} size="larger" />
            </View>
            <View>
              <Text
                className="text-sm text-zinc-700 mb-1"
                weight={FontWeight.Medium}
              >
                Name
              </Text>
              <Text className="text-base text-zinc-900">{community.name}</Text>
            </View>
            <View>
              <Text
                className="text-sm text-zinc-700 mb-1"
                weight={FontWeight.Medium}
              >
                Description
              </Text>
              <Text className="text-base text-zinc-700">
                {community.description || "—"}
              </Text>
            </View>

            <View className="gap-y-3 p-3 bg-zinc-50 rounded-lg border border-zinc-200">
              <View>
                <Text
                  className="text-sm text-zinc-700"
                  weight={FontWeight.Medium}
                >
                  {groupSettings.public.name}
                </Text>
                <Text className="text-xs text-zinc-500 mt-0.5">
                  {community.public ? "On" : "Off"}
                </Text>
              </View>
              <View>
                <Text
                  className="text-sm text-zinc-700"
                  weight={FontWeight.Medium}
                >
                  {groupSettings.allowMemberInvites.name}
                </Text>
                <Text className="text-xs text-zinc-500 mt-0.5">
                  {community.allowMemberInvites ? "On" : "Off"}
                </Text>
              </View>
              <View>
                <Text
                  className="text-sm text-zinc-700"
                  weight={FontWeight.Medium}
                >
                  {groupSettings.allowStaffAssignments.name}
                </Text>
                <Text className="text-xs text-zinc-500 mt-0.5">
                  {community.allowStaffAssignments ? "On" : "Off"}
                </Text>
              </View>
              {requiresCapacityDisplay ? (
                <View className="pt-3 border-t border-zinc-200">
                  <Text
                    className="text-sm text-zinc-700"
                    weight={FontWeight.Medium}
                  >
                    {groupSettings.maxCapacity.name}
                  </Text>
                  <Text className="text-xs text-zinc-500 mt-0.5">
                    {community.maxCapacity != null
                      ? `${community.maxCapacity} (${memberCount} members now)`
                      : "—"}
                  </Text>
                </View>
              ) : null}
            </View>
          </>
        )}

        {error ? <Text className="text-sm text-red-600">{error}</Text> : null}
      </View>
    </KeyboardAwareScrollView>
  );
}
