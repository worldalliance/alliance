import { postBylineAuthors } from "@alliance/common/postAuthors";
import { useForumPosts } from "@alliance/shared/lib/useForumPosts";
import { formatTime } from "@alliance/shared/lib/utils";
import { cn } from "@alliance/shared/styles/util";
import { router } from "expo-router";
import { Fragment, useCallback, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  TouchableOpacity,
  View,
} from "react-native";
import ProfileImage from "../../../components/ProfileImage";
import PinnedIcon from "../../../components/system/PinnedIcon";
import { SimplePageTitle } from "../../../components/system/SimplePageTitle";
import Text, { FontWeight } from "../../../components/system/Text";
import { colors } from "../../../lib/style/colors";

export default function ForumScreen() {
  const { posts, isLoading, isError, refetch } = useForumPosts();
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  const navigateToPost = useCallback((postId: number) => {
    router.push(`/forum/post/${postId}`);
  }, []);

  const navigateToCreatePost = useCallback(() => {
    router.push("/forum/create");
  }, []);

  return (
    <View className="flex-1 bg-white">
      <SimplePageTitle title="Forum" />
      <ScrollView
        testID="vr-forum-ready"
        className="flex-1"
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

          {isLoading ? (
            <ActivityIndicator size="large" color={colors.green} />
          ) : isError ? (
            <View className="bg-red-50 border border-red-200 rounded p-4">
              <Text className="text-red-600">Failed to load forum posts</Text>
              <TouchableOpacity
                className="mt-3 px-3 py-2 rounded bg-white border border-zinc-200 self-start"
                onPress={() => void refetch()}
                activeOpacity={0.8}
              >
                <Text className="text-zinc-700">Retry</Text>
              </TouchableOpacity>
            </View>
          ) : posts.length === 0 ? (
            <View className="items-center py-12">
              <Text className="text-zinc-500">No posts yet.</Text>
            </View>
          ) : (
            <View className="overflow-hidden bg-white">
              {posts.map((post, index) => {
                const isPrivateFuturePost =
                  post.visibleAt && new Date(post.visibleAt) > new Date();

                return (
                  <TouchableOpacity
                    key={post.id}
                    onPress={() => navigateToPost(post.id)}
                    activeOpacity={0.8}
                    className={cn(
                      "p-4",
                      index !== 0 && "border-t border-zinc-200",
                      isPrivateFuturePost ? "bg-sky-50" : "bg-white",
                    )}
                  >
                    <View className="gap-y-2">
                      <View>
                        <View className="flex-row items-center gap-x-1">
                          {post.pinned && <PinnedIcon size="small" />}
                          <Text
                            className="text-base text-black"
                            weight={FontWeight.Medium}
                          >
                            {post.title}
                          </Text>
                        </View>
                        {isPrivateFuturePost && post.visibleAt && (
                          <Text className="text-sm text-blue-600 mt-1">
                            Not visible to members yet - will be posted{" "}
                            {formatTime(new Date(post.visibleAt), {
                              addSuffix: true,
                            })}
                          </Text>
                        )}
                      </View>
                      <View className="flex-row items-center flex-wrap gap-x-2">
                        <View className="inline flex-row flex-wrap items-center w-full">
                          {postBylineAuthors(post).map((author, i) => (
                            <Fragment key={author.id}>
                              <ProfileImage
                                pfp={author.profilePicture}
                                size="small"
                                className={cn("mr-1 inline", i > 0 && "ml-2")}
                              />
                              <Text className="text-sm">
                                {author.displayName}
                              </Text>
                            </Fragment>
                          ))}
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
    </View>
  );
}
