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
  type BigLinkIcon,
  type DisplayBlock,
} from "@alliance/common/forms/display-blocks";
import {
  collectSourceFormIds,
  isQuestionField,
  type AnyField,
  type CityFieldValue,
  type FormSchema,
  type FormValue,
} from "@alliance/common/forms/form-schema";
import {
  isElementCurrentlyVisible as isElementCurrentlyVisibleShared,
  isFieldConditionallyRequired,
  stripHiddenAnswers,
  type ConditionExtras,
} from "@alliance/common/forms/visibility";
import { type VisibleIfFormula } from "@alliance/common/forms/visible-if-formula";
import {
  FormResponseDto,
  SubmitFormDto,
  tasksGetForm,
  tasksGetMyFormResponse,
  tasksRunValidator,
  userMyLocation,
  type UserDto,
} from "@alliance/shared/client";
import {
  applyDefaultValues,
  collectManualSourceFormIds,
  computeActiveUserKey,
  computeFormStorageKey,
  filterAnswersByFieldIds,
  findUnknownConditionKind,
  findUnknownFormElementKind,
  formatUserLocationDisplayValue,
  getFallbackVisiblePageIndex,
  getNextVisiblePageIndex,
  getPreviousVisiblePageIndex,
  getVisiblePageIndices,
  resolveDisplayBlockForUser,
  resolveFieldDefaultValue,
  validateFieldValue as validateFieldValueShared,
  type UserLocationDisplayValue,
} from "@alliance/shared/formrenderer";
import { type ActionWithdrawal } from "@alliance/shared/lib/actionTaskPanel";
import { outputFieldPublicToggle } from "@alliance/shared/lib/copy";
import { useVisibilityContext } from "@alliance/shared/lib/useVisibilityContext";
import { cn } from "@alliance/shared/styles/util";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { setStringAsync as setClipboardStringAsync } from "expo-clipboard";
import { DeviceType, deviceType as expoDeviceType } from "expo-device";
import { router } from "expo-router";
import {
  Check,
  CircleCheck,
  Copy,
  Ellipsis,
  File,
  FileCheck,
  FileText,
  MessagesSquare,
  Signature,
} from "lucide-react-native";
import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  Image,
  ScrollView,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import AppMarkdownWrapper, { useHandleLinkPress } from "../AppMarkdownWrapper";
import { ImageLightboxModal } from "../ImageLightbox";
import ProfileImage from "../ProfileImage";
import Button, { ButtonColor, ButtonSize } from "../system/Button";
import Checkbox from "../system/Checkbox";
import Text, { FontWeight } from "../system/Text";
import FormModal from "./FormModal";
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

/**
 * The markdown library's default paragraph style forces width:'100%' (and the
 * wrapper's textgroup uses flex:1), which stretches auto-width chat bubbles to
 * their max width. Keep bubbles sized to their content.
 */
const CHAT_BUBBLE_MARKDOWN_STYLE = {
  // flexWrap:'wrap' (the library default) disables flexShrink in Yoga, which
  // breaks text wrapping in shrink-to-fit bubbles; a paragraph is a single
  // textgroup, so nowrap loses nothing.
  paragraph: {
    width: "auto" as const,
    flexWrap: "nowrap" as const,
    flexShrink: 1,
  },
  textgroup: { flexShrink: 1 },
};

