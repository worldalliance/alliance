import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  TouchableOpacity,
  View,
} from "react-native";
import { router } from "expo-router";
import { Pin } from "lucide-react-native";
import { PostDto, forumFindAllPosts } from "@alliance/shared/client";
import { formatTime } from "@alliance/shared/lib/utils";
import ProfileImage from "../../../components/ProfileImage";
import Text from "../../../components/system/Text";
import { colors } from "../../../lib/style/colors";

export default function ForumScreen() {
  const [posts, setPosts] = useState<PostDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPosts = useCallback(async () => {
    try {
      const response = await forumFindAllPosts();
      if (response.error) {
        throw new Error("Failed to fetch posts");
      }
      setPosts(response.data || []);
      setError(null);
    } catch (err) {
      setError("Failed to load forum posts");
      console.error("Error fetching posts:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchPosts();
    setRefreshing(false);
  }, [fetchPosts]);

  const navigateToPost = useCallback((postId: number) => {
    router.push(`/forum/post/${postId}`);
  }, []);

  const navigateToCreatePost = useCallback(() => {
    router.push("/forum/create");
  }, []);

  const sortedPosts = useMemo(() => {
    return [...posts].sort((a, b) => {
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
      return 0;
    });
  }, [posts]);

  return (
    <ScrollView
      className="flex-1 bg-white"
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      <View className="px-4 pt-6 pb-10 gap-y-3">
        <TouchableOpacity
          className="border border-zinc-200 rounded p-4 bg-white"
          onPress={navigateToCreatePost}
          activeOpacity={0.8}
        >
          <Text className="text-zinc-500">Create a new thread...</Text>
        </TouchableOpacity>

        {loading ? (
          <ActivityIndicator size="large" color={colors.green} />
        ) : error ? (
          <View className="bg-red-50 border border-red-200 rounded p-4">
            <Text className="text-red-600">{error}</Text>
            <TouchableOpacity
              className="mt-3 px-3 py-2 rounded bg-white border border-zinc-200 self-start"
              onPress={fetchPosts}
              activeOpacity={0.8}
            >
              <Text className="text-zinc-700">Retry</Text>
            </TouchableOpacity>
          </View>
        ) : sortedPosts.length === 0 ? (
          <View className="items-center py-12">
            <Text className="text-zinc-500">No posts yet.</Text>
          </View>
        ) : (
          <View className="border border-zinc-200 rounded overflow-hidden bg-white">
            {sortedPosts.map((post, index) => {
              const isPrivateFuturePost =
                post.visibleAt && new Date(post.visibleAt) > new Date();

              return (
                <TouchableOpacity
                  key={post.id}
                  onPress={() => navigateToPost(post.id)}
                  activeOpacity={0.8}
                  className={`p-4 ${
                    index === 0 ? "" : "border-t border-zinc-200"
                  } ${isPrivateFuturePost ? "bg-sky-50" : "bg-white"}`}
                >
                  <View className="gap-y-2">
                    <View>
                      <View className="flex-row items-center gap-x-1">
                        {post.pinned && (
                          <Pin size={12} color={colors.text.tertiary} />
                        )}
                        <Text className="text-base text-zinc-900">
                          {post.title}
                        </Text>
                      </View>
                      {isPrivateFuturePost && post.visibleAt && (
                        <Text className="text-sm text-blue-600 mt-1">
                          Only you can see this - will be posted{" "}
                          {formatTime(new Date(post.visibleAt), {
                            addSuffix: true,
                          })}
                        </Text>
                      )}
                    </View>
                    <View className="flex-row items-center flex-wrap gap-x-2">
                      <View className="text-sm text-zinc-500 inline flex-row items-center w-full overflow-hidden">
                        <ProfileImage
                          pfp={post.author.profilePicture}
                          size="small"
                          className="mr-1 inline"
                        />
                        <Text className="font-medium text-zinc-700">
                          {post.author.displayName}
                        </Text>
                        <Text className="text-sm text-zinc-500">
                          {` posted ${formatTime(new Date(post.createdAt), {
                            addSuffix: true,
                          })}`}
                        </Text>
                      </View>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </View>
    </ScrollView>
  );
}
