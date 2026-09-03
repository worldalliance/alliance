import {
  canSubmitWithdrawal,
  WITHDRAWAL_OPTION_LABELS,
  WITHDRAWAL_OPTIONS,
  withdrawalFlagsFromOption,
  type WithdrawalOption,
} from "@alliance/common/actionActivity";
import { type DeviceVisibilityTarget } from "@alliance/common/forms/device";
import {
  CHAT_TRANSCRIPT_SIZE_UNIT_PX,
  groupChatTranscriptMessages,
  type AccordionBlock,
  type BigLinkIcon,
  type ChatTranscriptMessage,
  type DisplayBlock,
  type ImagesItem,
} from "@alliance/common/forms/display-blocks";
import {
  isQuestionField,
  type AnyField,
  type FormSchema,
  type FormValue,
} from "@alliance/common/forms/form-schema";
import {
  interpolateDisplayBlock,
  interpolateFieldText,
} from "@alliance/common/forms/variable-interpolation";
import {
  FormResponseDto,
  SubmitFormDto,
  type UserDto,
} from "@alliance/shared/client";
import {
  applyDefaultValues,
  computeActiveUserKey,
  computeFormStorageKey,
  filterAnswersByFieldIds,
  formatUserLocationDisplayValue,
  resolveDisplayBlockForUser,
  restorableAnswers,
  restorablePublicAnswers,
  type UserLocationDisplayValue,
} from "@alliance/shared/formrenderer";
import { applyUploadedImage } from "@alliance/shared/forms/fileUploadSlots";
import {
  resolveFormValue,
  type SetFieldValue,
} from "@alliance/shared/forms/formValueUpdater";
import { stripCardIds } from "@alliance/shared/forms/listCards";
import { type ActionWithdrawal } from "@alliance/shared/lib/actionTaskPanel";
import {
  draftSaveFailed,
  outputFieldPublicToggle,
  waitingForImageUpload,
} from "@alliance/shared/lib/copy";
import { useImageUpload } from "@alliance/shared/lib/useImageUpload";
import { useVisibilityContext } from "@alliance/shared/lib/useVisibilityContext";
import { cn } from "@alliance/shared/styles/util";
import {
  useCurrentUserLocation,
  useFieldErrors,
  useFormDraftSync,
  useFormSchemaMaps,
  useFormValidation,
  useFormVisibility,
  usePreviousAnswerSources,
  useRandomizationKey,
  useVisibilityValidatorResults,
} from "@alliance/shared/useFormRenderer";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { setStringAsync as setClipboardStringAsync } from "expo-clipboard";
import { DeviceType, deviceType as expoDeviceType } from "expo-device";
import { router } from "expo-router";
import {
  Check,
  ChevronDown,
  CircleCheck,
  Copy,
  Ellipsis,
  File,
  FileCheck,
  FileText,
  MessagesSquare,
  Signature,
} from "lucide-react-native";
import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  ScrollView,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { resolveImageSource } from "../../lib/config";
import { getImageLoadSize } from "../../lib/imageLoadSize";
import { colors } from "../../lib/style/colors";
import AppMarkdownWrapper, { useHandleLinkPress } from "../AppMarkdownWrapper";
import { ImageGalleryModal } from "../ImageLightbox";
import { MARKDOWN_HUG_WIDTH_STYLE, MarkdownTone } from "../markdownStyles";
import ProfileImage from "../ProfileImage";
import Button, { ButtonColor, ButtonSize } from "../system/Button";
import Checkbox from "../system/Checkbox";
import Text, { FontWeight } from "../system/Text";
import FormModal from "./FormModal";
import HtmlBlock from "./HtmlBlock";
import { RenderField } from "./RenderField";
import RenderPreviousAnswer from "./RenderPreviousAnswer";
import VideoPlayer from "./VideoPlayer";