/** Light-on-dark markdown styling for right-side (green) chat bubbles. */
const CHAT_BUBBLE_INVERTED_MARKDOWN_STYLE = {
  ...CHAT_BUBBLE_MARKDOWN_STYLE,
  body: { fontSize: 15, lineHeight: 22, color: "#ffffff" },
  heading1: { fontSize: 20, fontWeight: "600" as const, color: "#ffffff" },
  heading2: { fontSize: 18, fontWeight: "600" as const, color: "#ffffff" },
  heading3: { fontSize: 16, fontWeight: "600" as const, color: "#ffffff" },
  code_inline: {
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 2,
    fontFamily: "monospace",
    fontSize: 13,
  },
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

function ImageBlock({
  src,
  alt,
  caption,
  aspectRatio: configuredAspectRatio,
}: {
  src: string;
  alt?: string;
  caption?: string;
  aspectRatio?: number;
}) {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [measuredAspectRatio, setMeasuredAspectRatio] = useState<number | null>(
    null,
  );
  const aspectRatio = configuredAspectRatio ?? measuredAspectRatio;
  return (
    <View className="items-center">
      <TouchableOpacity
        onPress={() => setLightboxOpen(true)}
        activeOpacity={0.9}
        className="w-full"
      >
        <Image
          source={{ uri: src }}
          accessibilityLabel={alt}
          onLoad={({ nativeEvent: { source } }) =>
            source.height > 0 &&
            setMeasuredAspectRatio(source.width / source.height)
          }
          className="w-full bg-zinc-200 rounded-lg"
          style={aspectRatio ? { aspectRatio } : { height: 192 }}
          resizeMode="contain"
        />
      </TouchableOpacity>
      {caption && (
        <Text className="text-sm text-zinc-600 mt-2 text-center">
          {caption}
        </Text>
      )}
      <ImageLightboxModal
        uri={lightboxOpen ? src : null}
        onClose={() => setLightboxOpen(false)}
      />
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
    case "image":
      return (
        <ImageBlock
          src={block.src}
          alt={block.alt}
          caption={block.caption}
          aspectRatio={block.aspectRatio}
        />
      );
    case "biglink":
      const IconComponent = bigLinkIcons[block.icon || "messages-square"];
      return (
        <TouchableOpacity
          className="flex-row items-center gap-3 rounded-lg border border-zinc-200 bg-white px-5 py-4 mr-3"
          onPress={() => handleLinkPress(block.url)}
        >
          <IconComponent size={20} />
          <View className="">
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
      return block.videoId !== undefined ? (
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
      ) : (
        <Text className="text-sm text-red-500">Could not load video</Text>
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
                    style={
                      group.side === "right"
                        ? CHAT_BUBBLE_INVERTED_MARKDOWN_STYLE
                        : CHAT_BUBBLE_MARKDOWN_STYLE
                    }
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

  const randomizationKey = useMemo(() => {
    const base = `form:${id}`;
    if (activeUserKey) {
      return `${base}:user:${activeUserKey}`;
    }
    if (persistKey !== undefined && persistKey !== null && persistKey !== "") {
      return `${base}:persist:${String(persistKey)}`;
    }
    return base;
  }, [id, activeUserKey, persistKey]);

  const { fieldLookup, defaultValueMap } = useMemo(() => {
    const lookup = new Map<string, AnyField>();
    const defaults = new Map<string, FormValue>();

    for (const page of schema.pages) {
      for (const element of page.fields) {
        if (isQuestionField(element)) {
          lookup.set(element.id, element);
          const defaultValue = resolveFieldDefaultValue(element);
          if (defaultValue !== undefined) {
            defaults.set(element.id, defaultValue);
          }
        }
      }
    }

    return { fieldLookup: lookup, defaultValueMap: defaults };
  }, [schema]);

  const unknownKind = useMemo(
    () =>
      findUnknownFormElementKind(schema) ?? findUnknownConditionKind(schema),
    [schema],
  );
  const hasUserLocationDisplayBlock = useMemo(
    () =>
      schema.pages?.some((page) =>
        page.fields?.some(
          (element) =>
            !isQuestionField(element) && element.kind === "userLocation",
        ),
      ) ?? false,
    [schema],
  );

  const previousAnswerSourceFormIds = useMemo(() => {
    const ids = new Set<number>();
    for (const page of schema.pages) {
      for (const element of page.fields) {
        if (!isQuestionField(element) && element.kind === "previousAnswer") {
          if (element.sourceFormId) {
            ids.add(element.sourceFormId);
          }
          for (const id of collectManualSourceFormIds(element)) {
            ids.add(id);
          }
        }
      }
    }
    for (const id of collectSourceFormIds(schema)) {
      ids.add(id);
    }
    return Array.from(ids);
  }, [schema]);

  const [previousAnswerSchemas, setPreviousAnswerSchemas] = useState<
    Record<number, FormSchema>
  >({});
  const [previousAnswerData, setPreviousAnswerData] = useState<
    Record<number, Record<string, unknown>>
  >({});

  useEffect(() => {
    if (previousAnswerSourceFormIds.length === 0) {
      setPreviousAnswerSchemas({});
      setPreviousAnswerData({});
      return;
    }

    let cancelled = false;

    (async () => {
      const schemaEntries = await Promise.all(
        previousAnswerSourceFormIds.map(async (formId) => {
          try {
            const response = await tasksGetForm({ path: { id: formId } });
            if (response.data) {
              const form = response.data as Record<string, unknown>;
              return [formId, form.schema as FormSchema] as const;
            }
          } catch {
            // Form not found or inaccessible.
          }

          return null;
        }),
      );

      if (cancelled) return;

      const schemas: Record<number, FormSchema> = {};
      for (const entry of schemaEntries) {
        if (entry) {
          schemas[entry[0]] = entry[1];
        }
      }
      setPreviousAnswerSchemas(schemas);

      const dataEntries = await Promise.all(
        previousAnswerSourceFormIds.map(async (formId) => {
          try {
            const response = await tasksGetMyFormResponse({
              path: { id: formId },
            });
            if (response.data) {
              const formResponse = response.data as Record<string, unknown>;
              return [
                formId,
                (formResponse.answers as Record<string, unknown>) ?? {},
              ] as const;
            }
          } catch {
            // User has not submitted the source form.
          }

          return null;
        }),
      );

      if (cancelled) return;

      const data: Record<number, Record<string, unknown>> = {};
      for (const entry of dataEntries) {
        if (entry) {
          data[entry[0]] = entry[1];
        }
      }
      setPreviousAnswerData(data);
    })();

    return () => {
      cancelled = true;
    };
  }, [previousAnswerSourceFormIds]);

  const pageCount = schema.pages?.length ?? 0;
  const maxPageIndex = Math.max(0, (pageCount || 1) - 1);
  const userDefaultPublic = user?.formDataPreference === "public";
  const outputFieldDefaultPublic = useMemo(() => {
    const defaults = new Map<string, boolean>();
    for (const page of schema.pages ?? []) {
      for (const element of page.fields ?? []) {
        if (isQuestionField(element)) {
          if (element.output?.output) {
            defaults.set(
              element.id,
              element.output.privateByDefault ? false : userDefaultPublic,
            );
          }
        }
      }
    }
    return defaults;
  }, [schema, userDefaultPublic]);

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
  const [visibilityValidatorResults, setVisibilityValidatorResults] = useState<
    Record<number, boolean>
  >(() => {
    if (readOnly && completedFormResponse?.visibilityValidatorResults) {
      return completedFormResponse.visibilityValidatorResults as Record<
        number,
        boolean
      >;
    }
    return {};
  });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [withdrawalOption, setWithdrawalOption] =
    useState<WithdrawalOption | null>(null);
  const [customReason, setCustomReason] = useState("");
  const [hasEmittedStart, setHasEmittedStart] = useState(false);
  const [currentUserLocation, setCurrentUserLocation] =
    useState<CityFieldValue | null>(null);
  const [currentUserLocationLoading, setCurrentUserLocationLoading] =
    useState(false);

  useEffect(() => {
    if (!loadCurrentUserLocation || !hasUserLocationDisplayBlock || !user) {
      setCurrentUserLocation(null);
      setCurrentUserLocationLoading(false);
      return;
    }

    let cancelled = false;
    setCurrentUserLocation(null);
    setCurrentUserLocationLoading(true);

    userMyLocation()
      .then((response) => {
        if (cancelled) return;
        setCurrentUserLocation(response.data?.city ?? null);
      })
      .catch(() => {
        if (cancelled) return;
        setCurrentUserLocation(null);
      })
      .finally(() => {
        if (cancelled) return;
        setCurrentUserLocationLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [hasUserLocationDisplayBlock, loadCurrentUserLocation, user?.id, user]);

  const userLocationDisplayValue =
    currentUserLocation ?? user?.customCityString ?? null;

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

  // Restore draft from AsyncStorage on mount
  useEffect(() => {
    if (readOnly || !persistKey) {
      draftLoaded.current = true;
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(storageKey);
        if (cancelled || !raw) {
          draftLoaded.current = true;
          return;
        }
        const parsed = JSON.parse(raw);
        if (parsed?.formData && typeof parsed.formData === "object") {
          const filtered = filterAnswersByFieldIds(
            parsed.formData as Record<string, FormValue>,
            fieldLookup,
          );
          setFormData(applyDefaultValues(filtered, defaultValueMap));
        }
        if (parsed?.publicAnswers && typeof parsed.publicAnswers === "object") {
          const overrides: Record<string, boolean> = {};
          for (const [fieldId, value] of Object.entries(
            parsed.publicAnswers as Record<string, unknown>,
          )) {
            if (
              outputFieldDefaultPublic.has(fieldId) &&
              typeof value === "boolean"
            ) {
              overrides[fieldId] = value;
            }
          }
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
    })();

    return () => {
      cancelled = true;
    };
    // Only run once on mount for a given storageKey
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey]);

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

  const fieldPositions = useRef<Record<string, number>>({});
  const fieldScreenPositions = useRef<Record<string, number>>({});

  const scrollToField = useCallback(
    (fieldId: string) => {
      const yPosition = fieldPositions.current[fieldId];
      scrollPageTo(Math.max(0, yPosition + 100));
    },
    [scrollPageTo],
  );

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

  const visibilityValidatorIds = useMemo(() => {
    const ids = new Set<number>();
    const collectFromVisibleIfFormula = (
      visibleIfFormula: VisibleIfFormula | undefined,
    ) => {
      if (!visibleIfFormula?.conditions) {
        return;
      }
      for (const condition of Object.values(visibleIfFormula.conditions)) {
        if (condition.kind === "validator") {
          ids.add(condition.validatorId);
        }
      }
    };
    for (const page of schema.pages) {
      collectFromVisibleIfFormula(page.visibleIfFormula);
      for (const element of page.fields) {
        collectFromVisibleIfFormula(element.visibleIfFormula);
        if (isQuestionField(element) && element.kind === "list") {
          if (Array.isArray(element.fields)) {
            for (const sub of element.fields) {
              collectFromVisibleIfFormula(sub.visibleIfFormula);
            }
          }
        }
      }
    }
    return Array.from(ids);
  }, [schema]);

  useEffect(() => {
    if (readOnly) {
      return;
    }
    const missingIds = visibilityValidatorIds.filter(
      (id) => !(id in visibilityValidatorResults),
    );
    if (!missingIds.length) {
      return;
    }

    let cancelled = false;
    (async () => {
      const entries = await Promise.all(
        missingIds.map(async (validatorId) => {
          try {
            const response = await tasksRunValidator({
              path: { id: validatorId },
              body: {},
            });
            if (!response.data || response.error) {
              throw response.error ?? new Error("Missing validator response");
            }
            return [validatorId, response.data.isValid] as const;
          } catch (error) {
            console.error(
              `Failed to evaluate visibility validator ${validatorId}`,
              error,
            );
            return [validatorId, false] as const;
          }
        }),
      );
      if (cancelled) return;
      setVisibilityValidatorResults((prev) => {
        const next = { ...prev };
        for (const [id, value] of entries) {
          next[id] = value;
        }
        return next;
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [visibilityValidatorIds, visibilityValidatorResults, readOnly]);

  // The single source of the account/device/validator state every visibility
  // and requiredness evaluation reads. Built once so a new condition kind is
  // added here rather than at each call site — miss one and it would silently
  // evaluate against the guest default, since every key is optional.
  const visibilityExtras = useMemo<ConditionExtras>(
    () => ({
      deviceType: DEVICE_TYPE,
      visibilityValidatorResults,
      fieldLookup,
      previousAnswerData,
      userHasCity,
      firstContractSignedAt,
      completedActionCount,
    }),
    [
      visibilityValidatorResults,
      fieldLookup,
      previousAnswerData,
      userHasCity,
      firstContractSignedAt,
      completedActionCount,
    ],
  );

  // `readOnly` isn't part of `ConditionExtras` — only the element/page
  // visibility helpers take it, to treat a completed form's fields as visible.
  const visibilityExtrasReadOnly = useMemo(
    () => ({ ...visibilityExtras, readOnly }),
    [visibilityExtras, readOnly],
  );

  // Answers for fields the user can't currently see, treated as never given:
  // visibility, validation, rendering, and the submitted payload all read
  // this, so what the user sees is exactly what submits. Raw formData still
  // holds the hidden values, so re-showing a field restores what the user
  // typed.
  const effectiveFormData = useMemo(
    () =>
      stripHiddenAnswers(
        schema.pages ?? [],
        formData,
        visibilityExtrasReadOnly,
      ),
    [schema.pages, formData, visibilityExtrasReadOnly],
  );

  const isElementCurrentlyVisible = useCallback(
    (
      element: AnyField | DisplayBlock,
      data?: Record<string, FormValue>,
    ): boolean =>
      isElementCurrentlyVisibleShared(
        element,
        data ?? effectiveFormData,
        visibilityExtrasReadOnly,
      ),
    [effectiveFormData, visibilityExtrasReadOnly],
  );

  // Mirrors `isElementCurrentlyVisible`: the same answers and extras, so the
  // label agrees with what `validateFieldValue` and the server's submit-time
  // check enforce.
  const isFieldCurrentlyRequired = useCallback(
    (field: AnyField, data?: Record<string, FormValue>): boolean =>
      isFieldConditionallyRequired(
        field,
        data ?? effectiveFormData,
        visibilityExtras,
      ),
    [effectiveFormData, visibilityExtras],
  );

  const visiblePageIndices = useMemo(
    () =>
      getVisiblePageIndices(
        schema.pages ?? [],
        effectiveFormData,
        visibilityExtrasReadOnly,
      ),
    [schema.pages, effectiveFormData, visibilityExtrasReadOnly],
  );

  const nextVisiblePageIndex = useMemo(
    () => getNextVisiblePageIndex(visiblePageIndices, currentPageIndex),
    [visiblePageIndices, currentPageIndex],
  );

  const previousVisiblePageIndex = useMemo(
    () => getPreviousVisiblePageIndex(visiblePageIndices, currentPageIndex),
    [visiblePageIndices, currentPageIndex],
  );

  // If answers change and hide the current page, move to the nearest visible
  // page.
  useEffect(() => {
    const fallback = getFallbackVisiblePageIndex(
      visiblePageIndices,
      currentPageIndex,
    );
    if (fallback !== null) {
      setCurrentPageIndex(fallback);
    }
  }, [visiblePageIndices, currentPageIndex]);

  const validateFieldValue = useCallback(
    (
      field: AnyField,
      fieldValue: FormValue | undefined,
      data?: Record<string, FormValue>,
    ): string | null =>
      validateFieldValueShared(
        field,
        fieldValue,
        data ?? effectiveFormData,
        visibilityExtras,
      ),
    [effectiveFormData, visibilityExtras],
  );

  const applyFieldErrorUpdates = useCallback(
    (updates: Record<string, string | null>) => {
      if (!updates || Object.keys(updates).length === 0) return;

      setFieldErrors((prev) => {
        let changed = false;
        const next = { ...prev };
        for (const [fieldId, message] of Object.entries(updates)) {
          if (message && message.trim().length > 0) {
            if (next[fieldId] !== message) {
              next[fieldId] = message;
              changed = true;
            }
          } else if (fieldId in next) {
            delete next[fieldId];
            changed = true;
          }
        }
        return changed ? next : prev;
      });
    },
    [],
  );

  const runCustomValidatorsForFields = useCallback(
    async (
      fieldsToValidate: AnyField[],
    ): Promise<Record<string, string | null>> => {
      if (!fieldsToValidate.length || readOnly) {
        return {};
      }

      const results = await Promise.all(
        fieldsToValidate.map(async (field) => {
          if (!field.customValidatorId) {
            return [field.id, null] as const;
          }

          try {
            const fieldValue = effectiveFormData[field.id];
            const response = await tasksRunValidator({
              path: { id: field.customValidatorId },
              body: { fieldValue: fieldValue?.toString() ?? "" },
            });

            if (response.error || !response.data) {
              throw response.error;
            }

            const isValid = response.data.isValid;
            return [
              field.id,
              isValid ? null : (response.data.message ?? null),
            ] as const;
          } catch (err) {
            console.error("Failed to run custom validator", err);
            return [
              field.id,
              "Unable to validate this field right now. Please try again.",
            ] as const;
          }
        }),
      );

      return Object.fromEntries(results);
    },
    [readOnly, effectiveFormData],
  );

  const validatePage = useCallback(
    async (
      pageIndex: number,
      includeCustomValidators: boolean,
    ): Promise<{ isValid: boolean; firstInvalidFieldId?: string }> => {
      const page = schema.pages[pageIndex];
      if (!page) {
        return { isValid: true };
      }

      const updates: Record<string, string | null> = {};
      const fieldsOnPage = page.fields.filter(isQuestionField);
      // Fields on a hidden page are treated as invisible: errors clear and
      // nothing blocks navigation or submission.
      const pageVisible = visiblePageIndices.includes(pageIndex);
      const visibleFields = pageVisible
        ? fieldsOnPage.filter((field) => isElementCurrentlyVisible(field))
        : [];
      const visibleFieldIds = new Set(visibleFields.map((field) => field.id));

      for (const field of fieldsOnPage) {
        if (!visibleFieldIds.has(field.id)) {
          updates[field.id] = null;
          continue;
        }
        const fieldValue = effectiveFormData[field.id];
        updates[field.id] = validateFieldValue(field, fieldValue);
      }

      if (includeCustomValidators && !readOnly) {
        const candidates = visibleFields.filter(
          (field) => field.customValidatorId && !updates[field.id],
        );
        if (candidates.length > 0) {
          const customResults = await runCustomValidatorsForFields(candidates);
          Object.assign(updates, customResults);
        }
      }

      applyFieldErrorUpdates(updates);

      const firstInvalid = visibleFields.find((field) => {
        const message = updates[field.id];
        return !!(message && message.trim().length > 0);
      });

      return {
        isValid: !firstInvalid,
        firstInvalidFieldId: firstInvalid?.id,
      };
    },
    [
      schema,
      effectiveFormData,
      isElementCurrentlyVisible,
      visiblePageIndices,
      validateFieldValue,
      runCustomValidatorsForFields,
      applyFieldErrorUpdates,
      readOnly,
    ],
  );

  const validateAllPages = useCallback(async () => {
    let firstInvalidPageIndex: number | null = null;
    let firstInvalidFieldId: string | undefined;

    for (let pageIndex = 0; pageIndex < schema.pages.length; pageIndex += 1) {
      const result = await validatePage(pageIndex, true);
      if (!result.isValid && firstInvalidPageIndex === null) {
        firstInvalidPageIndex = pageIndex;
        firstInvalidFieldId = result.firstInvalidFieldId;
      }
    }

    return {
      isValid: firstInvalidPageIndex === null,
      firstInvalidPageIndex,
      firstInvalidFieldId,
    } as const;
  }, [schema.pages.length, validatePage]);

  const handleFieldChange = (fieldId: string, value: FormValue) => {
    if (readOnly) return;
    setFormData((prev) => {
      const next = { ...prev, [fieldId]: value };
      return next;
    });
    setFieldErrors((prev) => {
      if (!(fieldId in prev)) return prev;
      const next = { ...prev };
      delete next[fieldId];
      return next;
    });
    if (!hasEmittedStart) {
      setHasEmittedStart(true);
      onFormStarted?.();
    }
  };

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
    } else if (result.firstInvalidFieldId) {
      scrollToField(result.firstInvalidFieldId);
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
    if (submitting || readOnly || !onSubmit) {
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
      } else if (result.firstInvalidFieldId) {
        scrollToField(result.firstInvalidFieldId);
      }
      setSubmitting(false);
      return;
    }

    const { isValid, firstInvalidPageIndex, firstInvalidFieldId } =
      await validateAllPages();
    if (!isValid) {
      if (
        typeof firstInvalidPageIndex === "number" &&
        firstInvalidPageIndex !== currentPageIndex
      ) {
        setCurrentPageIndex(firstInvalidPageIndex);
        // Scroll after page change - use setTimeout to wait for re-render
        if (firstInvalidFieldId) {
          setTimeout(() => scrollToField(firstInvalidFieldId), 100);
        }
      } else if (firstInvalidFieldId) {
        scrollToField(firstInvalidFieldId);
      }
      setSubmitting(false);
      return;
    }

    const sanitizedAnswers = filterAnswersByFieldIds(
      effectiveFormData,
      fieldLookup,
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
      answers: formData,
      formSnapshotId,
      actionId,
      visibilityValidatorResults,
      deviceType: DEVICE_TYPE,
      publicAnswers,
    };

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
        <ActivityIndicator />
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
                  block={resolvedBlock}
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
            <View
              key={field.id}
              ref={(ref) => {
                if (ref) {
                  ref.measure((x, y, width, height, pageX, pageY) => {
                    fieldScreenPositions.current[field.id] = pageY;
                  });
                }
              }}
            >
              <RenderField
                field={field}
                value={effectiveFormData[field.id]}
                onChange={(value) => handleFieldChange(field.id, value)}
                disabled={readOnly}
                error={fieldErrors[field.id]}
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
                disabled={submitting}
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
          {Object.keys(fieldErrors).length > 0 && (
            <View className="flex-row gap-2">
              {Object.entries(fieldErrors).map(([fieldId]) => (
                <Text key={fieldId} className="text-red-500 text-base p-2">
                  Your form has errors. Please fix before submitting.
                </Text>
              ))}
            </View>
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
                      router.push("/settings");
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
