import {
  CHAT_TRANSCRIPT_SIZE_UNIT_PX,
  groupChatTranscriptMessages,
  type BigLinkIcon,
  type DisplayBlock,
  type ImagesItem,
} from "@alliance/common/forms/display-blocks";
import type { FormSchema } from "@alliance/common/forms/form-schema";
import {
  formatUserLocationDisplayValue,
  type UserLocationDisplayValue,
} from "@alliance/shared/formrenderer";
import { CardStyle } from "@alliance/shared/styles/card";
import { cn } from "@alliance/shared/styles/util";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  File,
  FileCheck,
  FileText,
  MessagesSquare,
  Signature,
} from "lucide-react";
import React, { useRef, useState } from "react";
import { Link } from "react-router";
import { resolveImageSrc } from "../lib/imageSrc";
import { AvatarProfile } from "../ui/Avatar";
import Card from "../ui/Card";
import FormMarkdownWrapper from "../ui/FormMarkdownWrapper";
import ImageLightbox from "../ui/ImageLightbox";
import RenderPreviousAnswer from "./RenderPreviousAnswer";
import VideoPlayer from "./VideoPlayer";

const bigLinkIcons: Record<BigLinkIcon, React.FC<{ size?: number }>> = {
  "messages-square": MessagesSquare,
  file: File,
  "file-text": FileText,
  "file-check": FileCheck,
  signature: Signature,
};

function CopyTextDisplay({ text, title }: { text: string; title?: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div>
      {title && <span className="text-zinc-500 mb-1 block">{title}</span>}
      <div
        className="relative rounded-md border border-gray-200 bg-zinc-50 px-3 py-2 cursor-pointer hover:bg-zinc-100 transition-colors"
        onClick={handleCopy}
      >
        <span className="text-black whitespace-pre-wrap">{text}</span>
        <div className="absolute top-1.5 right-1.5 flex items-center gap-1 bg-zinc-50 border border-gray-200 px-1.5 py-0.5 rounded">
          {copied ? (
            <>
              <p className="text-sm text-green">Copied!</p>
              <Check size={14} className="text-green" />
            </>
          ) : (
            <Copy size={14} className="text-gray-400" />
          )}
        </div>
      </div>
    </div>
  );
}

function ImageFigure({
  resolvedSrc,
  image,
  openLabel,
  onOpen,
  className,
}: {
  resolvedSrc: string;
  image: ImagesItem;
  openLabel: string;
  onOpen: (e: React.MouseEvent) => void;
  className?: string;
}) {
  // The button's label wins over the `img` alt in the accessible name, so the
  // author's alt text has to go on the button or it is never announced.
  const label = image.alt?.trim() ? `${openLabel}: ${image.alt}` : openLabel;

  return (
    <figure className={cn("mx-auto max-w-full text-center", className)}>
      <button
        type="button"
        className="mx-auto block max-w-full rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 !cursor-zoom-in"
        onClick={onOpen}
        aria-label={label}
      >
        <img
          src={resolvedSrc}
          alt=""
          className="mx-auto max-h-80 w-auto rounded !cursor-zoom-in"
        />
      </button>
      {image.caption?.trim() && (
        <figcaption className="mt-2 text-sm text-gray-600">
          {image.caption}
        </figcaption>
      )}
    </figure>
  );
}

type Props = {
  block: DisplayBlock;
  previousAnswerData?: Record<number, Record<string, unknown>>;
  previousAnswerSchemas?: Record<number, FormSchema>;
  userLocation?: UserLocationDisplayValue;
  userLocationLoading?: boolean;
};

