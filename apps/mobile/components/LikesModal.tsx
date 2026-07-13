import { ProfileDto } from "@alliance/shared/client";
import { LikeTargetType, useLikers } from "@alliance/shared/lib/useLikers";
import {
  getSkeletonCount,
  getUserListTitle,
} from "@alliance/shared/lib/userList";
import { router } from "expo-router";
import { Heart } from "lucide-react-native";
import { FlatList, Modal, Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import ProfileImage from "./ProfileImage";
import Text, { FontWeight } from "./system/Text";
import UserDisplayName from "./UserDisplayName";

interface LikesModalProps {
  visible: boolean;
  onClose: () => void;
  targetType: LikeTargetType;
  targetId: number;
  likesCount: number;
}

function Row({ user, onClose }: { user: ProfileDto; onClose: () => void }) {
  return (
    <Pressable
      className="flex-row items-center gap-3 px-5 py-2.5"
      android_ripple={{ color: "#f4f4f5" }}
      onPress={() => {
        onClose();
        router.push(`/member/${user.id}`);
      }}
    >
      <ProfileImage pfp={user.profilePicture} size="large" />
      <View className="flex-1">
        <UserDisplayName
          name={user.displayName}
          staff={user.staff}
          ambassador={user.ambassador}
          grouplead={user.isCommunityLeader}
        />
      </View>
    </Pressable>
  );
}

/** `count` is the expected row count; rendering is clamped to one page. */
function SkeletonRows({ count }: { count: number }) {
  return (
    <View>
      {Array.from({ length: getSkeletonCount(count) }).map((_, i) => (
        <View key={i} className="flex-row items-center gap-3 px-5 py-2.5">
          <View
            className="rounded bg-zinc-200"
            style={{ width: 36, height: 36 }}
          />
          <View className="flex-1 gap-1.5">
            <View className="h-3 w-32 rounded bg-zinc-200" />
            <View className="h-2.5 w-20 rounded bg-zinc-100" />
          </View>
        </View>
      ))}
    </View>
  );
}

export default function LikesModal({
  visible,
  onClose,
  targetType,
  targetId,
  likesCount,
}: LikesModalProps) {
  const insets = useSafeAreaInsets();
  const { users, loading, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useLikers({ targetType, targetId, enabled: visible });

  const initialLoading = loading && users.length === 0;
  const countLabel = getUserListTitle({
    noun: "like",
    expectedCount: likesCount,
    loadedCount: users.length,
    initialLoading,
    hasNextPage,
  });

  return (
    <Modal visible={visible} transparent animationType="fade">
      <Pressable
        onPress={onClose}
        className="flex-1 bg-black/50 justify-end"
        style={{ paddingTop: insets.top }}
      >
        <Pressable
          onPress={(e) => e.stopPropagation()}
          className="bg-white rounded-t-2xl"
          style={{ maxHeight: "80%", paddingBottom: insets.bottom }}
        >
          <View className="items-center pt-2.5 pb-1">
            <View className="h-1 w-10 rounded-full bg-zinc-300" />
          </View>

          <View className="flex-row items-center justify-center gap-x-1.5 border-b border-zinc-100 px-5 pb-3 pt-1">
            <Heart size={15} color="#ff3e24" fill="#ff3e24" strokeWidth={0} />
            <Text
              className="text-base text-zinc-900"
              weight={FontWeight.Semibold}
            >
              {countLabel}
            </Text>
          </View>

          {initialLoading ? (
            <SkeletonRows count={likesCount} />
          ) : (
            <FlatList
              data={users}
              keyExtractor={(item) => item.id.toString()}
              renderItem={({ item }) => <Row user={item} onClose={onClose} />}
              onEndReached={() => {
                if (hasNextPage && !isFetchingNextPage) fetchNextPage();
              }}
              onEndReachedThreshold={0.3}
              ListEmptyComponent={
                <View className="items-center gap-2 px-5 py-12">
                  <Heart size={28} color="#d4d4d8" strokeWidth={1.5} />
                  <Text className="text-sm text-zinc-500">No likes yet</Text>
                </View>
              }
              ListFooterComponent={
                isFetchingNextPage ? <SkeletonRows count={2} /> : null
              }
            />
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}
