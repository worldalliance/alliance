import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Linking,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import AppMarkdownWrapper from "../AppMarkdownWrapper";
import type { UserDto } from "@alliance/shared/client";
import {
  FormResponseDto,
  SubmitFormDto,
  tasksRunValidator,
} from "@alliance/shared/client";
import type { DisplayBlock } from "@alliance/shared/forms/display-blocks";
import type {
  AnyField,
  DeviceVisibilityTarget,
  FormSchema,
  FormValue,
} from "@alliance/shared/forms/formschema";
import {
  applyDefaultValues,
  filterAnswersByFieldIds,
  isElementCurrentlyVisible as isElementCurrentlyVisibleShared,
  resolveFieldDefaultValue,
  validateFieldValue as validateFieldValueShared,
} from "@alliance/shared/formrenderer";
import { RenderField } from "./RenderField";
import FormModal from "./FormModal";
import Button, { ButtonColor, ButtonSize } from "../system/Button";
import { CircleCheck } from "lucide-react-native";

type FormRendererProps = {
  form: FormSchema;
  id: number;
  publicAction?: boolean;
  actionId: number;
  persistKey?: string | null;
  initialPageIndex?: number;
  userId?: string | number;
  phDistinctId?: string;
  sessionReplayUrl?: string;
  user?: Omit<UserDto, "email">;
  disableOptionRandomization?: boolean;
  onFormStarted?: () => void;
  onAbandonAction?: (
    outOfTime: boolean,
    reason: string,
    partialFormData: SubmitFormDto
  ) => void;
  renderFormAsCompleted?: boolean;
  completedFormResponse?: FormResponseDto;
  onSubmit: ((data: SubmitFormDto) => Promise<void>) | null;
  scrollPageTo?: (y: number) => void;
};

const DEVICE_TYPE: DeviceVisibilityTarget = "mobile";

function RenderDisplayBlockMobile({ block }: { block: DisplayBlock }) {
  switch (block.kind) {
    case "header":
      return (
        <Text
          className={`font-semibold text-zinc-900 my-2 ${block.level === 1
              ? "text-3xl"
              : block.level === 2
                ? "text-2xl"
                : block.level === 3
                  ? "text-xl"
                  : block.level === 4
                    ? "text-lg"
                    : "text-base"
            }`}
        >
          {block.text}
        </Text>
      );
    case "text":
      return <AppMarkdownWrapper>{block.text}</AppMarkdownWrapper>;
    case "label":
      return (
        <Text className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
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
        <View className="bg-zinc-100 p-4 rounded-lg">
          <Text className="text-base text-zinc-800 leading-6">
            {block.text}
          </Text>
        </View>
      );
    case "image":
      return (
        <View className="items-center">
          <Image
            source={{ uri: block.src }}
            accessibilityLabel={block.alt}
            className="w-full h-48 bg-zinc-200 rounded-lg"
            resizeMode="cover"
          />
          {block.caption && (
            <Text className="text-sm text-zinc-600 mt-2 text-center">
              {block.caption}
            </Text>
          )}
        </View>
      );
    case "biglink":
      return (
        <TouchableOpacity
          className="rounded-lg border border-zinc-200 bg-white px-5 py-4"
          onPress={() => Linking.openURL(block.url)}
        >
          <Text className="text-base font-medium text-blue-600">
            {block.text}
          </Text>
          <Text className="mt-1 text-sm text-zinc-500" numberOfLines={1}>
            {block.url}
          </Text>
        </TouchableOpacity>
      );
    default:
      return null;
  }
}

