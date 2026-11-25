import {
  chosenConversationOption,
  conversationNoteLabel,
} from "@alliance/common/forms/conversation";
import type {
  ConversationField,
  FormValue,
} from "@alliance/common/forms/form-schema";
import { type FormValueUpdater } from "@alliance/shared/forms/formValueUpdater";
import { useExpertTyping } from "@alliance/shared/forms/useExpertTyping";
import { autoResponseLabel } from "@alliance/shared/lib/copy";
import { cn } from "@alliance/shared/styles/util";
import { useEffect } from "react";
import { TextInput, TouchableOpacity, View } from "react-native";
import Reanimated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import AppMarkdownWrapper from "../AppMarkdownWrapper";
import { MARKDOWN_HUG_WIDTH_STYLE, MarkdownTone } from "../markdownStyles";
import Text from "../system/Text";
import { ExpertBubble } from "./ExpertBubble";
import { inputClasses, renderValidationMessage } from "./fieldParts";

function TypingDot({ delay }: { delay: number }) {
  const opacity = useSharedValue(0.3);
  useEffect(() => {
    opacity.value = withDelay(
      delay,
      withRepeat(withTiming(1, { duration: 300 }), -1, true),
    );
  }, [delay, opacity]);
  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return (
    <Reanimated.View
      className="h-1.5 w-1.5 rounded-full bg-zinc-400"
      style={style}
    />
  );
}

function TypingDots({ name }: { name: string | undefined }) {
  return (
    <View
      accessible
      accessibilityLabel={name ? `${name} is typing` : "Typing"}
      accessibilityLiveRegion="polite"
      className="h-4 flex-row items-center gap-1"
    >
      {[0, 120, 240].map((delay) => (
        <TypingDot key={delay} delay={delay} />
      ))}
    </View>
  );
}

const Markdown = ({ text }: { text: string }) => (
  <AppMarkdownWrapper
    style={MARKDOWN_HUG_WIDTH_STYLE}
    tone={MarkdownTone.Default}
    markLinksLeavingApp
  >
    {text}
  </AppMarkdownWrapper>
);

export function ConversationInputField({
  field,
  value,
  onChange,
  noteValue,
  onNoteChange,
  disabled,
  errorMessage,
}: {
  field: ConversationField;
  value: FormValue | undefined;
  onChange?: (value: FormValueUpdater) => void;
  noteValue: FormValue | undefined;
  onNoteChange?: (value: FormValueUpdater) => void;
  disabled?: boolean;
  errorMessage: string | null;
}) {
  const hasError = errorMessage !== null;
  const choice = typeof value === "string" ? value : undefined;
  const chosen = chosenConversationOption(field, choice);
  const typing = useExpertTyping({
    choice,
    hasReply: Boolean(chosen?.reply),
    reduceMotion: useReducedMotion(),
  });

  return (
    <View className="gap-3">
      <ExpertBubble expert={field.expert} showName>
        <Markdown text={field.message} />
      </ExpertBubble>

      <View className="ml-[75px] items-start">
        <View
          accessibilityRole="radiogroup"
          className={cn(
            "max-w-[85%] overflow-hidden rounded-2xl border bg-white",
            hasError ? "border-red-500" : "border-zinc-200",
          )}
        >
          {field.options.map((option, index) => {
            const selected = option.value === choice;
            return (
              <TouchableOpacity
                key={option.value}
                onPress={() => onChange?.(option.value)}
                disabled={disabled}
                activeOpacity={0.7}
                accessibilityRole="radio"
                accessibilityState={{ checked: selected, disabled }}
                className={cn(
                  "min-h-12 flex-row items-start gap-3 px-4 py-3",
                  index > 0 && "border-t border-zinc-200",
                  selected && "bg-green/10",
                )}
              >
                <View
                  className={cn(
                    "mt-0.5 h-5 w-5 items-center justify-center rounded-full border-2 bg-white",
                    selected ? "border-green" : "border-zinc-500",
                  )}
                >
                  {selected ? (
                    <View className="h-2.5 w-2.5 rounded-full bg-green" />
                  ) : null}
                </View>
                <View className="shrink">
                  <Markdown text={option.label} />
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {chosen?.reply ? (
        <ExpertBubble
          expert={field.expert}
          faint={typing}
          caption={typing ? undefined : autoResponseLabel}
        >
          {typing ? (
            <TypingDots name={field.expert?.userName} />
          ) : (
            <View accessibilityLiveRegion="polite">
              <Markdown text={chosen.reply} />
            </View>
          )}
        </ExpertBubble>
      ) : null}

      {chosen?.note && !typing ? (
        <View className="ml-[75px] gap-1">
          <Text className="text-sm text-zinc-700">
            {conversationNoteLabel(chosen.note)}
          </Text>
          <TextInput
            accessibilityLabel={conversationNoteLabel(chosen.note)}
            className={cn(inputClasses({ hasError, disabled }), "text-base")}
            style={{ minHeight: 96, paddingVertical: 12, lineHeight: 24 }}
            value={typeof noteValue === "string" ? noteValue : ""}
            onChangeText={(text) => onNoteChange?.(text)}
            placeholder={chosen.note.placeholder}
            placeholderTextColor="#9ca3af"
            editable={!disabled}
            multiline
            textAlignVertical="top"
            scrollEnabled={false}
          />
        </View>
      ) : null}
      {renderValidationMessage(errorMessage)}
    </View>
  );
}
