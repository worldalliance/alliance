import type {
  CommunityDto,
  ShareUrlMineDto,
} from "@alliance/shared/client";
import { communityCreateCommunity } from "@alliance/shared/client";
import { GROUP_MAX_CAPACITY_DEFAULT } from "@alliance/shared/lib/constants";
import { onetimeInviteCreation } from "@alliance/shared/lib/copy";
import { useMyCommunities } from "@alliance/shared/lib/useMyCommunities";
import { useReusableInvites } from "@alliance/shared/lib/useReusableInvites";
import { cn } from "@alliance/shared/styles/util";
import { setStringAsync as setClipboardStringAsync } from "expo-clipboard";
import { ChevronDown, Pencil } from "lucide-react-native";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Alert,
  Platform,
  ScrollView,
  Share,
  TouchableOpacity,
  View,
} from "react-native";
import { useAuth } from "../lib/AuthContext";
import { colors } from "../lib/style/colors";
import FormModal from "./forms/FormModal";
import Button, { ButtonColor, ButtonSize } from "./system/Button";
import Card, { CardStyle } from "./system/Card";
import Input from "./system/Input";
import Text, { FontWeight } from "./system/Text";

const REQUIRED_DELETE_TEXT = "DELETE";

type PlacementSelection =
  | { kind: "community"; id: number }
  | { kind: "assign" }
  | { kind: "new" };

function inviteDestinationLabel(
  link: ShareUrlMineDto,
  communityNames: Map<number, string>,
): string {
  switch (link.assignmentKind) {
    case "automatic":
      return "Group: Automatic";
    case "community":
      return `Group: ${
        (link.communityId && communityNames.get(link.communityId)) ??
        "Selected group"
      }`;
    case "open":
      return "Group: Any open group";
    default:
      throw new Error(
        `unknown invite assignment: ${link.assignmentKind satisfies never}`,
      );
  }
}

