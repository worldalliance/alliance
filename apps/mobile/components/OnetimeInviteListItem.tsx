import type { OnetimeInviteDto } from "@alliance/shared/client";
import {
  deleteInviteConfirmation,
  onetimeInviteStatusLabels,
} from "@alliance/shared/lib/copy";
import { getReferralSignupUrl } from "@alliance/shared/lib/inviteUrls";
import type { OnetimeInviteActions } from "@alliance/shared/lib/inviteUtils";
import { cn } from "@alliance/shared/styles/util";
import { router } from "expo-router";
import {
  Alert,
  Platform,
  Share,
  TouchableOpacity,
  View,
  type GestureResponderEvent,
} from "react-native";
import { getBaseUrl } from "../lib/config";
import AppMarkdownWrapper from "./AppMarkdownWrapper";
import ProfileImage from "./ProfileImage";
import Button, { ButtonColor, ButtonSize } from "./system/Button";
import Text, { FontWeight } from "./system/Text";

/** Mobile Tailwind classes per status; labels come from shared copy. */
const STATUS_TEXT_CLASS: Record<
  keyof typeof onetimeInviteStatusLabels,
  string
> = {
  request_pending: "text-amber-500",
  request_rejected: "text-orange-600",
  link_used: "text-zinc-600",
  link_unused: "text-green",
};

export type OnetimeInviteListItemProps = {
  invite: OnetimeInviteDto;
  showCommunityLabel?: boolean;
  communityLabel?: string | null;
  selfInvited: boolean;
  shared?: boolean;
  actions: OnetimeInviteActions;
};

export default function OnetimeInviteListItem({
  invite,
  showCommunityLabel,
  communityLabel,
  selfInvited,
  shared = false,
  actions,
}: OnetimeInviteListItemProps) {
  const isRequest = invite.status === "request_pending";
  const label = onetimeInviteStatusLabels[invite.status];
  const textColorClass = STATUS_TEXT_CLASS[invite.status];
  const communityDisplay = communityLabel ?? "No group";

  const handleShare = () => {
    const url = getReferralSignupUrl(getBaseUrl(), invite.code);
    Share.share(
      Platform.OS === "android"
        ? { message: url, title: "Alliance invite" }
        : { url, title: "Alliance invite" },
    ).then(() => {
      actions.onShared?.(invite.id);
    });
  };

  const handleDeletePress = (event: GestureResponderEvent) => {
    if (actions.onDeleteWithConfirm) {
      Alert.alert(deleteInviteConfirmation.message, undefined, [
        { text: deleteInviteConfirmation.cancelLabel, style: "cancel" },
        {
          text: deleteInviteConfirmation.confirmLabel,
          style: "destructive",
          onPress: () => actions.onDeleteWithConfirm!(invite.id, event),
        },
      ]);
    } else {
      actions.onDelete?.(invite.id, event);
    }
  };

  const Container = actions.onOpenSettings ? TouchableOpacity : View;

  return (
    <Container
      {...(actions.onOpenSettings && {
        onPress: () => actions.onOpenSettings!(invite.id),
        activeOpacity: 0.7,
        accessibilityRole: "button" as const,
        accessibilityLabel: `Settings for the invite to ${invite.invitee}`,
      })}
      className="border-b border-zinc-100 px-4 py-3 bg-white"
    >
      <View className="flex-row justify-between gap-3">
        <View className="flex-1 min-w-0">
          {invite.invitedUserId ? (
            <TouchableOpacity
              onPress={() => router.push(`/member/${invite.invitedUserId}`)}
              activeOpacity={0.7}
            >
              <Text
                className="text-base text-zinc-900"
                weight={FontWeight.Semibold}
                numberOfLines={1}
              >
                {invite.invitee}
              </Text>
            </TouchableOpacity>
          ) : (
            <Text
              className="text-base text-zinc-900"
              weight={FontWeight.Semibold}
              numberOfLines={1}
            >
              {invite.invitee}
            </Text>
          )}

          {invite.invitingUser && (
            <View className="flex-row items-center gap-1.5 mt-0.5">
              <Text className="text-sm text-zinc-500">
                {isRequest ? "Requested by" : "Invited by"}{" "}
              </Text>
              {selfInvited ? (
                <Text
                  className="text-sm text-zinc-700"
                  weight={FontWeight.Medium}
                >
                  you
                </Text>
              ) : (
                <TouchableOpacity
                  onPress={() =>
                    router.push(`/member/${invite.invitingUser!.id}`)
                  }
                  className="flex-row items-center gap-1"
                  activeOpacity={0.7}
                >
                  <ProfileImage
                    pfp={invite.invitingUser.profilePicture ?? null}
                    size="mini"
                  />
                  <Text
                    className="text-sm text-zinc-700"
                    weight={FontWeight.Medium}
                    numberOfLines={1}
                  >
                    {invite.invitingUser.displayName}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          )}
          {(invite.inviteeDescription || invite.info) && (
            <View className="mt-1">
              {invite.inviteeDescription && (
                <AppMarkdownWrapper>
                  {invite.inviteeDescription}
                </AppMarkdownWrapper>
              )}
              {invite.info && (
                <AppMarkdownWrapper>{invite.info}</AppMarkdownWrapper>
              )}
            </View>
          )}
        </View>

        <View className="items-end justify-between gap-2">
          <View className="flex-row items-center gap-2">
            {showCommunityLabel && (
              <Text className="text-xs text-zinc-400" numberOfLines={1}>
                {communityDisplay}
              </Text>
            )}
            <Text
              className={cn("text-xs", textColorClass)}
              weight={FontWeight.Semibold}
            >
              {label}
            </Text>
          </View>

          <View className="flex-row flex-wrap justify-end gap-2 mt-1">
            {isRequest && actions.onApprove && actions.onReject && (
              <>
                <Button
                  onPress={() => actions.onApprove!(invite.id)}
                  color={ButtonColor.Green}
                  size={ButtonSize.Small}
                  title="Approve"
                />
                <Button
                  onPress={() => actions.onReject!(invite.id)}
                  color={ButtonColor.Red}
                  size={ButtonSize.Small}
                  title="Reject"
                />
              </>
            )}
            {invite.status === "link_unused" && (
              <>
                <Button
                  onPress={handleShare}
                  color={shared ? ButtonColor.Green : ButtonColor.Outline}
                  size={ButtonSize.Small}
                  title={shared ? "Shared!" : "Share link"}
                  disabled={shared}
                />
                {(actions.onDelete || actions.onDeleteWithConfirm) &&
                  !actions.onOpenSettings && (
                    <Button
                      onPress={() =>
                        handleDeletePress({} as GestureResponderEvent)
                      }
                      color={ButtonColor.Black}
                      size={ButtonSize.Small}
                      title="Delete"
                    />
                  )}
              </>
            )}
            {invite.status === "request_pending" &&
              actions.onDelete &&
              !actions.onApprove &&
              !actions.onReject && (
                <Button
                  onPress={() =>
                    actions.onDelete!(invite.id, {} as GestureResponderEvent)
                  }
                  color={ButtonColor.Outline}
                  size={ButtonSize.Small}
                  title="Cancel"
                />
              )}
          </View>
        </View>
      </View>
    </Container>
  );
}
