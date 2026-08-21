import type { CommunityMemberContactInfoDto } from "@alliance/shared/client/types.gen";
import {
  formatAwayRange,
  formatAwayReason,
} from "@alliance/shared/lib/awayRangesFormatters";
import { formatNextTaskDue } from "@alliance/shared/lib/formatNextTaskDue";
import { getMemberContactActionDescriptors } from "@alliance/shared/lib/memberContactActions";
import { useAwayRanges } from "@alliance/shared/lib/useAwayRanges";
import { cn } from "@alliance/shared/styles/util";
import { router } from "expo-router";
import {
  AlarmClock,
  Check,
  ChevronDown,
  Circle,
  Globe,
  Mail,
  MessageCircle,
  MessageSquare,
  Phone,
  User,
} from "lucide-react-native";
import { useCallback, useEffect, useState } from "react";
import { Linking, TouchableOpacity, View } from "react-native";
import { colors } from "../lib/style/colors";
import ProfileImage from "./ProfileImage";
import Text, { FontWeight, TextStyle } from "./system/Text";

/** Icon sizes: inline with text = 16, row accent = 18, completion = 22, contact actions = 18 */
const ICON_SIZE_INLINE = 16;
const ICON_SIZE_CHEVRON = 18;
const ICON_SIZE_COMPLETION = 22;
const ICON_SIZE_CONTACT_ACTION = 18;

const CONTACT_ACTION_ICONS = {
  profile: User,
  email: Mail,
  call: Phone,
  text: MessageCircle,
  message: MessageSquare,
} as const;

export type GroupMemberRowProfile = {
  id: number;
  displayName: string;
  profilePicture?: string | null;
};

export type GroupMemberRowProps = {
  profile: GroupMemberRowProfile;
  isLeader: boolean;
  showDropdown: boolean;
  /** When true, omit bottom border (last row before next section header or list end). */
  isLastInSection?: boolean;
  /** true = completed all, false = has remaining tasks, null = data not yet loaded. */
  completedAll: boolean | null;
  /** When amLeader and !completedAll, show contact info (expandable block). */
  contactInfo?: CommunityMemberContactInfoDto | null;
  /** Next task due timestamp (for "Next task due" in contact block). undefined or Infinity = complete. */
  deadlineTimestamp?: number;
};

export function GroupMemberRow({
  profile,
  isLeader,
  showDropdown,
  isLastInSection,
  completedAll,
  contactInfo,
  deadlineTimestamp,
}: GroupMemberRowProps) {
  const [expanded, setExpanded] = useState(!isLeader && completedAll === false);

  useEffect(() => {
    if (isLeader) return;
    if (completedAll === true) {
      setExpanded(false);
    } else if (completedAll === false) {
      setExpanded(true);
    }
  }, [isLeader, completedAll]);

  const onTopBarPress = useCallback(() => {
    if (!showDropdown) {
      router.push(`/member/${profile.id}`);
    } else {
      setExpanded((e) => !e);
    }
  }, [showDropdown, profile.id]);

  return (
    <View className={cn(!isLastInSection && "border-b border-zinc-200")}>
      <TouchableOpacity
        onPress={onTopBarPress}
        className="flex-row items-center gap-3 px-4 py-3"
        activeOpacity={0.7}
      >
        <ProfileImage pfp={profile.profilePicture ?? null} size="large" />
        <View className="flex-1 min-w-0">
          <Text
            className="text-zinc-900"
            weight={FontWeight.Medium}
            numberOfLines={1}
          >
            {profile.displayName}
          </Text>
          {isLeader && (
            <Text type={TextStyle.Secondary} className="text-xs">
              Lead
            </Text>
          )}
        </View>
        {completedAll !== null && (
          <View
            className="items-center justify-center"
            style={{
              width: ICON_SIZE_COMPLETION,
              height: ICON_SIZE_COMPLETION,
            }}
          >
            <MemberCompletionIcon completedAll={completedAll} />
          </View>
        )}
        {showDropdown && (
          <View
            style={{
              transform: [{ rotate: expanded ? "180deg" : "0deg" }],
            }}
          >
            <ChevronDown
              size={ICON_SIZE_CHEVRON}
              color={colors.text.icon}
              strokeWidth={2}
            />
          </View>
        )}
      </TouchableOpacity>
      {expanded && contactInfo != null && (
        <MemberContactBlock
          profileId={profile.id}
          contactInfo={contactInfo}
          displayName={profile.displayName}
          deadlineTimestamp={deadlineTimestamp}
        />
      )}
    </View>
  );
}