type FormRendererProps = {
  form: FormSchema;
  id: number;
  formSnapshotId: number | null;
  publicAction?: boolean;
  actionId: number;
  persistKey?: string | null;
  initialPageIndex?: number;
  userId?: string | number;
  phDistinctId?: string;
  sessionReplayUrl?: string;
  user?: Omit<UserDto, "email">;
  disableOptionRandomization?: boolean;
  loadCurrentUserLocation?: boolean;
  onFormStarted?: () => void;
  onAbandonAction?: (withdrawal: ActionWithdrawal) => void;
  renderFormAsCompleted?: boolean;
  completedFormResponse?: FormResponseDto;
  /** Save progress to the member's account as well as this device, so the form can be finished elsewhere. */
  syncDraftToServer?: boolean;
  onSubmit: ((data: SubmitFormDto) => Promise<void>) | null;
  scrollPageTo: (y: number, animated?: boolean) => void;
  scrollToEnd: (animated?: boolean) => void;
};

const detectDeviceType = (): DeviceVisibilityTarget => {
  if (expoDeviceType === null) return "mobile";
  switch (expoDeviceType) {
    case DeviceType.PHONE:
      return "mobile";
    case DeviceType.TABLET:
      return "tablet";
    case DeviceType.DESKTOP:
      return "desktop";
    case DeviceType.UNKNOWN:
    case DeviceType.TV:
      return "mobile";
    default:
      throw new Error(`unknown device type: ${expoDeviceType satisfies never}`);
  }
};

const DEVICE_TYPE: DeviceVisibilityTarget = detectDeviceType();

function CopyTextDisplayMobile({
  text,
  title,
}: {
  text: string;
  title?: string;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await setClipboardStringAsync(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <View>
      {title ? (
        <Text className="text-sm text-zinc-500 mb-1">{title}</Text>
      ) : null}
      <TouchableOpacity
        className="relative rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-3"
        onPress={handleCopy}
        activeOpacity={0.7}
      >
        <Text>{text}</Text>
        <View className="absolute top-1.5 right-1.5 flex-row items-center gap-1 bg-zinc-50 border border-zinc-200 px-1.5 py-0.5 rounded">
          {copied ? (
            <>
              <Text className="text-sm text-green" weight={FontWeight.Medium}>
                Copied!
              </Text>
              <Check size={14} className="text-green" />
            </>
          ) : (
            <Copy size={14} className="text-gray-400" />
          )}
        </View>
      </TouchableOpacity>
    </View>
  );
}

const bigLinkIcons: Record<BigLinkIcon, React.FC<{ size?: number }>> = {
  "messages-square": MessagesSquare,
  file: File,
  "file-text": FileText,
  "file-check": FileCheck,
  signature: Signature,
};

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

function ImageSlide({
  image,
  resolvedSrc,
  width,
  aspectRatio,
  onPress,
  onMeasure,
}: {
  image: ImagesItem;
  resolvedSrc: string;
  width: number | null;
  aspectRatio: number | null;
  onPress: () => void;
  onMeasure: (ratio: number) => void;
}) {
  const widthStyle = width === null ? {} : { width };
  const fullWidthClass = width === null && "w-full";

  return (
    <View style={widthStyle} className="items-center">
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.9}
        style={widthStyle}
        className={cn(fullWidthClass)}
      >
        <Image
          source={{ uri: resolvedSrc }}
          accessibilityLabel={image.alt}
          onLoad={(event) => {
            const size = getImageLoadSize(event);
            if (size) onMeasure(size.width / size.height);
          }}
          className={cn("bg-zinc-200 rounded-lg", fullWidthClass)}
          style={{
            ...widthStyle,
            ...(aspectRatio ? { aspectRatio } : { height: 192 }),
          }}
          resizeMode="contain"
        />
      </TouchableOpacity>
      {image.caption ? (
        <Text className="text-sm text-zinc-600 mt-2 text-center">
          {image.caption}
        </Text>
      ) : null}
    </View>
  );
}

