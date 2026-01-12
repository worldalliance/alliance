import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  TouchableOpacity,
  View,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import {
  forumFindOnePost,
  forumLikePost,
  forumRemovePost,
  forumUnlikePost,
  PostDto,
} from "@alliance/shared/client";
import { formatTime } from "@alliance/shared/lib/utils";
import { ArrowLeft, Pin } from "lucide-react-native";
import { useAuth } from "../../../../lib/AuthContext";
import ProfileImage from "../../../../components/ProfileImage";
import Text from "../../../../components/system/Text";
import { colors } from "../../../../lib/style/colors";
import EditableContentRenderer from "../../../../components/EditableContentRenderer";
import Comments from "../../../../components/Comments";
import LikeButton from "../../../../components/LikeButton";

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

  const { user } = useAuth();
  const [post, setPost] = useState<PostDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPost = useCallback(async () => {
    if (!postId) return;
    try {
      const response = await forumFindOnePost({
        path: { id: postId },
      });
      if (!response.data) {
        throw new Error("Post not found");
      }
      setPost(response.data);
      setError(null);
    } catch (err) {
      console.error("Error fetching post details:", err);
      setError("Failed to load post details");
    } finally {
      setLoading(false);
    }
  }, [postId]);

  useEffect(() => {
    fetchPost();
  }, [fetchPost]);

  const handleLike = useCallback(async () => {
    if (!post || !user) return;
    if (post.likes?.some((like) => like.id === user.id)) {
      await forumUnlikePost({ path: { id: post.id } });
    } else {
      await forumLikePost({ path: { id: post.id } });
    }
    fetchPost();
  }, [fetchPost, post, user]);

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
            setError("Failed to delete post");
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

  if (error || !post) {
    return (
      <View className="flex-1 items-center justify-center bg-white px-6">
        <Text className="text-zinc-500 text-center">
          {error ?? "Post not found"}
        </Text>
      </View>
    );
  }

  const likedByMe = post.likes?.some((like) => like.id === user?.id) ?? false;
  const likeCount = post.likes?.length ?? 0;
  const isPrivateFuturePost =
    post.visibleAt && new Date(post.visibleAt) > new Date();
  const action = post.action;

  return (
    <ScrollView className="flex-1 bg-white">
      <View className="px-4 pt-4 pb-10">
        <TouchableOpacity
          onPress={() => router.push("/forum")}
          className="flex-row items-center gap-x-1 mb-4"
          activeOpacity={0.7}
        >
          <ArrowLeft size={16} color={colors.green} />
          <Text className="text-green text-sm">Back to Forum</Text>
        </TouchableOpacity>

        {isPrivateFuturePost && (
          <View className="bg-sky-100 border border-sky-300 rounded p-3 mb-3">
            <Text className="text-zinc-700 text-sm">
              Only you can see this post. It is scheduled for{" "}
              {new Date(post.visibleAt!).toLocaleString()}.
            </Text>
          </View>
        )}

        <View className="border border-zinc-200 rounded bg-white p-4">
          <View className="flex-row items-start justify-between">
            <View className="flex-row items-center gap-x-1 flex-1">
              {post.pinned && <Pin size={14} color={colors.text.tertiary} />}
              <Text className="text-lg font-semibold text-zinc-900 flex-1">
                {post.title}
              </Text>
            </View>
          </View>

          <View className="flex-row flex-wrap items-center gap-x-2 mt-2">
            {renderAvatar(post.author)}
            <Text className="text-sm text-zinc-500">
              <Text className="font-medium text-zinc-700">
                {post.author.displayName}
              </Text>
              {` ${formatTime(new Date(post.createdAt), {
                addSuffix: true,
              })}`}
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

          <View className="flex-row items-center gap-x-2 mt-3">
            <LikeButton
              liked={likedByMe}
              likes={likeCount}
              onPress={user ? handleLike : undefined}
              bordered
            />
            {post.author.id === user?.id && (
              <TouchableOpacity
                onPress={confirmDeletePost}
                className="px-3 py-1 rounded bg-red-100"
                activeOpacity={0.8}
              >
                <Text className="text-red-700 text-sm">Delete</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        <View className="mt-4">
          <Comments
            objectId={post.id}
            type="post"
            highlightedReplyId={highlightedReplyId}
          />
        </View>
      </View>
    </ScrollView>
  );
}