const FormRenderer = ({
  form,
  id,
  publicAction,
  onSubmit,
  persistKey,
  userId,
  user,
  disableOptionRandomization,
  onFormStarted,
  onAbandonAction,
  renderFormAsCompleted,
  completedFormResponse,
  actionId,
  initialPageIndex,
  phDistinctId,
  sessionReplayUrl,
  scrollPageTo,
}: FormRendererProps) => {
  const schema = form as unknown as FormSchema;
  const readOnly = !!renderFormAsCompleted || !onSubmit;

  const randomizationKey = useMemo(() => {
    const base = `form:${id}`;
    const normalizedUserId =
      user?.id !== undefined && user?.id !== null ? user.id : userId;
    if (
      normalizedUserId !== undefined &&
      normalizedUserId !== null &&
      normalizedUserId !== ""
    ) {
      return `${base}:user:${String(normalizedUserId)}`;
    }
    if (persistKey !== undefined && persistKey !== null && persistKey !== "") {
      return `${base}:persist:${String(persistKey)}`;
    }
    return base;
  }, [id, user?.id, userId, persistKey]);

  const { fieldLookup, defaultValueMap } = useMemo(() => {
    const lookup = new Map<string, AnyField>();
    const defaults = new Map<string, FormValue>();

    for (const page of schema.pages) {
      for (const element of page.fields) {
        if ("label" in element) {
          const field = element as AnyField;
          lookup.set(field.id, field);
          const defaultValue = resolveFieldDefaultValue(field);
          if (defaultValue !== undefined) {
            defaults.set(field.id, defaultValue);
          }
        }
      }
    }

    return { fieldLookup: lookup, defaultValueMap: defaults };
  }, [schema]);

  const pageCount = schema.pages?.length ?? 0;
  const maxPageIndex = Math.max(0, (pageCount || 1) - 1);

  const clampPageIndex = (idx: number): number => {
    if (!Number.isFinite(idx)) return 0;
    const normalized = Math.floor(idx);
    if (normalized < 0) return 0;
    if (normalized > maxPageIndex) return maxPageIndex;
    return normalized;
  };

  const [currentPageIndex, setCurrentPageIndex] = useState<number>(() =>
    clampPageIndex(initialPageIndex ?? 0)
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
    {}
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
  const [outOfTimeSelected, setOutOfTimeSelected] = useState(false);
  const [otherReasonSelected, setOtherReasonSelected] = useState(false);
  const [customReason, setCustomReason] = useState("");
  const [hasEmittedStart, setHasEmittedStart] = useState(false);

  const fieldPositions = useRef<Record<string, number>>({});
  const fieldScreenPositions = useRef<Record<string, number>>({});

  const scrollToField = useCallback(
    (fieldId: string) => {
      const yPosition = fieldPositions.current[fieldId];
      scrollPageTo?.(Math.max(0, yPosition + 100));
    },
    [scrollPageTo]
  );

  useEffect(() => {
    if (!user || Object.keys(publicAnswers).length > 0) {
      return;
    }
    if (user.formDataPreference === "public") {
      const defaults: Record<string, boolean> = {};
      fieldLookup.forEach((_, fieldId) => {
        defaults[fieldId] = true;
      });
      setPublicAnswers(defaults);
    }
  }, [user, publicAnswers, fieldLookup]);

  const visibilityValidatorIds = useMemo(() => {
    const ids = new Set<number>();
    for (const page of schema.pages) {
      for (const element of page.fields) {
        const conditions = Array.isArray(element.visibleIf)
          ? element.visibleIf
          : element.visibleIf
            ? [element.visibleIf]
            : [];
        for (const condition of conditions) {
          if ("validatorId" in condition) {
            ids.add(condition.validatorId);
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
      (id) => !(id in visibilityValidatorResults)
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
              error
            );
            return [validatorId, false] as const;
          }
        })
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

  const isElementCurrentlyVisible = useCallback(
    (
      element: AnyField | DisplayBlock,
      data?: Record<string, FormValue>
    ): boolean =>
      isElementCurrentlyVisibleShared(element, data ?? formData, {
        deviceType: DEVICE_TYPE,
        visibilityValidatorResults,
        readOnly,
      }),
    [formData, visibilityValidatorResults, readOnly]
  );

  const validateFieldValue = useCallback(
    (
      field: AnyField,
      fieldValue: FormValue | undefined,
      data?: Record<string, FormValue>
    ): string | null =>
      validateFieldValueShared(field, fieldValue, data ?? formData, {
        deviceType: DEVICE_TYPE,
        visibilityValidatorResults,
      }),
    [formData, visibilityValidatorResults]
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
    []
  );

  const runCustomValidatorsForFields = useCallback(
    async (
      fieldsToValidate: AnyField[]
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
            const fieldValue = formData[field.id];
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
              isValid ? null : response.data.message ?? null,
            ] as const;
          } catch (err) {
            console.error("Failed to run custom validator", err);
            return [
              field.id,
              "Unable to validate this field right now. Please try again.",
            ] as const;
          }
        })
      );

      return Object.fromEntries(results);
    },
    [readOnly, formData]
  );

  const validatePage = useCallback(
    async (
      pageIndex: number,
      includeCustomValidators: boolean
    ): Promise<{ isValid: boolean; firstInvalidFieldId?: string }> => {
      const page = schema.pages[pageIndex];
      if (!page) {
        return { isValid: true };
      }

      const updates: Record<string, string | null> = {};
      const fieldsOnPage = page.fields.filter(
        (element): element is AnyField => "label" in element
      );
      const visibleFields = fieldsOnPage.filter((field) =>
        isElementCurrentlyVisible(field)
      );
      const visibleFieldIds = new Set(visibleFields.map((field) => field.id));

      for (const field of fieldsOnPage) {
        if (!visibleFieldIds.has(field.id)) {
          updates[field.id] = null;
          continue;
        }
        const fieldValue = formData[field.id];
        updates[field.id] = validateFieldValue(field, fieldValue);
      }

      if (includeCustomValidators && !readOnly) {
        const candidates = visibleFields.filter(
          (field) => field.customValidatorId && !updates[field.id]
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
      formData,
      isElementCurrentlyVisible,
      validateFieldValue,
      runCustomValidatorsForFields,
      applyFieldErrorUpdates,
      readOnly,
    ]
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

  const handleNextPage = async () => {
    const result = await validatePage(currentPageIndex, true);
    if (result.isValid) {
      setCurrentPageIndex((prev) => Math.min(prev + 1, maxPageIndex));
    } else if (result.firstInvalidFieldId) {
      scrollToField(result.firstInvalidFieldId);
    }
  };

  const handlePreviousPage = () => {
    setCurrentPageIndex((prev) => Math.max(prev - 1, 0));
  };

  const handleSubmit = async () => {
    if (submitting || readOnly || !onSubmit) {
      return;
    }
    setSubmitting(true);

    if (pageCount > 1 && currentPageIndex < maxPageIndex) {
      const result = await validatePage(currentPageIndex, true);
      if (result.isValid) {
        setCurrentPageIndex((prev) => prev + 1);
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

    const sanitizedAnswers = filterAnswersByFieldIds(formData, fieldLookup);
    const submissionPayload: SubmitFormDto = {
      answers: sanitizedAnswers,
      schemaSnapshot: form as unknown as Record<string, unknown>,
      actionId,
      visibilityValidatorResults,
      deviceType: DEVICE_TYPE,
      publicAnswers,
      phDistinctId,
      sessionReplayUrl,
    };

    onSubmit(submissionPayload).finally(() => {
      setSubmitting(false);
    });
  };

  const handleAbandon = () => {
    const submissionPayload: SubmitFormDto = {
      answers: formData,
      schemaSnapshot: form as unknown as Record<string, unknown>,
      actionId,
      visibilityValidatorResults,
      deviceType: DEVICE_TYPE,
      publicAnswers,
    };

    onAbandonAction?.(outOfTimeSelected, customReason, submissionPayload);
    setWithdrawOpen(false);
  };

  const currentPage = schema.pages[currentPageIndex];
  const isFirstPage = currentPageIndex === 0;
  const isLastPage = currentPageIndex === maxPageIndex;

  const handleFocusField = (fieldId: string) => {
    const screenPosition = fieldScreenPositions.current[fieldId];
    const yPosition = fieldPositions.current[fieldId];
    if (yPosition !== undefined && screenPosition > 400) {
      scrollToField(fieldId);
    }
  };

  return (
    <View className="flex-1 flex flex-col gap-y-2">
      {currentPage?.fields.map((element, idx) => {
        if (!("label" in element)) {
          return (
            <View key={`block-${idx}`}>
              <RenderDisplayBlockMobile block={element as DisplayBlock} />
            </View>
          );
        }
        const field = element as AnyField;
        if (!isElementCurrentlyVisible(field)) {
          return null;
        }
        return (
          <View
            key={field.id}
            onLayout={(event) => {
              fieldPositions.current[field.id] = event.nativeEvent.layout.y;
            }}
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
              value={formData[field.id]}
              onChange={(value) => handleFieldChange(field.id, value)}
              onFocus={() => {
                handleFocusField(field.id);
              }}
              disabled={readOnly}
              error={fieldErrors[field.id]}
              randomizationKey={randomizationKey}
              disableOptionRandomization={disableOptionRandomization}
            />
          </View>
        );
      })}
      {!readOnly && (
        <View>
          <View className="">
            <View className="flex-row justify-between items-center mb-3">
              {pageCount > 1 ? (
                <Text className="text-sm text-zinc-500">
                  Page {currentPageIndex + 1} of {pageCount}
                </Text>
              ) : null}
            </View>
            <View className="flex-row gap-3">
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
                className="flex-2 py-4! gap-x-2"
                disabled={submitting}
              >
                {submitting ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    {isLastPage ? (
                      <CircleCheck size={16} color="#fff" strokeWidth={2.5} />
                    ) : null}
                    <Text className="text-white font-medium text-base">
                      {isLastPage ? "Complete" : "Next"}
                    </Text>
                  </>
                )}
              </Button>
              <Button
                onPress={() => setWithdrawOpen(true)}
                className="px-5! items-center"
                color={ButtonColor.Outline}
                size={ButtonSize.Medium}
                title="..."
              />
            </View>
          </View>
          {Object.keys(fieldErrors).length > 0 && (
            <View className="flex-row gap-2">
              {Object.entries(fieldErrors).map(([fieldId, error]) => (
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
          maxHeight={420}
        >
          <Text className="text-lg font-semibold text-zinc-900 mb-3">
            Withdraw from action
          </Text>
          <View className="gap-2 mb-3">
            <TouchableOpacity
              activeOpacity={0.8}
              className={`border rounded-lg px-3 py-3 ${outOfTimeSelected
                  ? "border-green-600 bg-green/20"
                  : "border-zinc-200"
                }`}
              onPress={() => {
                setOutOfTimeSelected((prev) => !prev);
                if (!outOfTimeSelected) {
                  setOtherReasonSelected(false);
                }
              }}
            >
              <Text className="text-base text-zinc-900">
                Took more than 15 minutes
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              activeOpacity={0.8}
              className={`border rounded-lg px-3 py-3 ${otherReasonSelected
                  ? "border-green-600 bg-green/20"
                  : "border-zinc-200"
                }`}
              onPress={() => {
                setOtherReasonSelected((prev) => !prev);
                if (!otherReasonSelected) {
                  setOutOfTimeSelected(false);
                }
              }}
            >
              <Text className="text-base text-zinc-900">Other reason</Text>
            </TouchableOpacity>
          </View>
          {(outOfTimeSelected || otherReasonSelected) && (
            <TextInput
              value={customReason}
              onChangeText={setCustomReason}
              placeholder="Explain in more detail..."
              placeholderTextColor="#9ca3af"
              multiline
              textAlignVertical="top"
              className="border border-zinc-200 rounded-lg px-3 py-2 h-24 text-base text-zinc-900 mb-3"
            />
          )}
          <Button
            onPress={handleAbandon}
            color={ButtonColor.Black}
            size={ButtonSize.Medium}
            disabled={submitting}
            title="Withdraw"
          />
        </FormModal>
      )}
    </View>
  );
};

export default FormRenderer;
