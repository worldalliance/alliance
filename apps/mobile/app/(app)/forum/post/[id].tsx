import {
  forumFindOnePost,
  forumRemovePost,
  PostDto,
} from "@alliance/shared/client";
import { usePostLikeMutation } from "@alliance/shared/lib/usePostLikeMutation";
import { formatTime } from "@alliance/shared/lib/utils";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { Pin } from "lucide-react-native";
import { useCallback, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Alert, TouchableOpacity, View } from "react-native";
import { KeyboardAwareScrollViewRef } from "react-native-keyboard-controller";
import Comments from "../../../../components/Comments";
import EditableContentRenderer from "../../../../components/EditableContentRenderer";
import KeyboardAwareScrollView from "../../../../components/KeyboardAwareScrollView";
import LikeFooter from "../../../../components/LikeFooter";
import ProfileImage from "../../../../components/ProfileImage";
import BackButton from "../../../../components/system/BackButton";
import Text, { FontWeight } from "../../../../components/system/Text";
import UserDisplayName from "../../../../components/UserDisplayName";
import { useAuth } from "../../../../lib/AuthContext";
import { colors } from "../../../../lib/style/colors";

const renderAvatar = (author: PostDto["author"]) => {
  return <ProfileImage pfp={author.profilePicture} size="small" />;
};

export default function PostDetailScreen() {
  const { id, replyId } = useLocalSearchParams<{
    id: string;
    replyId?: string | string[];
  }>();
  const postId = Array.isArray(id) ? id[0] : id;
  const highlightedReplyId = useMemo(() => {
    if (!replyId) return null;
    const value = Array.isArray(replyId) ? replyId[0] : replyId;
    const parsed = parseInt(value, 10);
    return Number.isNaN(parsed) ? null : parsed;
  }, [replyId]);

  const scrollViewRef = useRef<KeyboardAwareScrollViewRef>(null);
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const queryKey = ["forumFindOnePost", postId];

  const {
    data: post = null,
    isLoading: loading,
    error: queryError,
  } = useQuery({
    queryKey,
    queryFn: () =>
      forumFindOnePost({ path: { id: postId! } }).then(
        (res) => res.data ?? null,
      ),
    enabled: !!postId,
  });

  const handleLike = usePostLikeMutation({
    postId: Number(postId),
    userId: user?.id,
    getPost: () => post,
    setPost: (updater) => {
      queryClient.setQueryData(queryKey, (old: typeof post) =>
        old ? updater(old) : old,
      );
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });

  const confirmDeletePost = useCallback(() => {
    if (!post || post.author.id !== user?.id) return;
    Alert.alert("Delete Post", "Are you sure you want to delete this post?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await forumRemovePost({ path: { id: post.id } });
            router.push("/forum");
          } catch (err) {
            console.error("Error deleting post:", err);
            setDeleteError("Failed to delete post");
          }
        },
      },
    ]);
  }, [post, user]);

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <ActivityIndicator size="large" color={colors.green} />
      </View>
    );
  }

  if (deleteError || queryError || !post) {
    return (
      <View className="flex-1 items-center justify-center bg-white px-6">
        <Text className="text-zinc-500 text-center">
          {deleteError ??
            (queryError ? "Failed to load post details" : "Post not found")}
        </Text>
      </View>
    );
  }

  const likedByMe = post.likedByMe ?? false;
  const likeCount = post.likeCount ?? 0;
  const isPrivateFuturePost =
    post.visibleAt && new Date(post.visibleAt) > new Date();
  const action = post.action;

  return (
    <KeyboardAwareScrollView
      ref={scrollViewRef}
      className="bg-white"
      testID="vr-forum-post-ready"
    >
      <View className="px-4 pb-10">
        <View className="self-start mb-4">
          <BackButton fallbackRoute="/forum" bordered />
        </View>
        {isPrivateFuturePost && (
          <View className="bg-sky-100 border border-sky-300 rounded p-3 mb-3">
            <Text className="text-zinc-700 text-sm">
              Only you can see this post. It is scheduled for{" "}
              {new Date(post.visibleAt!).toLocaleString()}.
            </Text>
          </View>
        )}

        <View className="bg-white">
          <View className="flex-row items-start justify-between">
            <View className="flex-row items-center gap-x-1 flex-1">
              {post.pinned && <Pin size={14} color={colors.text.tertiary} />}
              <Text
                className="text-lg text-zinc-900 flex-1"
                weight={FontWeight.Semibold}
              >
                {post.title}
              </Text>
            </View>
          </View>

          <View className="flex-row flex-wrap items-center gap-x-2 mt-2">
            {renderAvatar(post.author)}
            <UserDisplayName
              name={post.author.displayName}
              staff={post.author.staff}
              ambassador={post.author.ambassador}
              grouplead={post.author.isCommunityLeader}
            />
            <Text className="text-sm text-zinc-500">
              {formatTime(new Date(post.createdAt), {
                addSuffix: true,
              })}
            </Text>
            {action && (
              <TouchableOpacity
                onPress={() => router.push(`/actions/${action.id}`)}
                activeOpacity={0.8}
                className="bg-green/20 px-3 py-1 rounded-lg"
              >
                <Text className="text-green-700 text-sm">{action.name}</Text>
              </TouchableOpacity>
            )}
          </View>

          <View className="mt-3">
            <EditableContentRenderer content={post.editableContent} />
          </View>

          <LikeFooter
            likeTargetType="post"
            likeTargetId={post.id}
            liked={likedByMe}
            likesCount={likeCount}
            likers={post.likes}
            onLike={user ? handleLike : undefined}
            align="right"
          />
          {post.author.id === user?.id && (
            <View className="flex-row items-center mt-3">
              <TouchableOpacity
                onPress={confirmDeletePost}
                className="px-3 py-1 rounded bg-red-100"
                activeOpacity={0.8}
              >
                <Text className="text-red-700 text-sm">Delete</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        <View className="mt-4">
          <Comments
            objectId={post.id}
            type="post"
            highlightedReplyId={highlightedReplyId}
            scrollViewRef={scrollViewRef}
            repliesAsCards={false}
            qaMode={post.qaMode}
            expertIds={post.expertIds ?? []}
            expertLabel={post.expertLabel ?? undefined}
            showClusterTags={post.showClusterTags}
            tags={post.tags ?? []}
          />
        </View>
      </View>
    </KeyboardAwareScrollView>
  );
}
