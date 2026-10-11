import { forumFindAllPosts } from "@alliance/shared/client";
import { CardStyle } from "@alliance/shared/styles/card";
import Card from "@alliance/sharedweb/ui/Card";
import CenterLayout from "@alliance/sharedweb/ui/CenterLayout";
import List from "@alliance/sharedweb/ui/List";
import React, { useCallback } from "react";
import { href, useLoaderData, useNavigate } from "react-router";
import ForumListPost from "../../components/ForumListPost";
import { useGrayBackground } from "../../components/HtmlBackgroundManager";

export async function clientLoader() {
  const response = await forumFindAllPosts();
  return response.data ?? null;
}

const ForumPage: React.FC = () => {
  const posts = useLoaderData<typeof clientLoader>();

  const navigate = useNavigate();

  const handleCreatePost = useCallback(() => {
    navigate(href("/forum/edit/:postId", { postId: "new" }));
  }, [navigate]);

  useGrayBackground();

  if (posts === null) {
    return null;
  }

  return (
    <CenterLayout className="space-y-3">
      <Card
        onClick={handleCreatePost}
        style={CardStyle.Outline}
        className="text-zinc-500"
      >
        <p>Create a new thread...</p>
      </Card>
      <List className="mb-10">
        {posts.map((post) => (
          <ForumListPost key={post.id} post={post} />
        ))}
      </List>
    </CenterLayout>
  );
};

export default ForumPage;
