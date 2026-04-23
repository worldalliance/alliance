import { formatLongDateEnUS } from "@alliance/shared/lib/dateFormatters";
import matter from "gray-matter";
import React from "react";
import { Link, href, useLoaderData } from "react-router";
import Footer from "../../components/Footer";
import FeaturedImpactCard from "../../components/FeaturedImpactCard";
import PrelaunchNavbar from "../../components/PrelaunchNavbar";
import { FEATURED_IMPACT_ACTIONS } from "../../content/featuredImpactActions";
import List from "@alliance/sharedweb/ui/List";
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

const ProgressListPage: React.FC = () => {
  const posts = useLoaderData<typeof loader>();

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <PrelaunchNavbar transparent={false} absolute={false} />
      <div className="flex-1 container mx-auto pt-16 md:pt-28 pb-56 flex flex-col px-5">
        <div className="mx-auto w-full max-w-5xl flex flex-col gap-8 md:gap-20">
          <h1 className="text-title-large text-left">Progress</h1>

          <section className="flex flex-col gap-4">
            <h2 className="text-heading-public">Updates</h2>

            <List className="w-full">
              {posts.map((post) => (
                <Link
                  to={href("/progress/:slug", { slug: post.slug })}
                  key={post.slug}
                  className="flex flex-row items-center justify-between hover:bg-zinc-50 p-4 -mx-4"
                >
                  <div className="flex flex-col gap-1">
                    <p className="text-sm md:text-base text-zinc-500">
                      {formatLongDateEnUS(new Date(post.frontmatter.date))}
                    </p>
                    <p className="text-lg md:text-xl">
                      {post.frontmatter.title}
                    </p>
                  </div>
                  <ChevronRight
                    className="h-5 w-5 shrink-0 text-black"
                    aria-hidden
                  />
                </Link>
              ))}
            </List>
          </section>

          <section className="flex flex-col gap-6">
            <div className="flex flex-col gap-2">
              <h2 className="text-heading-public">Impact</h2>
              <p className="text-zinc-500 text-lg md:text-xl">
                At this stage, we are taking small-scale actions in order to
                learn and build our processes.
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {FEATURED_IMPACT_ACTIONS.map((action) => (
                <FeaturedImpactCard key={action.actionId} {...action} />
              ))}
            </div>
          </section>
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default ProgressListPage;
