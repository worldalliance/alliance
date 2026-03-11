import React from "react";
import FormMarkdownWrapper from "../ui/FormMarkdownWrapper";
import type { DisplayBlock } from "@alliance/shared/forms/display-blocks";
import { getApiUrl } from "../lib/config";
import { Link } from "react-router";
import Card from "../ui/Card";
import { cn } from "@alliance/shared/styles/util";
import {
  MessagesSquare,
  File,
  FileText,
  FileCheck,
  Signature,
} from "lucide-react";
import type { BigLinkIcon } from "@alliance/shared/forms/display-blocks";
import { CardStyle } from "@alliance/shared/styles/card";
import VideoPlayer from "./VideoPlayer";
import type { FormSchema } from "@alliance/shared/forms/formschema";
import RenderPreviousAnswer from "./RenderPreviousAnswer";

const bigLinkIcons: Record<BigLinkIcon, React.FC<{ size?: number }>> = {
  "messages-square": MessagesSquare,
  file: File,
  "file-text": FileText,
  "file-check": FileCheck,
  signature: Signature,
};

type Props = {
  block: DisplayBlock;
  previousAnswerData?: Record<number, Record<string, unknown>>;
  previousAnswerSchemas?: Record<number, FormSchema>;
};

export default function RenderDisplayBlock({
  block,
  previousAnswerData,
  previousAnswerSchemas,
}: Props) {
  switch (block.kind) {
    case "header":
      const headerLevel = block.level || 2;
      const headerClass = {
        1: "text-3xl",
        2: "text-2xl",
        3: "text-xl",
        4: "text-lg",
        5: "text-base",
        6: "",
      }[headerLevel];
      return React.createElement(
        `h${headerLevel}`,
        {
          className: cn("!font-semibold text-zinc-900", headerClass),
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
          className={cn(
            "border-gray-300",
            block.thickness === "hairline" && "border-t",
            block.thickness === "thin" && "border-t",
            block.thickness === "medium" && "border-t-2",
            block.thickness === "thick" && "border-t-4",
            !block.thickness && "border-t"
          )}
        />
      );

    case "spacer":
      return (
        <div
          className={cn(
            "h-8",
            block.size === "xs" && "h-2",
            block.size === "sm" && "h-4",
            block.size === "md" && "h-8",
            block.size === "lg" && "h-16",
            block.size === "xl" && "h-24"
          )}
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

    case "video":
      return (
        <VideoPlayer
          src={block.src}
          videoId={block.videoId}
          caption={block.caption}
        />
      );

    case "quote":
      return (
        <div className="prose prose-sm max-w-none bg-zinc-100 px-5 py-4">
          <FormMarkdownWrapper markdownContent={block.text} />
        </div>
      );

    case "biglink": {
      const IconComponent = bigLinkIcons[block.icon || "messages-square"];
      return (
        <Link to={block.url} className="block group text-black ">
          <Card
            className="flex flex-row items-center gap-3 hover:bg-zinc-100"
            style={CardStyle.Grey}
          >
            <IconComponent size={20} />
            <div>
              <p className="text-base" style={{ fontWeight: 450 }}>
                {block.text}
              </p>
              <p className="text-sm text-green">{block.url}</p>
            </div>
          </Card>
        </Link>
      );
    }

    case "previousAnswer": {
      const answers = previousAnswerData?.[block.sourceFormId];
      const schema = previousAnswerSchemas?.[block.sourceFormId];
      if (!answers || !schema) {
        const placeholder = block.emptyText || "No previous answer available";
        return (
          <div>
            {block.title && (
              <h3 className="text-base font-medium text-zinc-900 mb-2">
                {block.title}
              </h3>
            )}
            <p className="text-sm text-gray-400 italic">{placeholder}</p>
          </div>
        );
      }
      return (
        <RenderPreviousAnswer
          block={block}
          schema={schema}
          answers={answers}
        />
      );
    }

    default:
      return null;
  }
}
