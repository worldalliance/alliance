import {
  CHAT_TRANSCRIPT_SIZE_UNIT_PX,
  groupChatTranscriptMessages,
  type AccordionBlock,
  type ChatTranscriptMessage,
  type DisplayBlock,
} from "@alliance/common/forms/display-blocks";
import { type FormSchema } from "@alliance/common/forms/form-schema";
import { type UserDto } from "@alliance/shared/client";
import {
  formatUserLocationDisplayValue,
  type UserLocationDisplayValue,
} from "@alliance/shared/formrenderer";
import { cn } from "@alliance/shared/styles/util";
import { ChevronDown } from "lucide-react-native";
import { useState } from "react";
import { ScrollView, TouchableOpacity, View } from "react-native";
import { colors } from "../../lib/style/colors";
import AppMarkdownWrapper from "../AppMarkdownWrapper";
import { MARKDOWN_HUG_WIDTH_STYLE, MarkdownTone } from "../markdownStyles";
import ProfileImage from "../ProfileImage";
import Text, { FontWeight } from "../system/Text";
import BigLinkDisplay from "./BigLinkDisplay";
import CopyTextDisplay from "./CopyTextDisplay";
import HtmlBlock from "./HtmlBlock";
import ImagesDisplay from "./ImagesDisplay";
import RenderPreviousAnswer from "./RenderPreviousAnswer";
import VideoPlayer from "./VideoPlayer";

const CHAT_BUBBLE_TONE: Record<ChatTranscriptMessage["side"], MarkdownTone> = {
  left: MarkdownTone.Default,
  right: MarkdownTone.Inverted,
};

type RenderDisplayBlockMobileProps = {
  block: DisplayBlock;
  previousAnswerData?: Record<number, Record<string, unknown>>;
  previousAnswerSchemas?: Record<number, FormSchema>;
  /** Used for video spacing: margin only when another visible block/field is above on the page */
  hasRenderedNeighborAbove?: boolean;
  hasRenderedNeighborBelow?: boolean;
  user?: Omit<UserDto, "email">;
  userLocation?: UserLocationDisplayValue;
  userLocationLoading?: boolean;
};

function AccordionDisplayMobile({ block }: { block: AccordionBlock }) {
  const [openIndices, setOpenIndices] = useState<number[]>([]);

  const toggle = (index: number) => {
    setOpenIndices((open) => {
      if (open.includes(index)) return open.filter((i) => i !== index);
      return block.singleOpen ? [index] : [...open, index];
    });
  };

  return (
    <View className="border-t border-zinc-200">
      {block.sections.map((section, index) => {
        const isOpen = openIndices.includes(index);
        return (
          <View key={section.id ?? index} className="border-b border-zinc-200">
            <TouchableOpacity
              onPress={() => toggle(index)}
              accessibilityRole="button"
              accessibilityState={{ expanded: isOpen }}
              className="flex-row items-center justify-between gap-3 py-3"
            >
              <Text className="flex-1 text-zinc-900" weight={FontWeight.Medium}>
                {section.title}
              </Text>
              <ChevronDown
                size={18}
                color={colors.text.icon}
                style={{ transform: [{ rotate: isOpen ? "180deg" : "0deg" }] }}
              />
            </TouchableOpacity>
            {isOpen && (
              <View className="gap-3 pb-4">
                {section.blocks.map((nested, nestedIndex) => (
                  <RenderDisplayBlockMobile
                    key={nested.id ?? nestedIndex}
                    block={nested}
                  />
                ))}
              </View>
            )}
          </View>
        );
      })}
    </View>
  );
}

