import { useForumPosts } from "@alliance/shared/lib/useForumPosts";
import { CardStyle } from "@alliance/shared/styles/card";
import Card from "@alliance/sharedweb/ui/Card";
import CenterLayout from "@alliance/sharedweb/ui/CenterLayout";
import List from "@alliance/sharedweb/ui/List";
import Spinner from "@alliance/sharedweb/ui/Spinner";
import React, { useCallback } from "react";
import { href, useNavigate } from "react-router";
import ForumListPost from "../../components/ForumListPost";
import { useGrayBackground } from "../../components/HtmlBackgroundManager";
import LoadFailed from "../../components/LoadFailed";

const ForumPage: React.FC = () => {
  const { posts, isLoading, didFail, isFetching, refetch } = useForumPosts();

  const navigate = useNavigate();

  const handleCreatePost = useCallback(() => {
    navigate(href("/forum/edit/:postId", { postId: "new" }));
  }, [navigate]);

  useGrayBackground();

  return (
    <CenterLayout className="space-y-3">
      <Card
        onClick={handleCreatePost}
        style={CardStyle.Outline}
        className="text-zinc-500"
      >
        <p>Create a new thread...</p>
      </Card>
      {isLoading && !didFail && (
        <div className="flex items-center justify-center py-5">
          <Spinner size="large" />
        </div>
      )}
      {didFail && (
        <LoadFailed
          message="Couldn't load forum posts."
          onRetry={() => void refetch()}
          retrying={isFetching}
        />
      )}
      <List className="mb-10">
        {posts.map((post) => (
          <ForumListPost key={post.id} post={post} />
        ))}
      </List>
    </CenterLayout>
  );
};

export default ForumPage;
