import type {
  CommunityDto,
  CreateOnetimeInviteDto,
  OnetimeInviteDto,
} from "@alliance/shared/client";
import {
  communityCreateCommunity,
  userCreateOnetimeInvite,
} from "@alliance/shared/client";
import { GROUP_MAX_CAPACITY_DEFAULT } from "@alliance/shared/lib/constants";
import { onetimeInviteCreation } from "@alliance/shared/lib/copy";
import { getOnetimeInviteSignupUrl } from "@alliance/shared/lib/inviteUrls";
import { useMyCommunities } from "@alliance/shared/lib/useMyCommunities";
import { setStringAsync as setClipboardStringAsync } from "expo-clipboard";
import { ChevronDown, ChevronRight } from "lucide-react-native";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Linking,
  ScrollView,
  TouchableOpacity,
  View,
} from "react-native";
import { useAuth } from "../lib/AuthContext";
import { getBaseUrl } from "../lib/config";
import { colors } from "../lib/style/colors";
import AppMarkdownWrapper from "./AppMarkdownWrapper";
import FormModal from "./forms/FormModal";
import Button, { ButtonColor } from "./system/Button";
import Card, { CardStyle } from "./system/Card";
import Input from "./system/Input";
import Text, { FontWeight } from "./system/Text";

type PlacementSelection =
  | { kind: "community"; id: number }
  | { kind: "assign" }
  | { kind: "new" };

type InviteFormProps = {
  onInviteCreated: (invite: OnetimeInviteDto) => void;
};

