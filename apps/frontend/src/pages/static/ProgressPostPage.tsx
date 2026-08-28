import { formatLongDateEnUS } from "@alliance/shared/lib/dateFormatters";
import { cn } from "@alliance/shared/styles/util";
import matter from "gray-matter";
import React from "react";
import { useLoaderData } from "react-router";
import MarkdownWrapper from "../../components/MarkdownWrapper";
import { socialPreviewMeta } from "../../lib/socialPreviewMeta";
import { PageShell } from "../../site/PageShell";
import { SITE_COL } from "../../site/ui";

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
  return socialPreviewMeta({ title: data.frontmatter.title ?? "Alliance" });
}

const ProgressPostPage: React.FC = () => {
  const { content, frontmatter } = useLoaderData<typeof loader>();

  return (
    <PageShell title="Progress" lede={frontmatter?.title}>
      <div className={cn(SITE_COL, "pt-16 pb-20 lg:pt-20 lg:pb-28")}>
        <div className="mx-auto flex w-full max-w-[46rem] flex-col gap-y-4">
          <div className="flex flex-col gap-y-0.5 text-[1.02rem] text-[var(--site-ink)]/55">
            <p>
              By{" "}
              {frontmatter?.authors.map((author: string) => author).join(", ")}
            </p>
            <p>{formatLongDateEnUS(new Date(frontmatter?.date))}</p>
          </div>

          <MarkdownWrapper
            id="post-content"
            markdownContent={content ?? ""}
            maxWidth="max-w-[46rem]"
            className="mt-8"
          />
        </div>
      </div>
    </PageShell>
  );
};

export default ProgressPostPage;