export default function InviteShareLink() {
  const { user } = useAuth();
  const {
    links,
    isPending,
    isError,
    isCreating,
    createInvite,
    updateLabel,
    deleteInvite,
  } = useReusableInvites();
  const { communities, refreshCommunities } = useMyCommunities({});
  const [labelDraft, setLabelDraft] = useState("");
  const [placement, setPlacement] = useState<PlacementSelection>({
    kind: "new",
  });
  const [groupSelectModalOpen, setGroupSelectModalOpen] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupDescription, setNewGroupDescription] = useState("");
  const [creatingGroup, setCreatingGroup] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");

  const leaderCommunities = useMemo(() => {
    if (!user) return [] as CommunityDto[];
    return communities.filter((community) =>
      community.leaders.some((leader) => leader.id === user.id),
    );
  }, [communities, user]);

  const leaderCommunitiesById = useMemo(
    () =>
      new Map(
        leaderCommunities.map((community) => [community.id, community]),
      ),
    [leaderCommunities],
  );

  const communityNames = useMemo(
    () =>
      new Map(
        communities.map((community) => [community.id, community.name]),
      ),
    [communities],
  );

  const selectedCommunity = useMemo(() => {
    if (placement.kind !== "community") return null;
    return leaderCommunitiesById.get(placement.id) ?? null;
  }, [leaderCommunitiesById, placement]);

  const didInitPlacement = useRef(false);
  useEffect(() => {
    if (didInitPlacement.current || communities.length === 0 || !user) return;
    didInitPlacement.current = true;
    const led = leaderCommunities[0];
    setPlacement(led ? { kind: "community", id: led.id } : { kind: "new" });
  }, [communities.length, leaderCommunities, user]);

  useEffect(() => {
    if (
      placement.kind === "community" &&
      !leaderCommunitiesById.has(placement.id)
    ) {
      const firstLedCommunity = leaderCommunities[0];
      setPlacement(
        firstLedCommunity
          ? { kind: "community", id: firstLedCommunity.id }
          : { kind: "new" },
      );
    }
  }, [leaderCommunities, leaderCommunitiesById, placement]);

  const groupSelectLabel = useMemo(() => {
    switch (placement.kind) {
      case "assign":
        return onetimeInviteCreation.assignToOpenGroup;
      case "new":
        return onetimeInviteCreation.createNewGroupOption;
      case "community":
        return selectedCommunity?.name ?? "Select a group";
      default:
        throw new Error(
          `unknown invite placement: ${placement satisfies never}`,
        );
    }
  }, [placement, selectedCommunity]);

  const handleCreate = useCallback(
    async (communityId: number | null) => {
      try {
        const link = await createInvite({ label: labelDraft, communityId });
        setLabelDraft("");
        try {
          await setClipboardStringAsync(link.url);
          Alert.alert(
            "Success",
            "Invite link created and copied to clipboard.",
          );
        } catch {
          Alert.alert(
            "Invite created",
            "The invite link could not be copied to the clipboard.",
          );
        }
      } catch {
        Alert.alert("Error", "Failed to create invite link");
      }
    },
    [createInvite, labelDraft],
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
          description: newGroupDescription.trim(),
          public: false,
          allowMemberInvites: true,
          allowStaffAssignments: true,
          maxCapacity: GROUP_MAX_CAPACITY_DEFAULT,
        },
      });
      if (!response.data) {
        Alert.alert(
          "Error",
          response.response?.statusText ?? "Failed to create group.",
        );
        return;
      }
      setNewGroupName("");
      setNewGroupDescription("");
      await refreshCommunities();
      setPlacement({ kind: "community", id: response.data.id });
      await handleCreate(response.data.id);
    } catch {
      Alert.alert("Error", "Failed to create group.");
    } finally {
      setCreatingGroup(false);
    }
  }, [
    handleCreate,
    newGroupDescription,
    newGroupName,
    refreshCommunities,
  ]);

  const handleShare = useCallback((link: ShareUrlMineDto) => {
    void Share.share(
      Platform.OS === "android"
        ? { message: link.url, title: "Alliance invite" }
        : { url: link.url, title: "Alliance invite" },
    );
  }, []);

  const handleSaveLabel = useCallback(
    (id: string, label: string) =>
      updateLabel({ id, label }).then(
        () => true,
        () => {
          Alert.alert("Error", "Failed to update label");
          return false;
        },
      ),
    [updateLabel],
  );

  const handleDelete = useCallback((id: string) => {
    setDeleteConfirmText("");
    setPendingDeleteId(id);
  }, []);

  const closeDeleteModal = useCallback(() => {
    setPendingDeleteId(null);
    setDeleteConfirmText("");
  }, []);

  const confirmDelete = useCallback(() => {
    if (!pendingDeleteId) return;
    const id = pendingDeleteId;
    closeDeleteModal();
    void deleteInvite(id).catch(() =>
      Alert.alert("Error", "Failed to delete invite link"),
    );
  }, [pendingDeleteId, deleteInvite, closeDeleteModal]);

  const deleteConfirmed = deleteConfirmText.trim() === REQUIRED_DELETE_TEXT;

  return (
    <View className="gap-4">
      <Card cardStyle={CardStyle.White} className="rounded-xl">
        <View className="gap-4">
          <View className="gap-1">
            <Text
              className="text-lg text-zinc-900"
              weight={FontWeight.Semibold}
            >
              Invite multiple people
            </Text>
            <Text className="text-sm text-zinc-500">
              Create one invite link you can share with multiple people. Add a
              label to remember where you shared each one.
            </Text>
          </View>
          <Input
            placeholder="Label this link (optional) — e.g. Instagram bio"
            value={labelDraft}
            onChangeText={setLabelDraft}
            editable={!isCreating && !creatingGroup}
            containerClassName="gap-0"
          />
          <View className="gap-2">
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
              disabled={isCreating || creatingGroup}
              className="w-full rounded-lg border border-zinc-200 bg-white flex-row items-center justify-between px-3 py-3"
            >
              <Text
                className="text-base text-zinc-900 flex-1"
                numberOfLines={1}
              >
                {groupSelectLabel}
              </Text>
              <ChevronDown size={18} color={colors.text.icon} />
            </TouchableOpacity>
          </View>

          {placement.kind === "assign" && (
            <Button
              onPress={() => void handleCreate(null)}
              color={ButtonColor.Black}
              title={isCreating ? "Creating…" : "Create invite link"}
              disabled={isCreating}
              loading={isCreating}
            />
          )}

          {placement.kind === "new" && (
            <View className="gap-3">
              <Text
                className="text-base text-zinc-900"
                weight={FontWeight.Semibold}
              >
                {onetimeInviteCreation.responsible.leader.newGroup.title}
              </Text>
              <Input
                label="Group name"
                placeholder="Enter group name"
                value={newGroupName}
                onChangeText={setNewGroupName}
                editable={!creatingGroup}
                containerClassName="gap-0"
              />
              <Input
                label="Description (optional)"
                placeholder="Enter group description"
                value={newGroupDescription}
                onChangeText={setNewGroupDescription}
                editable={!creatingGroup}
                multiline
                numberOfLines={2}
                containerClassName="gap-0"
              />
              <Button
                onPress={() => void handleCreateGroup()}
                color={ButtonColor.Black}
                title={
                  creatingGroup ? "Creating…" : "Create group and invite link"
                }
                disabled={creatingGroup || !newGroupName.trim()}
                loading={creatingGroup}
              />
            </View>
          )}

          {placement.kind === "community" && selectedCommunity && (
            <Button
              onPress={() => void handleCreate(placement.id)}
              color={ButtonColor.Black}
              title={isCreating ? "Creating…" : "Create invite link"}
              disabled={isCreating}
              loading={isCreating}
            />
          )}
        </View>
      </Card>

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
          <View>
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

      {isError ? (
        <Text className="text-sm text-red-500">
          Failed to load invite links
        </Text>
      ) : isPending ? (
        <Text className="text-sm text-zinc-500">Loading…</Text>
      ) : links.length === 0 ? (
        <Text className="text-center text-zinc-500 py-4">
          Your invite links will appear here once you create them.
        </Text>
      ) : (
        <View className="gap-3">
          <Text className="text-lg text-zinc-900" weight={FontWeight.Semibold}>
            Your invite links
          </Text>
          <View className="bg-white rounded-lg overflow-hidden border border-zinc-100">
            {links.map((link) => (
              <InviteLinkRow
                key={link.id}
                link={link}
                destinationLabel={inviteDestinationLabel(
                  link,
                  communityNames,
                )}
                onShare={handleShare}
                onSaveLabel={handleSaveLabel}
                onDelete={handleDelete}
              />
            ))}
          </View>
        </View>
      )}

      <FormModal visible={pendingDeleteId !== null} onClose={closeDeleteModal}>
        <View className="gap-4">
          <View className="gap-1">
            <Text
              className="text-lg text-zinc-900"
              weight={FontWeight.Semibold}
            >
              Delete invite link?
            </Text>
            <Text className="text-sm text-zinc-500">
              Anyone you&apos;ve already shared it with won&apos;t be able to
              use it. Type {REQUIRED_DELETE_TEXT} to confirm.
            </Text>
          </View>
          <Input
            placeholder={`Type ${REQUIRED_DELETE_TEXT} to confirm`}
            value={deleteConfirmText}
            onChangeText={setDeleteConfirmText}
            autoCapitalize="characters"
            autoCorrect={false}
            autoFocus
            containerClassName="gap-0"
          />
          <View className="flex-row gap-2">
            <Button
              onPress={closeDeleteModal}
              color={ButtonColor.White}
              title="Cancel"
              className="flex-1"
            />
            <Button
              onPress={confirmDelete}
              color={ButtonColor.Red}
              title="Delete"
              disabled={!deleteConfirmed}
              className="flex-1"
            />
          </View>
        </View>
      </FormModal>
    </View>
  );
}