function ImagesDisplay({ images }: { images: ImagesItem[] }) {
  const [index, setIndex] = useState(0);
  const trackRef = useRef<HTMLDivElement>(null);
  const sources = images.map((image) => resolveImageSrc(image.src));

  const scrollToIndex = (next: number) => {
    const track = trackRef.current;
    if (!track) return;
    const clamped = Math.min(Math.max(next, 0), images.length - 1);
    track.scrollTo({ left: track.clientWidth * clamped, behavior: "smooth" });
    setIndex(clamped);
  };

  const handleScroll = () => {
    const track = trackRef.current;
    if (!track || track.clientWidth === 0) return;
    setIndex(Math.round(track.scrollLeft / track.clientWidth));
  };

  const arrowClass =
    "absolute top-1/2 -translate-y-1/2 z-10 rounded-full bg-white/80 p-1.5 text-zinc-800 shadow hover:bg-white disabled:opacity-0 disabled:pointer-events-none focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500";

  if (images.length === 1) {
    return (
      <ImageLightbox
        images={sources}
        renderPreview={(openAtIndex) => (
          <ImageFigure
            resolvedSrc={sources[0]}
            image={images[0]}
            openLabel="Open image"
            onOpen={(e) => openAtIndex(0, e)}
          />
        )}
      />
    );
  }

  return (
    <ImageLightbox
      images={sources}
      renderPreview={(openAtIndex) => (
        <div className="relative mx-auto max-w-full">
          <div
            ref={trackRef}
            onScroll={handleScroll}
            className="flex snap-x snap-mandatory overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {images.map((image, slide) => (
              <ImageFigure
                key={slide}
                resolvedSrc={sources[slide]}
                image={image}
                openLabel={`Open image ${slide + 1} of ${images.length}`}
                onOpen={(e) => openAtIndex(slide, e)}
                className="w-full shrink-0 snap-center"
              />
            ))}
          </div>

          <button
            type="button"
            className={cn(arrowClass, "left-1")}
            onClick={() => scrollToIndex(index - 1)}
            disabled={index === 0}
            aria-label="Previous image"
          >
            <ChevronLeft size={20} />
          </button>
          <button
            type="button"
            className={cn(arrowClass, "right-1")}
            onClick={() => scrollToIndex(index + 1)}
            disabled={index === images.length - 1}
            aria-label="Next image"
          >
            <ChevronRight size={20} />
          </button>

          <div className="mt-2 flex justify-center gap-1.5">
            {images.map((_, dot) => (
              <button
                key={dot}
                type="button"
                onClick={() => scrollToIndex(dot)}
                aria-label={`Go to image ${dot + 1} of ${images.length}`}
                aria-current={dot === index}
                className={cn(
                  "h-2 w-2 rounded-full transition-colors",
                  dot === index ? "bg-zinc-700" : "bg-zinc-300",
                )}
              />
            ))}
          </div>
        </div>
      )}
    />
  );
}

export default function RenderDisplayBlock({
  block,
  previousAnswerData,
  previousAnswerSchemas,
  userLocation,
  userLocationLoading = false,
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
        block.text,
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
            !block.thickness && "border-t",
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
            block.size === "xl" && "h-24",
          )}
        />
      );

    case "html":
      return <div dangerouslySetInnerHTML={{ __html: block.html }} />;

    case "images":
      if (block.images.length === 0) return null;
      return <ImagesDisplay images={block.images} />;

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
        <div className="bg-zinc-100 px-5 py-4 space-y-3">
          {block.userId != null && (
            <div className="flex items-center gap-2">
              <AvatarProfile
                pfp={block.userProfilePicture ?? null}
                size="medium"
              />
              <span className="font-medium text-zinc-900">
                {block.userName ?? `User #${block.userId}`}
              </span>
            </div>
          )}
          <div className="prose prose-sm max-w-none">
            <FormMarkdownWrapper markdownContent={block.text} />
          </div>
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

    case "copytext":
      return <CopyTextDisplay text={block.text} title={block.title} />;

    case "userLocation": {
      const locationText = formatUserLocationDisplayValue(userLocation);
      const displayText =
        locationText ||
        (userLocationLoading ? "Loading location..." : null) ||
        block.emptyText ||
        "No location set";
      const hasLocation = locationText.length > 0;
      const title = block.title?.trim();
      return (
        <div>
          {title ? (
            <span className="text-zinc-500 mb-1 block">{title}</span>
          ) : null}
          <div className="rounded-md border border-gray-200 bg-zinc-50 px-3 py-2">
            <span
              className={cn(
                "whitespace-pre-wrap",
                hasLocation ? "text-black" : "text-zinc-500 italic",
              )}
            >
              {displayText}
            </span>
          </div>
        </div>
      );
    }

    case "chatTranscript":
      return (
        <Card style={CardStyle.WhiteBorder} flex={false}>
          <div
            className="flex flex-col gap-3 overflow-y-auto"
            style={{
              maxHeight: block.size
                ? block.size * CHAT_TRANSCRIPT_SIZE_UNIT_PX
                : undefined,
            }}
          >
            {groupChatTranscriptMessages(block.messages).map((group, gi) => {
              const name =
                group.side === "left" ? block.leftName : block.rightName;
              return (
                <div
                  key={gi}
                  className={cn(
                    "flex flex-col gap-1",
                    group.side === "right" ? "items-end" : "items-start",
                  )}
                >
                  {name?.trim() && (
                    <span className="px-2 text-xs text-zinc-500">{name}</span>
                  )}
                  {group.texts.map((text, mi) => (
                    <div
                      key={mi}
                      className={cn(
                        "max-w-[75%] rounded-2xl px-3.5 py-2",
                        group.side === "right"
                          ? "bg-green text-white"
                          : "bg-zinc-200 text-zinc-900",
                        mi === group.texts.length - 1 &&
                          (group.side === "right"
                            ? "rounded-br-sm"
                            : "rounded-bl-sm"),
                      )}
                    >
                      <FormMarkdownWrapper
                        markdownContent={text}
                        inverted={group.side === "right"}
                      />
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </Card>
      );

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
        <RenderPreviousAnswer block={block} schema={schema} answers={answers} />
      );
    }

    default:
      return null;
  }
}
