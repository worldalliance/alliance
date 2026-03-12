import { formatLongDateEnUS } from "@alliance/shared/lib/dateFormatters";
import matter from "gray-matter";
import React from "react";
import { Link, href, useLoaderData } from "react-router";
import Footer from "../../components/Footer";
import PrelaunchNavbar from "../../components/PrelaunchNavbar";
import List from "@alliance/sharedweb/ui/List";

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
    })
  );

  return posts;
}

const ProgressListPage: React.FC = () => {
  const posts = useLoaderData<typeof loader>();

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <PrelaunchNavbar transparent={false} absolute={false} />
      <div className="flex-1 container mx-auto pt-16 md:pt-28 pb-56 flex flex-col px-5">
        <div className="mx-auto w-full max-w-3xl flex flex-col gap-4 md:gap-12">
          <h1 className="text-title-large">Progress</h1>
          <List className="w-full">
            {posts.map((post) => (
              <Link
                to={href("/progress/:slug", { slug: post.slug })}
                key={post.slug}
                className="flex flex-row justify-between hover:bg-zinc-50 p-3 md:p-5"
              >
                {/* <Card
                  style={CardStyle.White}
                  className="hover:border-zinc-400 transition-all duration-100"
                > */}
                <div className="">
                  <div className="flex justify-between">
                    <p className="text-lg md:text-xl font-medium">
                      {post.frontmatter.title}
                    </p>
                  </div>

                  <p className="text-base md:text-lg text-zinc-500">
                    {formatLongDateEnUS(new Date(post.frontmatter.date))}
                  </p>
                </div>
              </Link>
            ))}
          </List>
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default ProgressListPage;