type InviteLinkRowProps = {
  link: ShareUrlMineDto;
  destinationLabel: string;
  onShare: (link: ShareUrlMineDto) => void;
  onSaveLabel: (id: string, label: string) => Promise<boolean>;
  onDelete: (id: string) => void;
};

function InviteLinkRow({
  link,
  destinationLabel,
  onShare,
  onSaveLabel,
  onDelete,
}: InviteLinkRowProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(link.label ?? "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!editing) setDraft(link.label ?? "");
  }, [link.label, editing]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    const ok = await onSaveLabel(link.id, draft);
    setSaving(false);
    if (ok) setEditing(false);
  }, [onSaveLabel, link.id, draft]);

  const handleCancel = useCallback(() => {
    setDraft(link.label ?? "");
    setEditing(false);
  }, [link.label]);

  return (
    <View className="border-b border-zinc-100 px-4 py-3 bg-white gap-2">
      {!link.duplicate ? (
        <Text
          className="text-base text-zinc-900"
          weight={FontWeight.Semibold}
          numberOfLines={1}
        >
          {link.label || "Primary invite"}
        </Text>
      ) : editing ? (
        <View className="gap-2">
          <Input
            placeholder="Label"
            value={draft}
            onChangeText={setDraft}
            editable={!saving}
            autoFocus
            containerClassName="gap-0"
          />
          <View className="flex-row gap-2">
            <Button
              onPress={handleSave}
              color={ButtonColor.Green}
              size={ButtonSize.Small}
              title={saving ? "Saving…" : "Save"}
              disabled={saving}
              loading={saving}
            />
            <Button
              onPress={handleCancel}
              color={ButtonColor.White}
              size={ButtonSize.Small}
              title="Cancel"
              disabled={saving}
            />
          </View>
        </View>
      ) : (
        <TouchableOpacity
          onPress={() => setEditing(true)}
          activeOpacity={0.7}
          className="flex-row items-center gap-1.5 self-start"
        >
          <Text
            className={cn(
              "text-base",
              link.label ? "text-zinc-900" : "italic text-zinc-400",
            )}
            weight={FontWeight.Semibold}
            numberOfLines={1}
          >
            {link.label || "Add a label"}
          </Text>
          <Pencil size={14} color={colors.text.icon} />
        </TouchableOpacity>
      )}

      <Text className="text-xs text-zinc-400 font-mono" numberOfLines={1}>
        {link.url}
      </Text>
      <Text className="text-sm text-zinc-500">
        {link.signupCount} {link.signupCount === 1 ? "use" : "uses"}
      </Text>
      <Text className="text-sm text-zinc-500">{destinationLabel}</Text>

      <View className="flex-row items-center justify-between mt-1">
        {!link.duplicate ? (
          <Text className="text-xs text-green" weight={FontWeight.Semibold}>
            Primary
          </Text>
        ) : (
          <View />
        )}
        <View className="flex-row items-center gap-2">
          <Button
            onPress={() => onShare(link)}
            color={ButtonColor.Outline}
            size={ButtonSize.Small}
            title="Share"
          />
          {link.duplicate && (
            <Button
              onPress={() => onDelete(link.id)}
              color={ButtonColor.Black}
              size={ButtonSize.Small}
              title="Delete"
            />
          )}
        </View>
      </View>
    </View>
  );
}