function ImagesDisplay({ images }: { images: ImagesItem[] }) {
  const sources = images.map((image) => resolveImageSource(image.src));
  const [width, setWidth] = useState(0);
  const [index, setIndex] = useState(0);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  // Keyed by slide rather than indexed into an array, because images finish
  // loading out of order and a sparse array would put holes in the `Math.min`.
  const [measuredAspectRatios, setMeasuredAspectRatios] = useState<
    Record<number, number>
  >({});

  // One height for every slide, taken from the tallest image loaded so far, so
  // swiping doesn't resize the block under the reader's finger. `contain`
  // letterboxes the wider ones rather than cropping them.
  const measured = Object.values(measuredAspectRatios);
  const aspectRatio = measured.length ? Math.min(...measured) : null;

  const measureSlide = (slide: number) => (ratio: number) =>
    setMeasuredAspectRatios((current) => ({ ...current, [slide]: ratio }));

  const lightbox = (
    <ImageGalleryModal
      uris={sources}
      index={lightboxIndex}
      onClose={() => setLightboxIndex(null)}
    />
  );

  if (images.length === 1) {
    return (
      <View>
        <ImageSlide
          image={images[0]}
          resolvedSrc={sources[0]}
          width={null}
          aspectRatio={aspectRatio}
          onPress={() => setLightboxIndex(0)}
          onMeasure={measureSlide(0)}
        />
        {lightbox}
      </View>
    );
  }

  return (
    <View onLayout={(event) => setWidth(event.nativeEvent.layout.width)}>
      <ScrollView
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={(event) =>
          setIndex(
            width ? Math.round(event.nativeEvent.contentOffset.x / width) : 0,
          )
        }
      >
        {images.map((image, slide) => (
          <ImageSlide
            key={slide}
            image={image}
            resolvedSrc={sources[slide]}
            width={width}
            aspectRatio={aspectRatio}
            onPress={() => setLightboxIndex(slide)}
            onMeasure={measureSlide(slide)}
          />
        ))}
      </ScrollView>

      <View className="flex-row justify-center gap-1.5 mt-2">
        {images.map((_, dot) => (
          <View
            key={dot}
            className={cn(
              "h-2 w-2 rounded-full",
              dot === index ? "bg-zinc-700" : "bg-zinc-300",
            )}
          />
        ))}
      </View>

      {lightbox}
    </View>
  );
}

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
  const handleLinkPress = useHandleLinkPress();
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
      const IconComponent = bigLinkIcons[block.icon || "messages-square"];
      return (
        <TouchableOpacity
          className="flex-row items-center gap-3 rounded-lg border border-zinc-200 bg-white px-5 py-4 mr-3"
          onPress={() => handleLinkPress(block.url)}
        >
          <IconComponent size={20} />
          <View className="flex-1">
            <Text className="text-base text-black" weight={FontWeight.Medium}>
              {block.text}
            </Text>
            <Text
              className="mt-1 text-sm text-green"
              weight={FontWeight.Medium}
              numberOfLines={1}
            >
              {block.url}
            </Text>
          </View>
        </TouchableOpacity>
      );
    case "copytext":
      return <CopyTextDisplayMobile text={block.text} title={block.title} />;
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

