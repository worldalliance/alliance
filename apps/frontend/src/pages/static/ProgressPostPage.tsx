import matter from "gray-matter";
import React from "react";
import { useLoaderData } from "react-router";
import Footer from "../../components/Footer";
import MarkdownWrapper from "../../components/MarkdownWrapper";
import PrelaunchNavbar from "../../components/PrelaunchNavbar";

export async function loader({ params }: { params: { slug: string } }) {
  const { slug } = params;
  const postFiles = import.meta.glob("/src/action-posts/*.md", {
    as: "raw",
  });

  const post = Object.entries(postFiles).find(([path]) => {
    const postSlug = path.split("/").pop()?.replace(".md", "") ?? "";
    return postSlug === slug;
  });

  if (!post) {
    return {
      content: "Post not found",
      frontmatter: { title: "Post not found" },
    };
  } else {
    const data = await post[1]();
    const { content, data: frontmatter } = matter(data);

    return {
      content,
      frontmatter,
    };
  }
}

export function meta({ data }: { data: Awaited<ReturnType<typeof loader>> }) {
  return [{ title: data.frontmatter.title ?? "Alliance" }];
}

const ProgressPostPage: React.FC = () => {
  const { content, frontmatter } = useLoaderData<typeof loader>();

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <PrelaunchNavbar transparent={false} absolute={false} />
      <div className="flex-1 container mx-auto pt-16 md:pt-28 pb-56 flex flex-col px-5">
        <div className="mx-auto w-full max-w-3xl flex flex-col">
          <h2 className="font-serif !font-medium !text-2xl md:!text-5xl mb-4">
            {frontmatter?.title}
          </h2>
          <div className="flex flex-col gap-y-0.5 text-lg  mb-4">
            <p className="">
              By{" "}
              {frontmatter?.authors.map((author: string) => author).join(", ")}
            </p>
            <p className="">
              {new Date(frontmatter?.date).toLocaleDateString("en-US", {
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </p>
          </div>
          <p className="self-start text-base text-white py-1 px-3 bg-navy rounded mb-16">
            {frontmatter?.members} members
          </p>
          <MarkdownWrapper id="post-content" markdownContent={content ?? ""} />
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default ProgressPostPage;
