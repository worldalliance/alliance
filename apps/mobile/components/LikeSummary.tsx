import { ProfileDto } from "@alliance/shared/client";
import { getLikeSummaryParts } from "@alliance/shared/lib/likeSummary";
import { LikeTargetType } from "@alliance/shared/lib/useLikers";
import { cn } from "@alliance/shared/styles/util";
import { useState } from "react";
import { Pressable, View } from "react-native";
import { useAuth } from "../lib/AuthContext";
import LikesModal from "./LikesModal";
import ProfileImage from "./ProfileImage";
import Text from "./system/Text";

export interface LikeSummaryProps {
  likeTargetType: LikeTargetType;
  likeTargetId: number;
  liked: boolean;
  likesCount: number;
  likers?: ProfileDto[];
  className?: string;
}

export default function LikeSummary({
  likeTargetType,
  likeTargetId,
  liked,
  likesCount,
  likers = [],
  className,
}: LikeSummaryProps) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);

  if (likesCount <= 0) return null;

  const { facepile, label } = getLikeSummaryParts({
    likers,
    currentUserId: user?.id,
    liked,
    likesCount,
  });

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        hitSlop={8}
        className={cn("flex-row items-center gap-x-1.5", className)}
      >
        <View className="flex-row items-center">
          {liked && (
            <View className="rounded border-2 border-white">
              <ProfileImage pfp={user?.profilePicture ?? null} size="small" />
            </View>
          )}
          {facepile.map((u, i) => (
            <View
              key={u.id}
              className="rounded border-2 border-white"
              style={{ marginLeft: liked || i > 0 ? -10 : 0 }}
            >
              <ProfileImage pfp={u.profilePicture} size="small" />
            </View>
          ))}
        </View>
        <Text className="text-sm text-zinc-500" numberOfLines={1}>
          {label}
        </Text>
      </Pressable>
      <LikesModal
        visible={open}
        onClose={() => setOpen(false)}
        targetType={likeTargetType}
        targetId={likeTargetId}
        likesCount={likesCount}
      />
    </>
  );
}