const FormRenderer = ({
  form,
  id,
  formSnapshotId,
  onSubmit,
  persistKey,
  userId,
  user,
  disableOptionRandomization,
  loadCurrentUserLocation,
  onFormStarted,
  onAbandonAction,
  renderFormAsCompleted,
  completedFormResponse,
  syncDraftToServer,
  actionId,
  initialPageIndex,
  phDistinctId,
  sessionReplayUrl,
  scrollPageTo,
  scrollToEnd,
}: FormRendererProps) => {
  const schema = form as unknown as FormSchema;
  const readOnly = !!renderFormAsCompleted || !onSubmit;

  const storageKey = useMemo(
    () =>
      computeFormStorageKey({
        formId: id,
        instanceId: persistKey ?? undefined,
      }),
    [id, persistKey],
  );

  const activeUserKey = useMemo(
    () => computeActiveUserKey(user?.id, userId),
    [user?.id, userId],
  );

  const randomizationKey = useRandomizationKey({
    formId: id,
    activeUserKey,
    persistKey,
  });

  const userDefaultPublic = user?.formDataPreference === "public";
  const {
    fieldLookup,
    defaultValueMap,
    unknownKind,
    hasUserLocationDisplayBlock,
    outputFieldDefaultPublic,
    outputFieldIds,
    maxPageIndex,
  } = useFormSchemaMaps({ schema, userDefaultPublic });

  const { previousAnswerSchemas, previousAnswerData } =
    usePreviousAnswerSources({ schema });

  const clampPageIndex = (idx: number): number => {
    if (!Number.isFinite(idx)) return 0;
    const normalized = Math.floor(idx);
    if (normalized < 0) return 0;
    if (normalized > maxPageIndex) return maxPageIndex;
    return normalized;
  };

  const [currentPageIndex, setCurrentPageIndex] = useState<number>(() =>
    clampPageIndex(initialPageIndex ?? 0),
  );
  const [formData, setFormData] = useState<Record<string, FormValue>>(() => {
    if (readOnly) {
      const answers =
        (completedFormResponse?.answers as Record<string, FormValue>) || {};
      return filterAnswersByFieldIds(answers, fieldLookup);
    }
    return applyDefaultValues({}, defaultValueMap);
  });
  const [publicAnswers, setPublicAnswers] = useState<Record<string, boolean>>(
    () => {
      const completedPublicAnswers = completedFormResponse?.publicAnswers as
        | Record<string, unknown>
        | undefined;
      const defaults: Record<string, boolean> = {};
      for (const [fieldId, defaultIsPublic] of outputFieldDefaultPublic) {
        const completedValue = completedPublicAnswers?.[fieldId];
        defaults[fieldId] =
          typeof completedValue === "boolean"
            ? completedValue
            : defaultIsPublic;
      }
      return defaults;
    },
  );
  const visibilityValidatorResults = useVisibilityValidatorResults({
    schema,
    readOnly,
    savedResults: completedFormResponse?.visibilityValidatorResults,
  });
  const { fieldErrors, applyFieldErrorUpdates } = useFieldErrors();
  const [submitting, setSubmitting] = useState(false);
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [withdrawalOption, setWithdrawalOption] =
    useState<WithdrawalOption | null>(null);
  const [customReason, setCustomReason] = useState("");
  const [hasEmittedStart, setHasEmittedStart] = useState(false);
  const { currentUserLocationLoading, userLocationDisplayValue } =
    useCurrentUserLocation({
      enabled: !!loadCurrentUserLocation && hasUserLocationDisplayBlock,
      user,
    });

  const {
    userHasCity,
    firstContractSignedAt,
    completedActionCount,
    isLoading: visibilityContextLoading,
  } = useVisibilityContext(schema, {
    enabled: !!user,
  });

  // Draft persistence: tracks whether we've loaded a stored draft so the save
  // effect doesn't overwrite stored data with initial defaults.
  const draftLoaded = useRef(false);
  // When this device last stored a draft; null until the read finishes, which
  // is what the stored-draft apply below waits for before comparing.
  const [localDraftUpdatedAt, setLocalDraftUpdatedAt] = useState<number | null>(
    null,
  );

  // Restore draft from AsyncStorage on mount
  useEffect(() => {
    if (readOnly || !persistKey) {
      draftLoaded.current = true;
      setLocalDraftUpdatedAt(0);
      return;
    }

    let cancelled = false;
    (async () => {
      let updatedAt = 0;
      try {
        const raw = await AsyncStorage.getItem(storageKey);
        if (cancelled || !raw) {
          draftLoaded.current = true;
          setLocalDraftUpdatedAt(0);
          return;
        }
        const parsed = JSON.parse(raw);
        if (typeof parsed?.updatedAt === "number") {
          updatedAt = parsed.updatedAt;
        }
        if (parsed?.formData && typeof parsed.formData === "object") {
          const filtered = restorableAnswers(
            parsed.formData as Record<string, FormValue>,
            fieldLookup,
          );
          setFormData(applyDefaultValues(filtered, defaultValueMap));
        }
        if (parsed?.publicAnswers && typeof parsed.publicAnswers === "object") {
          const overrides = restorablePublicAnswers(
            parsed.publicAnswers as Record<string, unknown>,
            outputFieldIds,
          );
          if (Object.keys(overrides).length > 0) {
            setPublicAnswers((prev) => ({ ...prev, ...overrides }));
          }
        }
        if (typeof parsed?.currentPageIndex === "number") {
          setCurrentPageIndex(clampPageIndex(parsed.currentPageIndex));
        }
      } catch {
        // Corrupt or missing draft — ignore.
      }
      draftLoaded.current = true;
      setLocalDraftUpdatedAt(updatedAt);
    })();

    return () => {
      cancelled = true;
    };
    // Only run once on mount for a given storageKey
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey]);

  const draftSyncEnabled =
    !!syncDraftToServer && !readOnly && !!persistKey && formSnapshotId !== null;

  const { serverDraft, saveFailed, stopSyncing } = useFormDraftSync({
    enabled: draftSyncEnabled,
    formId: id,
    actionId,
    formSnapshotId,
    answers: formData,
    publicAnswers,
    currentPageIndex,
    edited: hasEmittedStart,
  });

  useEffect(() => {
    if (!draftSyncEnabled || hasEmittedStart || !serverDraft) return;
    if (localDraftUpdatedAt === null) return;
    if (new Date(serverDraft.updatedAt).getTime() <= localDraftUpdatedAt) {
      return;
    }
    const answers = restorableAnswers(
      serverDraft.answers as Record<string, FormValue>,
      fieldLookup,
    );
    setFormData(applyDefaultValues(answers, defaultValueMap));
    setPublicAnswers((prev) => ({
      ...prev,
      ...restorablePublicAnswers(serverDraft.publicAnswers, outputFieldIds),
    }));
    setCurrentPageIndex(clampPageIndex(serverDraft.currentPageIndex));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    serverDraft,
    draftSyncEnabled,
    hasEmittedStart,
    localDraftUpdatedAt,
    fieldLookup,
    defaultValueMap,
    outputFieldIds,
  ]);

  // Save draft to AsyncStorage when form state changes
  useEffect(() => {
    if (readOnly || !persistKey || !draftLoaded.current) return;

    const timeout = setTimeout(() => {
      AsyncStorage.setItem(
        storageKey,
        JSON.stringify({
          formData,
          publicAnswers,
          currentPageIndex,
          updatedAt: Date.now(),
        }),
      ).catch((e) => {
        // Storage write failed — non-critical.
        console.error("Failed to save draft", e);
      });
    }, 300);

    return () => clearTimeout(timeout);
  }, [
    formData,
    publicAnswers,
    currentPageIndex,
    persistKey,
    storageKey,
    readOnly,
  ]);

  useEffect(() => {
    const completedPublicAnswers = completedFormResponse?.publicAnswers as
      | Record<string, unknown>
      | undefined;

    setPublicAnswers((prev) => {
      const next: Record<string, boolean> = {};
      for (const [fieldId, defaultIsPublic] of outputFieldDefaultPublic) {
        const completedValue = completedPublicAnswers?.[fieldId];
        const fallbackValue =
          typeof completedValue === "boolean"
            ? completedValue
            : (prev[fieldId] ?? defaultIsPublic);
        next[fieldId] = fallbackValue;
      }

      const prevKeys = Object.keys(prev);
      const nextKeys = Object.keys(next);
      if (prevKeys.length !== nextKeys.length) {
        return next;
      }
      for (const key of nextKeys) {
        if (prev[key] !== next[key]) {
          return next;
        }
      }
      return prev;
    });
  }, [completedFormResponse?.publicAnswers, outputFieldDefaultPublic]);

  const {
    visibilityExtras,
    effectiveFormData,
    variableValues,
    isElementCurrentlyVisible,
    isFieldCurrentlyRequired,
    visiblePageIndices,
    nextVisiblePageIndex,
    previousVisiblePageIndex,
    validateFieldValue,
  } = useFormVisibility({
    schema,
    formData,
    readOnly,
    currentPageIndex,
    setCurrentPageIndex,
    effectiveDeviceType: DEVICE_TYPE,
    visibilityValidatorResults,
    fieldLookup,
    previousAnswerData,
    userHasCity,
    firstContractSignedAt,
    completedActionCount,
  });

  const { validatePage, validateAllPages } = useFormValidation({
    schema,
    readOnly,
    effectiveFormData,
    visibilityExtras,
    visiblePageIndices,
    isElementCurrentlyVisible,
    validateFieldValue,
    applyFieldErrorUpdates,
  });

  const markFormStarted = () => {
    if (hasEmittedStart) return;
    setHasEmittedStart(true);
    onFormStarted?.();
  };

  const handleFieldChange: SetFieldValue = (fieldId, value) => {
    if (readOnly) return;
    setFormData((prev) => ({
      ...prev,
      [fieldId]: resolveFormValue(value, prev[fieldId]),
    }));
    applyFieldErrorUpdates(
      { [fieldId]: null },
      fieldLookup.get(fieldId)?.kind === "list" ? fieldId : undefined,
    );
    markFormStarted();
  };

  const imageUpload = useImageUpload({
    onUploaded: (slot, imageKey) =>
      applyUploadedImage({ slot, imageKey, setFieldValue: handleFieldChange }),
    onStart: markFormStarted,
  });

  const handlePublicToggleChange = (fieldId: string, nextPublic: boolean) => {
    if (readOnly) return;
    setPublicAnswers((prev) => ({ ...prev, [fieldId]: nextPublic }));
  };

  const renderPublicToggle = (field: AnyField) => {
    if (!field.output?.output) return null;
    const useMakePublicToggle = !!field.output.privateByDefault;
    const defaultSharePublic =
      outputFieldDefaultPublic.get(field.id) ?? userDefaultPublic;
    const sharePublicly = publicAnswers[field.id] ?? defaultSharePublic;
    const toggleChecked = useMakePublicToggle ? sharePublicly : !sharePublicly;
    const toggleLabel = useMakePublicToggle
      ? outputFieldPublicToggle.showPublicly
      : outputFieldPublicToggle.hidePublicly;
    return (
      <View className="mt-2">
        <Checkbox
          checked={toggleChecked}
          disabled={readOnly}
          onChange={(next) => {
            const nextPublic = useMakePublicToggle ? next : !next;
            handlePublicToggleChange(field.id, nextPublic);
          }}
          label={toggleLabel}
        />
      </View>
    );
  };

  const handleNextPage = async () => {
    if (nextVisiblePageIndex === null) {
      return;
    }
    const result = await validatePage(currentPageIndex, true);
    if (result.isValid) {
      setCurrentPageIndex(nextVisiblePageIndex);
      setImmediate(() => scrollPageTo(0, false));
    }
  };

  const handlePreviousPage = () => {
    if (previousVisiblePageIndex === null) {
      return;
    }
    setCurrentPageIndex(previousVisiblePageIndex);
    setImmediate(() => scrollToEnd(false));
  };

  const handleSubmit = async () => {
    if (submitting || readOnly || !onSubmit || imageUpload.uploadingAny) {
      return;
    }
    if (formSnapshotId === null) {
      throw new Error(
        "FormRenderer: formSnapshotId is required when onSubmit is set",
      );
    }
    setSubmitting(true);

    if (nextVisiblePageIndex !== null) {
      const result = await validatePage(currentPageIndex, true);
      if (result.isValid) {
        setCurrentPageIndex(nextVisiblePageIndex);
        setImmediate(() => scrollPageTo(0, false));
      }
      setSubmitting(false);
      return;
    }

    const { isValid, firstInvalidPageIndex } = await validateAllPages();
    if (!isValid) {
      if (
        typeof firstInvalidPageIndex === "number" &&
        firstInvalidPageIndex !== currentPageIndex
      ) {
        setCurrentPageIndex(firstInvalidPageIndex);
        setImmediate(() => scrollPageTo(0, false));
      }
      setSubmitting(false);
      return;
    }

    const sanitizedAnswers = stripCardIds(
      filterAnswersByFieldIds(effectiveFormData, fieldLookup),
    );
    const submissionPayload: SubmitFormDto = {
      answers: sanitizedAnswers,
      formSnapshotId,
      actionId,
      visibilityValidatorResults,
      deviceType: DEVICE_TYPE,
      publicAnswers,
      phDistinctId,
      sessionReplayUrl,
    };

    onSubmit(submissionPayload)
      .then(() => {
        stopSyncing();
        if (persistKey) {
          AsyncStorage.removeItem(storageKey).catch(() => {});
        }
      })
      .finally(() => {
        setSubmitting(false);
      });
  };

  const handleAbandon = (option: WithdrawalOption) => {
    if (formSnapshotId === null) {
      throw new Error(
        "FormRenderer: formSnapshotId is required to abandon a form",
      );
    }
    const submissionPayload: SubmitFormDto = {
      answers: stripCardIds(formData),
      formSnapshotId,
      actionId,
      visibilityValidatorResults,
      deviceType: DEVICE_TYPE,
      publicAnswers,
    };

    stopSyncing();
    onAbandonAction?.({
      ...withdrawalFlagsFromOption(option),
      reason: customReason.trim(),
      partialFormData: submissionPayload,
    });
    setWithdrawOpen(false);
  };

  const currentPage = visiblePageIndices.includes(currentPageIndex)
    ? schema.pages[currentPageIndex]
    : undefined;
  const isFirstPage = previousVisiblePageIndex === null;
  const isLastPage = nextVisiblePageIndex === null;
  const visiblePageCount = visiblePageIndices.length;
  const currentVisiblePageNumber = Math.max(
    1,
    visiblePageIndices.indexOf(currentPageIndex) + 1,
  );

  const pageFields = currentPage?.fields;
  const resolvedPageElements = useMemo(
    () =>
      (pageFields ?? []).map((element) =>
        isQuestionField(element)
          ? element
          : resolveDisplayBlockForUser(element, activeUserKey),
      ),
    [pageFields, activeUserKey],
  );
  const pageElementVisible = useMemo(
    () =>
      resolvedPageElements.map((element) => isElementCurrentlyVisible(element)),
    [resolvedPageElements, isElementCurrentlyVisible],
  );
  const hasRenderedNeighborAbove = (idx: number): boolean => {
    for (let j = idx - 1; j >= 0; j--) {
      if (pageElementVisible[j]) return true;
    }
    return false;
  };
  const hasRenderedNeighborBelow = (idx: number): boolean => {
    for (let j = idx + 1; j < pageElementVisible.length; j++) {
      if (pageElementVisible[j]) return true;
    }
    return false;
  };

  if (unknownKind) {
    return (
      <View className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3">
        <Text weight={FontWeight.Medium} className="text-amber-800">
          This form can&apos;t be displayed
        </Text>
        <Text className="text-sm text-amber-800 mt-1">
          Restarting the app or downloading the latest version may fix the
          issue.
        </Text>
      </View>
    );
  }

  if (visibilityContextLoading) {
    return (
      <View className="items-center py-8">
        <ActivityIndicator color={colors.green} />
      </View>
    );
  }

  return (
    <View className="flex flex-col gap-y-8">
      <View className="gap-y-4">
        {currentPage?.fields.map((element, idx) => {
          if (!pageElementVisible[idx]) {
            return null;
          }
          if (!isQuestionField(element)) {
            const resolvedBlock = resolvedPageElements[idx] as DisplayBlock;
            return (
              <View key={resolvedBlock.id ?? `block-${idx}`}>
                <RenderDisplayBlockMobile
                  block={interpolateDisplayBlock(resolvedBlock, variableValues)}
                  previousAnswerData={previousAnswerData}
                  previousAnswerSchemas={previousAnswerSchemas}
                  hasRenderedNeighborAbove={hasRenderedNeighborAbove(idx)}
                  hasRenderedNeighborBelow={hasRenderedNeighborBelow(idx)}
                  user={user}
                  userLocation={userLocationDisplayValue}
                  userLocationLoading={currentUserLocationLoading}
                />
              </View>
            );
          }
          const field = element as AnyField;
          return (
            <View key={field.id}>
              <RenderField
                field={interpolateFieldText(field, variableValues)}
                value={effectiveFormData[field.id]}
                onChange={(value) => handleFieldChange(field.id, value)}
                fileUpload={readOnly ? undefined : imageUpload}
                disabled={readOnly}
                error={fieldErrors[field.id]}
                fieldErrors={fieldErrors}
                randomizationKey={randomizationKey}
                disableOptionRandomization={disableOptionRandomization}
                user={user}
                formData={effectiveFormData}
                isFieldRequired={isFieldCurrentlyRequired}
              />
              {renderPublicToggle(field)}
            </View>
          );
        })}
      </View>

      {readOnly && visiblePageCount > 1 && (
        <View>
          <View className="flex-row justify-between items-center mb-3">
            <Text className="text-sm text-zinc-500">
              Page {currentVisiblePageNumber} of {visiblePageCount}
            </Text>
          </View>
          <View className="flex-row gap-3">
            {!isFirstPage && (
              <Button
                onPress={handlePreviousPage}
                color={ButtonColor.Outline}
                size={ButtonSize.Medium}
                className="flex-1"
                title="Back"
              />
            )}
            {!isLastPage && (
              <Button
                onPress={() => {
                  if (nextVisiblePageIndex !== null) {
                    setCurrentPageIndex(nextVisiblePageIndex);
                  }
                  setImmediate(() => scrollPageTo(0, false));
                }}
                color={ButtonColor.Black}
                size={ButtonSize.Medium}
                className="flex-1"
                title="Next"
              />
            )}
          </View>
        </View>
      )}
      {!readOnly && (
        <View>
          <View className="">
            <View className="flex-row justify-between items-center mb-3">
              {visiblePageCount > 1 ? (
                <Text className="text-sm text-zinc-500">
                  Page {currentVisiblePageNumber} of {visiblePageCount}
                </Text>
              ) : null}
            </View>
            <View className="flex-row gap-1.5">
              {!isFirstPage && (
                <Button
                  onPress={handlePreviousPage}
                  color={ButtonColor.Outline}
                  size={ButtonSize.Medium}
                  className="flex-1"
                  disabled={submitting}
                  title="Back"
                />
              )}
              <Button
                onPress={isLastPage ? handleSubmit : handleNextPage}
                color={ButtonColor.Black}
                size={ButtonSize.Medium}
                className="flex-2 py-4! gap-x-1"
                disabled={submitting || imageUpload.uploadingAny}
              >
                {submitting ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    {isLastPage ? (
                      <CircleCheck size={16} color="#fff" strokeWidth={2.5} />
                    ) : null}
                    <Text
                      className="text-white text-base"
                      weight={FontWeight.Medium}
                    >
                      {isLastPage ? "Complete" : "Next"}
                    </Text>
                  </>
                )}
              </Button>
              {onAbandonAction && (
                <Button
                  onPress={() => setWithdrawOpen(true)}
                  color={ButtonColor.Outline}
                  size={ButtonSize.Medium}
                >
                  <Ellipsis size={15} />
                </Button>
              )}
            </View>
          </View>
          {imageUpload.uploadingAny && (
            <Text className="text-zinc-500 text-base p-2">
              {waitingForImageUpload}
            </Text>
          )}
          {saveFailed && (
            <Text className="text-amber-600 text-base p-2">
              {draftSaveFailed}
            </Text>
          )}
          {Object.keys(fieldErrors).length > 0 && (
            <Text className="text-red-500 text-base p-2">
              Your form has errors. Please fix before submitting.
            </Text>
          )}
        </View>
      )}

      {onAbandonAction && (
        <FormModal
          visible={withdrawOpen}
          onClose={() => setWithdrawOpen(false)}
        >
          <Text
            className="text-lg text-zinc-900 mb-3"
            weight={FontWeight.Semibold}
          >
            Withdraw from action
          </Text>
          <View className="gap-2 mb-3">
            {WITHDRAWAL_OPTIONS.map((option) => (
              <Fragment key={option}>
                <TouchableOpacity
                  activeOpacity={0.8}
                  className={cn(
                    "border rounded px-3 py-3",
                    withdrawalOption === option
                      ? "border-blue-600 bg-blue-100"
                      : "border-zinc-200",
                  )}
                  onPress={() => {
                    setWithdrawalOption((previous) =>
                      previous === option ? null : option,
                    );
                  }}
                >
                  <Text className="text-base text-zinc-900">
                    {WITHDRAWAL_OPTION_LABELS[option]}
                  </Text>
                </TouchableOpacity>
                {option === "moral" && (
                  <TouchableOpacity
                    activeOpacity={0.8}
                    className="border border-zinc-200 rounded px-3 py-3"
                    onPress={() => {
                      setWithdrawOpen(false);
                      router.push("/membership");
                    }}
                  >
                    <Text className="text-base text-zinc-900">On vacation</Text>
                  </TouchableOpacity>
                )}
              </Fragment>
            ))}
          </View>
          {withdrawalOption !== null && (
            <TextInput
              value={customReason}
              onChangeText={setCustomReason}
              placeholder="Explain in more detail..."
              placeholderTextColor="#9ca3af"
              multiline
              textAlignVertical="top"
              className="border border-zinc-200 rounded px-3 py-2 h-24 text-base text-zinc-900 mb-3"
            />
          )}
          <View className="w-full self-center">
            <Button
              onPress={() => {
                if (withdrawalOption !== null) handleAbandon(withdrawalOption);
              }}
              color={ButtonColor.Black}
              size={ButtonSize.Large}
              disabled={
                submitting ||
                !canSubmitWithdrawal(withdrawalOption, customReason)
              }
              title="Withdraw"
            />
          </View>
        </FormModal>
      )}
    </View>
  );
};

export default FormRenderer;