export function RenderDisplayBlockMobile({
  block,
  previousAnswerData,
  previousAnswerSchemas,
  hasRenderedNeighborAbove = false,
  hasRenderedNeighborBelow = false,
  user,
  userLocation,
  userLocationLoading = false,
}: RenderDisplayBlockMobileProps) {
  switch (block.kind) {
    case "header":
      const headerClass = {
        1: "text-3xl",
        2: "text-2xl",
        3: "text-xl",
        4: "text-lg",
        5: "text-base",
        6: "text-base",
        none: "text-base",
      }[block.level ?? "none"];
      return (
        <Text
          className={cn("text-zinc-900 my-2", headerClass)}
          weight={FontWeight.Semibold}
          selectable
        >
          {block.text}
        </Text>
      );
    case "text":
      return <AppMarkdownWrapper>{block.text}</AppMarkdownWrapper>;
    case "label":
      return (
        <Text className="text-sm text-zinc-500" weight={FontWeight.Semibold}>
          {block.text}
        </Text>
      );
    case "divider":
      return <View className="h-px bg-zinc-200" />;
    case "spacer": {
      const sizes: Record<NonNullable<typeof block.size>, string> = {
        xs: "h-2",
        sm: "h-4",
        md: "h-8",
        lg: "h-12",
        xl: "h-16",
      };
      return <View className={sizes[block.size ?? "md"]} />;
    }
    case "quote":
      return (
        <View className="bg-zinc-100 p-4 rounded-lg gap-3">
          {block.userId != null ? (
            <View className="flex-row items-center gap-2">
              <ProfileImage
                pfp={block.userProfilePicture ?? null}
                size="medium"
              />
              <Text className="text-zinc-900" weight={FontWeight.Medium}>
                {block.userName ?? `User #${block.userId}`}
              </Text>
            </View>
          ) : null}
          <AppMarkdownWrapper>{block.text}</AppMarkdownWrapper>
        </View>
      );
    case "html":
      return <HtmlBlock html={block.html} />;
    case "images":
      if (block.images.length === 0) return null;
      return <ImagesDisplay images={block.images} />;
    case "biglink":
      return <BigLinkDisplay block={block} />;
    case "copytext":
      return <CopyTextDisplay block={block} />;
    case "accordion":
      if (block.sections.length === 0) return null;
      return <AccordionDisplayMobile block={block} />;
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
        <View>
          {title ? (
            <Text className="text-sm text-zinc-500 mb-1">{title}</Text>
          ) : null}
          <View className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-3">
            <Text className={hasLocation ? "text-zinc-900" : "text-zinc-500"}>
              {displayText}
            </Text>
          </View>
        </View>
      );
    }
    case "video": {
      return (
        <View
          className={cn(
            hasRenderedNeighborAbove && "mt-4",
            hasRenderedNeighborBelow && "mb-4",
          )}
        >
          <VideoPlayer
            src={block.src}
            videoId={block.videoId}
            caption={block.caption}
          />
        </View>
      );
    }
    case "chatTranscript": {
      const transcript = groupChatTranscriptMessages(block.messages).map(
        (group, gi) => {
          const name = group.side === "left" ? block.leftName : block.rightName;
          return (
            <View
              key={gi}
              className={cn(
                "gap-1",
                group.side === "right" ? "items-end" : "items-start",
              )}
            >
              {name?.trim() ? (
                <Text className="px-2 text-xs text-zinc-500">{name}</Text>
              ) : null}
              {group.texts.map((text, mi) => (
                <View
                  key={mi}
                  className={cn(
                    "max-w-[75%] rounded-2xl px-3.5 py-2",
                    group.side === "right" ? "bg-green" : "bg-zinc-200",
                    mi === group.texts.length - 1 &&
                      (group.side === "right"
                        ? "rounded-br-sm"
                        : "rounded-bl-sm"),
                  )}
                >
                  <AppMarkdownWrapper
                    style={MARKDOWN_HUG_WIDTH_STYLE}
                    tone={CHAT_BUBBLE_TONE[group.side]}
                  >
                    {text}
                  </AppMarkdownWrapper>
                </View>
              ))}
            </View>
          );
        },
      );
      return (
        <View className="rounded-lg border border-zinc-200 bg-white p-4">
          {block.size ? (
            <ScrollView
              style={{ maxHeight: block.size * CHAT_TRANSCRIPT_SIZE_UNIT_PX }}
              nestedScrollEnabled
              persistentScrollbar
              contentContainerStyle={{ gap: 12 }}
            >
              {transcript}
            </ScrollView>
          ) : (
            <View className="gap-3">{transcript}</View>
          )}
        </View>
      );
    }
    case "previousAnswer": {
      const answers = previousAnswerData?.[block.sourceFormId];
      const schema = previousAnswerSchemas?.[block.sourceFormId];
      return (
        <RenderPreviousAnswer
          block={block}
          schema={schema}
          answers={answers}
          user={user}
        />
      );
    }
    default:
      block satisfies never;
      return null;
  }
}
