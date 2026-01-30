import React from "react";
import FormMarkdownWrapper from "../ui/FormMarkdownWrapper";
import type { DisplayBlock } from "@alliance/shared/forms/display-blocks";
import { getApiUrl } from "../lib/config";
import { Link } from "react-router";
import Card from "../ui/Card";
import { MessagesSquare } from "lucide-react";
import { CardStyle } from "@alliance/shared/styles/card";

type Props = {
  block: DisplayBlock;
};

export default function RenderDisplayBlock({ block }: Props) {
  switch (block.kind) {
    case "header":
      return React.createElement(
        `h${block.level || 2}`,
        {
          className: `!font-semibold text-zinc-900 ${(block.level || 2) === 1
            ? "text-3xl"
            : (block.level || 2) === 2
              ? "text-2xl"
              : (block.level || 2) === 3
                ? "text-xl"
                : (block.level || 2) === 4
                  ? "text-lg"
                  : (block.level || 2) === 5
                    ? "text-base"
                    : ""
            }`,
        },
        block.text
      );

    case "text":
      return (
        <div className="text-zinc-900">
          <div className="prose prose-sm max-w-none">
            <FormMarkdownWrapper markdownContent={block.text} />
          </div>
        </div>
      );

    case "label":
      return <span className="  text-gray-700">{block.text}</span>;

    case "divider":
      return (
        <hr
          className={`border-gray-300 ${block.thickness === "hairline"
            ? "border-t"
            : block.thickness === "thin"
              ? "border-t"
              : block.thickness === "medium"
                ? "border-t-2"
                : block.thickness === "thick"
                  ? "border-t-4"
                  : "border-t"
            }`}
        />
      );

    case "spacer":
      return (
        <div
          className={`${block.size === "xs"
            ? "h-2"
            : block.size === "sm"
              ? "h-4"
              : block.size === "md"
                ? "h-8"
                : block.size === "lg"
                  ? "h-16"
                  : block.size === "xl"
                    ? "h-24"
                    : "h-8"
            }`}
        />
      );

    case "html":
      return <div dangerouslySetInnerHTML={{ __html: block.html }} />;

    case "image": {
      const resolvedSrc = block.src.includes("/")
        ? block.src
        : `${getApiUrl()}/images/${block.src}`;
      const hasCaption = Boolean(block.caption && block.caption.trim().length);
      return (
        <figure className="mx-auto max-w-full text-center">
          <img
            src={resolvedSrc}
            alt={block.alt}
            className="mx-auto max-h-80 w-auto rounded"
            style={{
              aspectRatio: block.aspectRatio
                ? block.aspectRatio.toString()
                : undefined,
            }}
          />
          {hasCaption && (
            <figcaption className="mt-2 text-sm text-gray-600">
              {block.caption}
            </figcaption>
          )}
        </figure>
      );
    }

    case "quote":
      return (
        <div className="prose prose-sm max-w-none bg-zinc-100 px-5 py-4">
          <FormMarkdownWrapper markdownContent={block.text} />
        </div>
      );

    case "biglink":
      return (
        <Link
          to={block.url}
          className="block group text-black "
        >
          <Card className="flex flex-row items-center gap-2 hover:bg-zinc-100" style={CardStyle.Grey}>
            <MessagesSquare size={16} />
            <div>
              <p className="text-base" style={{ fontWeight: 450 }}>
                {block.text}
              </p>
              <p className="text-sm text-green">
                {block.url}
              </p>
            </div>
          </Card>
        </Link>
      );

    default:
      return null;
  }
}
