import type { ConversationExpert } from "@alliance/common/forms/form-schema";
import { cn } from "@alliance/shared/styles/util";
import type { ReactNode } from "react";
import { View } from "react-native";
import ProfileImage from "../ProfileImage";
import Text from "../system/Text";

export function ExpertBubble({
  expert,
  showName,
  caption,
  faint,
  children,
}: {
  expert: ConversationExpert | null;
  showName?: boolean;
  /** A small line above the bubble, in place of the expert's name. */
  caption?: string;
  faint?: boolean;
  children: ReactNode;
}) {
  return (
    <View className="gap-1">
      {caption ? (
        <Text className="pl-10 text-[10px] font-medium uppercase tracking-wide text-zinc-500">
          {caption}
        </Text>
      ) : showName && expert ? (
        <Text className="pl-10 text-xs text-zinc-500">{expert.userName}</Text>
      ) : null}
      <View className="flex-row items-start gap-2">
        <View
          importantForAccessibility="no-hide-descendants"
          accessible={false}
        >
          <ProfileImage
            pfp={expert?.userProfilePicture ?? null}
            size="medium"
          />
        </View>
        <View
          className={cn(
            "max-w-[85%] rounded-2xl rounded-tl-sm",
            faint ? "bg-zinc-100 px-3 py-2" : "bg-zinc-200 px-3.5 py-2",
          )}
        >
          {children}
        </View>
      </View>
    </View>
  );
}
