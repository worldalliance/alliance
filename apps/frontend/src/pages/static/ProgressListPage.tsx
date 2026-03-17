import { formatLongDateEnUS } from "@alliance/shared/lib/dateFormatters";
import matter from "gray-matter";
import React from "react";
import { Link, href, useLoaderData } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { actionsFindPublicList } from "@alliance/shared/client";
import type { ActionDto } from "@alliance/shared/client";
import Footer from "../../components/Footer";
import PrelaunchNavbar from "../../components/PrelaunchNavbar";
import List from "@alliance/sharedweb/ui/List";
import Spinner from "@alliance/sharedweb/ui/Spinner";
import { ChevronRight } from "lucide-react";

export async function loader() {
  const postFiles = import.meta.glob("/src/action-posts/*.md", {
    as: "raw",
  });

  const posts = await Promise.all(
    Object.entries(postFiles).map(async ([path, data]) => {
      const { content, data: frontmatter } = matter(await data());
      return {
        slug: path.split("/").pop()?.replace(".md", "") ?? "",
        frontmatter,
        content,
      };
    }),
  );

  return posts;
}

function PublicActionCard({ action }: { action: ActionDto }) {
  const memberActionDate = action.events.find(
    (event) => event.newStatus === "member_action",
  )?.date;

  return (
    <Link
      to={href("/actions/:id", { id: action.id.toString() })}
      className="group flex flex-row items-center justify-between gap-4 p-4 hover:bg-zinc-50"
    >
      <div className="flex flex-col gap-0.5 min-w-0 flex-1">
        {memberActionDate && (
          <p className="text-xs md:text-sm text-green uppercase font-medium tracking-wide">
            {formatLongDateEnUS(new Date(memberActionDate))}
          </p>
        )}
        <p className="text-base md:text-lg font-medium text-black">
          {action.name}
        </p>
        {action.shortDescription && (
          <p className="text-zinc-500 text-base md:text-lg line-clamp-2">
            {action.shortDescription}
          </p>
        )}
      </div>
      <ChevronRight className="h-5 w-5 shrink-0 text-green" aria-hidden />
    </Link>
  );
}

const ProgressListPage: React.FC = () => {
  const posts = useLoaderData<typeof loader>();
  const { data: publicActions, isPending: actionsPending } = useQuery({
    queryKey: ["actions", "public"],
    queryFn: () => actionsFindPublicList().then((r) => r.data ?? []),
  });

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <PrelaunchNavbar transparent={false} absolute={false} />
      <div className="flex-1 container mx-auto pt-16 md:pt-28 pb-56 flex flex-col px-5">
        <div className="mx-auto w-full max-w-3xl flex flex-col gap-8 md:gap-16">
          <h1 className="text-title-large text-center">Progress</h1>

          <section className="flex flex-col gap-4">
            <h2 className="text-heading-public">Updates</h2>

            <List className="w-full border border-zinc-200 rounded">
              {posts.map((post) => (
                <Link
                  to={href("/progress/:slug", { slug: post.slug })}
                  key={post.slug}
                  className="flex flex-row items-center justify-between hover:bg-zinc-50 p-4"
                >
                  <div className="flex flex-col gap-1 min-w-0 flex-1">
                    <p className="text-xs md:text-sm text-blue uppercase font-medium tracking-wide">
                      {formatLongDateEnUS(new Date(post.frontmatter.date))}
                    </p>
                    <p className="text-base md:text-lg font-medium">
                      {post.frontmatter.title}
                    </p>
                  </div>
                  <ChevronRight
                    className="h-5 w-5 shrink-0 text-blue"
                    aria-hidden
                  />
                </Link>
              ))}
            </List>
          </section>

          <section className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <h2 className="text-heading-public">Actions</h2>
              <p className="text-zinc-500 text-lg">
                This list only includes actions that have been made public.
              </p>
            </div>
            {actionsPending ? (
              <div className="flex justify-center py-8">
                <Spinner size="large" />
              </div>
            ) : (
              <List className="w-full border border-zinc-200 rounded">
                {(publicActions ?? []).map((action) => (
                  <PublicActionCard key={action.id} action={action} />
                ))}
              </List>
            )}
          </section>
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default ProgressListPage;