export default function InviteForm({ onInviteCreated }: InviteFormProps) {
  const { user } = useAuth();
  const [placement, setPlacement] = useState<PlacementSelection>({
    kind: "new",
  });
  const [inviteeName, setInviteeName] = useState("");
  const [creatingInvite, setCreatingInvite] = useState(false);
  const { communities, refreshCommunities } = useMyCommunities({});
  const [groupSelectModalOpen, setGroupSelectModalOpen] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupDescription, setNewGroupDescription] = useState("");
  const [creatingGroup, setCreatingGroup] = useState(false);

  // Default placement to a group the user leads. Runs once so it never clobbers
  // a manual selection on a later refetch.
  const didInitPlacement = useRef(false);
  useEffect(() => {
    if (didInitPlacement.current || communities.length === 0 || !user) {
      return;
    }
    didInitPlacement.current = true;
    const led = communities.find((community: CommunityDto) =>
      community.leaders.some((leader: { id: number }) => leader.id === user.id),
    );
    setPlacement(led ? { kind: "community", id: led.id } : { kind: "new" });
  }, [communities, user]);

  const leaderCommunities = useMemo(() => {
    if (!user) return [] as CommunityDto[];
    return communities.filter((community: CommunityDto) =>
      community.leaders?.some(
        (leader: { id: number }) => leader.id === user.id,
      ),
    );
  }, [communities, user]);

  const isLeader = leaderCommunities.length > 0;

  const leaderCommunitiesById = useMemo(
    () => new Map(leaderCommunities.map((c) => [c.id, c])),
    [leaderCommunities],
  );

  const selectedCommunity = useMemo(() => {
    if (placement.kind !== "community") return null;
    return leaderCommunitiesById.get(placement.id) ?? null;
  }, [leaderCommunitiesById, placement]);

  useEffect(() => {
    if (
      placement.kind === "community" &&
      !leaderCommunitiesById.has(placement.id)
    ) {
      setPlacement(
        leaderCommunities[0]
          ? { kind: "community", id: leaderCommunities[0].id }
          : { kind: "new" },
      );
    }
  }, [placement, leaderCommunities, leaderCommunitiesById]);

  const groupSelectLabel = useMemo(() => {
    if (placement.kind === "assign")
      return onetimeInviteCreation.assignToOpenGroup;
    if (placement.kind === "new")
      return onetimeInviteCreation.createNewGroupOption;
    return selectedCommunity?.name ?? "Select a group";
  }, [placement, selectedCommunity]);

  const handleCreateInvite = useCallback(
    async (communityId: number | null) => {
      if (!inviteeName.trim()) {
        Alert.alert("Error", "Please enter the invitee's name");
        return;
      }

      setCreatingInvite(true);
      try {
        const body: CreateOnetimeInviteDto = {
          invitee: inviteeName.trim(),
          ...(communityId !== null && { communityId }),
        };

        const response = await userCreateOnetimeInvite({ body });
        if (response.data) {
          try {
            await setClipboardStringAsync(
              getOnetimeInviteSignupUrl(getBaseUrl(), response.data.code),
            );
            Alert.alert("Success", "Invite created and copied to clipboard.");
          } catch {
            Alert.alert(
              "Invite created",
              "The invite link could not be copied to the clipboard.",
            );
          }
          setInviteeName("");
          onInviteCreated(response.data);
        } else {
          Alert.alert(
            "Error",
            `Failed to create invite: ${response.response?.statusText || "Unknown error"}`,
          );
        }
      } catch {
        Alert.alert("Error", "Failed to create invite");
      } finally {
        setCreatingInvite(false);
      }
    },
    [inviteeName, onInviteCreated],
  );

  const handleCreateGroup = useCallback(async () => {
    const name = newGroupName.trim();
    if (!name) {
      Alert.alert("Missing name", "Please enter a group name.");
      return;
    }
    setCreatingGroup(true);
    try {
      const response = await communityCreateCommunity({
        body: {
          name,
          description: newGroupDescription.trim() || "",
          public: false,
          allowMemberInvites: true,
          allowStaffAssignments: true,
          maxCapacity: GROUP_MAX_CAPACITY_DEFAULT,
        },
      });
      if (response.data) {
        const community = response.data;
        setNewGroupName("");
        setNewGroupDescription("");
        await refreshCommunities();
        setPlacement({ kind: "community", id: community.id });
        if (inviteeName.trim()) {
          await handleCreateInvite(community.id);
        }
      } else {
        Alert.alert(
          "Error",
          response.response?.statusText ?? "Failed to create group.",
        );
      }
    } catch {
      Alert.alert("Error", "Failed to create group.");
    } finally {
      setCreatingGroup(false);
    }
  }, [
    newGroupName,
    newGroupDescription,
    inviteeName,
    refreshCommunities,
    handleCreateInvite,
  ]);

  return (
    <Card cardStyle={CardStyle.White} className="rounded-xl">
      <View className="gap-4">
        {/* Title + explanation */}
        <View>
          <Text className="text-lg text-zinc-900" weight={FontWeight.Semibold}>
            {onetimeInviteCreation.title}
          </Text>
          <View className="mt-1">
            <AppMarkdownWrapper>
              {onetimeInviteCreation.explanation.join("\n\n")}
            </AppMarkdownWrapper>
          </View>
          {user?.referralCode && (
            <TouchableOpacity
              onPress={() => {
                const url =
                  getOnetimeInviteSignupUrl(getBaseUrl(), user.referralCode!) +
                  "&preview=1";
                Linking.openURL(url);
              }}
              className="flex-row items-center gap-x-1 mt-1"
              activeOpacity={0.7}
            >
              <Text className="text-green">Preview invite link</Text>
              <ChevronRight size={16} color={colors.green} />
            </TouchableOpacity>
          )}
        </View>

        {/* Name + context inputs */}
        <View className="gap-3">
          <Input
            label="Invitee's first name"
            placeholder="Enter the invitee's first name"
            value={inviteeName}
            onChangeText={setInviteeName}
            containerClassName="gap-0"
          />
        </View>

        {/* Group placement section */}
        <View className="gap-3">
          <Text
            className="text-base text-zinc-900"
            weight={FontWeight.Semibold}
          >
            {onetimeInviteCreation.responsible.leader.title}
          </Text>
          <Text className="text-sm text-zinc-500">
            {onetimeInviteCreation.groupContext}
          </Text>
          <TouchableOpacity
            onPress={() => setGroupSelectModalOpen(true)}
            activeOpacity={0.85}
            className="w-full rounded-lg border border-zinc-200 bg-white flex-row items-center justify-between px-3 py-3"
          >
            <Text className="text-base text-zinc-900 flex-1" numberOfLines={1}>
              {groupSelectLabel}
            </Text>
            <ChevronDown size={18} color={colors.text.icon} />
          </TouchableOpacity>

          <FormModal
            visible={groupSelectModalOpen}
            onClose={() => setGroupSelectModalOpen(false)}
          >
            <View className="flex-row items-center justify-between mb-3">
              <Text
                className="text-lg text-zinc-900"
                weight={FontWeight.Semibold}
              >
                {onetimeInviteCreation.responsible.leader.title}
              </Text>
              <TouchableOpacity onPress={() => setGroupSelectModalOpen(false)}>
                <Text className="text-blue-600" weight={FontWeight.Medium}>
                  Close
                </Text>
              </TouchableOpacity>
            </View>
            <ScrollView className="max-h-72">
              <View className="gap-0">
                {leaderCommunities.map((community) => (
                  <TouchableOpacity
                    key={community.id}
                    onPress={() => {
                      setPlacement({ kind: "community", id: community.id });
                      setGroupSelectModalOpen(false);
                    }}
                    className="py-3 border-b border-zinc-100"
                    activeOpacity={0.7}
                  >
                    <Text className="text-base text-zinc-900">
                      {community.name}
                    </Text>
                  </TouchableOpacity>
                ))}
                <TouchableOpacity
                  onPress={() => {
                    setPlacement({ kind: "assign" });
                    setGroupSelectModalOpen(false);
                  }}
                  className="py-3 border-b border-zinc-100"
                  activeOpacity={0.7}
                >
                  <Text className="text-base text-zinc-900">
                    {onetimeInviteCreation.assignToOpenGroup}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => {
                    setPlacement({ kind: "new" });
                    setGroupSelectModalOpen(false);
                  }}
                  className="py-3"
                  activeOpacity={0.7}
                >
                  <Text className="text-base text-zinc-900">
                    {onetimeInviteCreation.createNewGroupOption}
                  </Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </FormModal>
        </View>

        {/* Assign to open group */}
        {placement.kind === "assign" && (
          <View className="gap-3">
            <Button
              onPress={() => handleCreateInvite(null)}
              color={ButtonColor.Black}
              title={creatingInvite ? "Creating…" : "Create invite"}
              disabled={creatingInvite || !inviteeName.trim()}
              loading={creatingInvite}
            />
          </View>
        )}

        {/* Create new group */}
        {placement.kind === "new" && (
          <View className="gap-3">
            <View>
              <AppMarkdownWrapper>
                {onetimeInviteCreation.responsible.leader.invite.explanation.join(
                  "\n\n",
                )}
              </AppMarkdownWrapper>
            </View>
            <Text
              className="text-base text-zinc-900"
              weight={FontWeight.Semibold}
            >
              {onetimeInviteCreation.responsible.leader.newGroup.title}
            </Text>
            {!isLeader && (
              <Text className="text-sm text-zinc-500">
                You are not leading a group yet—create one to be responsible for
                this member.
              </Text>
            )}
            <Input
              label="Group name"
              placeholder="Enter group name"
              value={newGroupName}
              onChangeText={setNewGroupName}
              containerClassName="gap-0"
            />
            <Input
              label="Description (optional)"
              placeholder="Enter group description"
              value={newGroupDescription}
              onChangeText={setNewGroupDescription}
              multiline
              numberOfLines={2}
              containerClassName="gap-0"
            />
            <Button
              onPress={() => handleCreateGroup()}
              color={ButtonColor.Black}
              title={
                creatingGroup
                  ? "Creating…"
                  : onetimeInviteCreation.responsible.leader.newGroup
                      .createButtonText
              }
              disabled={
                creatingGroup || !newGroupName.trim() || !inviteeName.trim()
              }
              loading={creatingGroup}
            />
          </View>
        )}

        {/* Existing community selected */}
        {placement.kind === "community" && selectedCommunity && (
          <View className="gap-3">
            <View>
              <AppMarkdownWrapper>
                {onetimeInviteCreation.responsible.leader.invite.explanation.join(
                  "\n\n",
                )}
              </AppMarkdownWrapper>
            </View>
            <Button
              onPress={() => handleCreateInvite(placement.id)}
              color={ButtonColor.Black}
              title={creatingInvite ? "Creating…" : "Create invite"}
              disabled={creatingInvite || !inviteeName.trim()}
              loading={creatingInvite}
            />
          </View>
        )}
      </View>
    </Card>
  );
}