function MemberContactBlock({
  profileId,
  contactInfo,
  displayName,
  deadlineTimestamp,
}: {
  profileId: number;
  contactInfo: CommunityMemberContactInfoDto;
  displayName: string;
  deadlineTimestamp?: number;
}) {
  const { upcomingOrCurrentAwayRanges, currentAwayRange } = useAwayRanges(
    contactInfo.awayRanges,
  );
  const sameContactTime =
    contactInfo.preferredReminderTimeUserTz ===
    contactInfo.preferredReminderTimeLeaderTz;
  const email = contactInfo.email?.trim() ?? "";
  const phone = contactInfo.phoneNumber?.trim() ?? "";
  const hasFiniteDeadline = Number.isFinite(deadlineTimestamp ?? Infinity);
  const nextTaskDueText = formatNextTaskDue(deadlineTimestamp);

  const descriptors = getMemberContactActionDescriptors({
    email,
    phone,
  });

  const handleActionPress = useCallback(
    (id: string) => {
      switch (id) {
        case "profile":
          router.push(`/member/${profileId}`);
          break;
        case "email":
          if (email) Linking.openURL(`mailto:${email}`);
          break;
        case "call":
          if (phone) Linking.openURL(`tel:${phone}`);
          break;
        case "text":
          if (phone) Linking.openURL(`sms:${phone}`);
          break;
        case "message":
          router.push(`/messages/new?to=${profileId}`);
          break;
      }
    },
    [profileId, email, phone],
  );

  return (
    <View className="px-4 py-2 gap-y-3">
      <View className="flex-row items-center">
        <Text className="text-sm text-zinc-700" weight={FontWeight.Semibold}>
          Next task due:{" "}
        </Text>
        <Text className={cn("text-sm", hasFiniteDeadline ? "" : "text-green")}>
          {nextTaskDueText}
        </Text>
      </View>
      <View className="flex-row items-center gap-x-2">
        <Globe size={ICON_SIZE_INLINE} color={colors.text.icon} />
        <Text className="text-sm text-zinc-900 flex-1">
          {contactInfo.timeZone ?? "Not provided"}
        </Text>
      </View>
      {sameContactTime ? (
        <View className="flex-row items-center gap-x-2">
          <AlarmClock size={ICON_SIZE_INLINE} color={colors.text.icon} />
          <Text className="text-sm text-zinc-900 flex-1">
            {contactInfo.preferredReminderTimeUserTz ?? "Anytime"}
            <Text type={TextStyle.Secondary} className="text-sm">
              {" "}
              in your time zone
            </Text>
          </Text>
        </View>
      ) : (
        <View className="gap-y-1">
          <View className="flex-row items-center gap-x-2">
            <AlarmClock size={ICON_SIZE_INLINE} color={colors.text.icon} />
            <View>
              <Text className="text-sm text-zinc-900">
                {contactInfo.preferredReminderTimeUserTz ?? "Anytime"}
                <Text type={TextStyle.Secondary} className="text-sm">
                  {" "}
                  in {displayName}&apos;s time zone
                </Text>
              </Text>
              <Text className="text-sm text-zinc-900">
                {contactInfo.preferredReminderTimeLeaderTz ?? "Anytime"}
                <Text type={TextStyle.Secondary} className="text-sm">
                  {" "}
                  in your time zone
                </Text>
              </Text>
            </View>
          </View>
        </View>
      )}
      {upcomingOrCurrentAwayRanges.length > 0 && (
        <View className="gap-y-2">
          <Text className="text-sm text-zinc-700" weight={FontWeight.Semibold}>
            Away ranges
          </Text>
          <View className="gap-y-2">
            {upcomingOrCurrentAwayRanges.map((range) => (
              <View key={range.id} className="gap-y-0.5">
                <Text className="text-sm text-zinc-700">
                  {formatAwayRange(range)}
                  {currentAwayRange?.id === range.id ? " (current)" : ""}
                </Text>
                <Text type={TextStyle.Secondary} className="text-xs">
                  {formatAwayReason(range.reason)}
                  {range.note ? ` — ${range.note}` : ""}
                </Text>
              </View>
            ))}
          </View>
        </View>
      )}
      <View className="flex-row items-center gap-x-1">
        {descriptors.map(({ id, label, accessibilityLabel, disabled }) => {
          const Icon = CONTACT_ACTION_ICONS[id];
          return (
            <TouchableOpacity
              key={id}
              onPress={() => handleActionPress(id)}
              activeOpacity={0.7}
              accessibilityLabel={accessibilityLabel}
              disabled={disabled}
              className="flex-1 flex-col items-center gap-y-1 bg-zinc-50 rounded p-2"
            >
              <Icon size={ICON_SIZE_CONTACT_ACTION} color={colors.text.icon} />
              <Text type={TextStyle.Secondary} className="text-xs">
                {label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

function MemberCompletionIcon({ completedAll }: { completedAll: boolean }) {
  if (completedAll) {
    return (
      <View
        className="bg-green rounded-full items-center justify-center"
        style={{
          width: ICON_SIZE_COMPLETION,
          height: ICON_SIZE_COMPLETION,
        }}
      >
        <Check
          size={Math.round(ICON_SIZE_COMPLETION * 0.55)}
          color={colors.white}
          strokeWidth={3}
        />
      </View>
    );
  }
  return (
    <Circle
      size={ICON_SIZE_COMPLETION}
      color={colors.text.light}
      strokeWidth={2}
    />
  );
}
