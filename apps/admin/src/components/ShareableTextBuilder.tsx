import type { AnyField, FormSchema } from "@alliance/common/forms/form-schema";
import TextareaWithHighlights from "./TextareaWithHighlights";
import type React from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@alliance/shared/styles/util";
import {
  FIRST_NAME_TOKEN,
  FULL_NAME_TOKEN,
} from "@alliance/shared/lib/shareText";

interface ShareableTextBuilderProps {
  schema: FormSchema;
  onSchemaChange: (schema: FormSchema) => void;
}

const REFERRAL_URL_PREVIEW =
  "https://alliance.example/actions/123?ref=member-code";
const SHAREABLE_TOKEN_PATTERN = /#\{[^}]*\}/g;
const DEFAULT_TEMPLATE_ALLOWED_TOKENS = new Set<string>([
  FIRST_NAME_TOKEN,
  FULL_NAME_TOKEN,
]);
const COMPLETED_SHAREABLE_INSERTION_DATA_KEY =
  "application/x-completed-shareable-text-token";
const DEFAULT_SHAREABLE_INSERTION_DATA_KEY =
  "application/x-default-shareable-text-token";

const SHAREABLE_NAME_TOKENS = [
  {
    id: "member-first-name",
    label: FIRST_NAME_TOKEN,
    token: FIRST_NAME_TOKEN,
    kind: "member",
    pageTitle: "Member details",
  },
  {
    id: "member-full-name",
    label: FULL_NAME_TOKEN,
    token: FULL_NAME_TOKEN,
    kind: "member",
    pageTitle: "Member details",
  },
] as const;

type ShareableField = {
  id: string;
  label: string;
  kind: AnyField["kind"];
  pageTitle: string;
};

type ShareableInsertable = {
  id: string;
  label: string;
  token: string;
  kind: string;
  pageTitle: string;
};

const collectShareableFields = (schema: FormSchema): ShareableField[] => {
  const fields: ShareableField[] = [];
  schema.pages.forEach((page, pageIndex) => {
    page.fields.forEach((field) => {
      if (!("label" in field) || !field.label) {
        return;
      }
      fields.push({
        id: field.id,
        label: field.label,
        kind: field.kind,
        pageTitle: page.title?.trim() || `Page ${pageIndex + 1}`,
      });
    });
  });
  return fields;
};

const getActiveTokenQuery = (value: string, caretIndex: number) => {
  const beforeCaret = value.slice(0, caretIndex);
  const match = beforeCaret.match(/#\{([^}]*)$/);
  if (!match || match.index === undefined) {
    return null;
  }
  return {
    query: match[1],
    startIndex: match.index,
    endIndex: caretIndex,
  };
};

export function ShareableTextBuilder({
  schema,
  onSchemaChange,
}: ShareableTextBuilderProps) {
  const completedTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const defaultTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [completedCaretIndex, setCompletedCaretIndex] = useState(0);
  const [activeIndex, setActiveIndex] = useState(0);
  const fields = useMemo(() => collectShareableFields(schema), [schema]);
  const completedInsertables = useMemo<ShareableInsertable[]>(
    () => [
      ...SHAREABLE_NAME_TOKENS,
      ...fields.map((field) => ({
        ...field,
        token: `#{${field.id}}`,
      })),
    ],
    [fields],
  );
  const keywords = useMemo(
    () => completedInsertables.map((item) => item.token),
    [completedInsertables],
  );
  const defaultInsertables = SHAREABLE_NAME_TOKENS;
  const defaultKeywords = useMemo(
    () => defaultInsertables.map((item) => item.token),
    [defaultInsertables],
  );

  const completedTemplate = schema.shareableTextTemplate ?? "";
  const defaultTemplate = schema.defaultShareableTextTemplate ?? "";
  const activeToken = useMemo(
    () => getActiveTokenQuery(completedTemplate, completedCaretIndex),
    [completedTemplate, completedCaretIndex],
  );

  const suggestions = useMemo(() => {
    if (!activeToken) {
      return [];
    }
    const query = activeToken.query.trim().toLowerCase();
    if (!query) {
      return fields.slice(0, 8);
    }
    return fields
      .filter((field) => {
        const label = field.label?.toLowerCase() ?? "";
        return field.id.toLowerCase().includes(query) || label.includes(query);
      })
      .slice(0, 8);
  }, [activeToken, fields]);

  useEffect(() => {
    setActiveIndex(0);
  }, [activeToken?.query]);

  const updateCompletedTemplate = (nextTemplate: string) => {
    onSchemaChange({
      ...schema,
      shareableTextTemplate: nextTemplate,
    });
  };

  const updateDefaultTemplate = (nextTemplate: string) => {
    onSchemaChange({
      ...schema,
      defaultShareableTextTemplate: nextTemplate.replace(
        SHAREABLE_TOKEN_PATTERN,
        (match) => (DEFAULT_TEMPLATE_ALLOWED_TOKENS.has(match) ? match : ""),
      ),
    });
  };

  const syncCompletedCaret = () => {
    const textarea = completedTextareaRef.current;
    if (!textarea) return;
    setCompletedCaretIndex(textarea.selectionStart ?? 0);
  };

  const insertCompletedToken = (
    item: ShareableInsertable,
    replaceActiveToken = false,
  ) => {
    const textarea = completedTextareaRef.current;
    const currentValue = completedTemplate;
    const selectionStart = textarea?.selectionStart ?? currentValue.length;
    const selectionEnd = textarea?.selectionEnd ?? selectionStart;
    const token = item.token;
    const replacementRange =
      replaceActiveToken && activeToken
        ? {
            start: activeToken.startIndex,
            end: activeToken.endIndex,
          }
        : {
            start: selectionStart,
            end: selectionEnd,
          };

    const nextValue =
      currentValue.slice(0, replacementRange.start) +
      token +
      currentValue.slice(replacementRange.end);

    updateCompletedTemplate(nextValue);

    window.requestAnimationFrame(() => {
      const nextCaret = replacementRange.start + token.length;
      completedTextareaRef.current?.focus();
      completedTextareaRef.current?.setSelectionRange(nextCaret, nextCaret);
      setCompletedCaretIndex(nextCaret);
    });
  };

  const insertDefaultToken = (item: (typeof SHAREABLE_NAME_TOKENS)[number]) => {
    const textarea = defaultTextareaRef.current;
    const currentValue = defaultTemplate;
    const selectionStart = textarea?.selectionStart ?? currentValue.length;
    const selectionEnd = textarea?.selectionEnd ?? selectionStart;
    const token = item.token;

    const nextValue =
      currentValue.slice(0, selectionStart) +
      token +
      currentValue.slice(selectionEnd);

    updateDefaultTemplate(nextValue);

    window.requestAnimationFrame(() => {
      const nextCaret = selectionStart + token.length;
      defaultTextareaRef.current?.focus();
      defaultTextareaRef.current?.setSelectionRange(nextCaret, nextCaret);
    });
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (activeToken && suggestions.length > 0) {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setActiveIndex((prev) => (prev + 1) % suggestions.length);
        return;
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        setActiveIndex(
          (prev) => (prev - 1 + suggestions.length) % suggestions.length,
        );
        return;
      }
      if (event.key === "Enter" || event.key === "Tab") {
        event.preventDefault();
        const suggestion = suggestions[activeIndex] ?? suggestions[0];
        if (suggestion) {
          insertCompletedToken(
            {
              ...suggestion,
              token: `#{${suggestion.id}}`,
            },
            true,
          );
        }
        return;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        setCompletedCaretIndex(-1);
      }
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-gray-900">
            Shareable Text for Completed Tasks
          </h2>
          <p className="mt-1 text-sm text-gray-600">
            Build the text copied when a member shares a completed action. Type
            <span className="mx-1 rounded bg-gray-100 px-1.5 py-0.5 font-mono text-xs">
              #{"{field}"}
            </span>
            to insert a field token, or drag a field into the text box.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="relative">
            <TextareaWithHighlights
              value={completedTemplate}
              onChange={(next) => {
                updateCompletedTemplate(next);
                window.requestAnimationFrame(syncCompletedCaret);
              }}
              keywords={keywords}
              placeholder="Example: I have #{field-123} things!"
              rows={10}
              textareaRef={completedTextareaRef}
              onClick={syncCompletedCaret}
              onKeyUp={syncCompletedCaret}
              onKeyDown={handleKeyDown}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                const droppedToken = event.dataTransfer.getData(
                  COMPLETED_SHAREABLE_INSERTION_DATA_KEY,
                );
                if (!droppedToken) {
                  return;
                }
                const item = completedInsertables.find(
                  (candidate) => candidate.token === droppedToken,
                );
                if (!item) {
                  return;
                }
                insertCompletedToken(item, false);
              }}
            />

            <div className="mt-3 rounded-lg border border-dashed border-blue-200 bg-blue-50/60 p-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-blue-950">
                    Member Referral URL
                  </p>
                  <p className="mt-1 text-xs text-blue-800">
                    This is always appended automatically when the action is
                    shared. It is not editable here and cannot be removed from
                    the real share text.
                  </p>
                </div>
                <span className="rounded-full bg-white px-2 py-1 text-xs font-medium text-blue-900">
                  Always Included
                </span>
              </div>
              <div className="mt-3 rounded-md border border-blue-200 bg-white px-3 py-2 font-mono text-xs text-blue-900">
                {REFERRAL_URL_PREVIEW}
              </div>
            </div>

            {activeToken && suggestions.length > 0 && (
              <div className="absolute left-0 right-0 top-full z-20 mt-2 rounded-lg border border-gray-200 bg-white shadow-xl">
                {suggestions.map((field, index) => (
                  <button
                    key={field.id}
                    type="button"
                    onMouseDown={(event) => {
                      event.preventDefault();
                      insertCompletedToken(
                        {
                          ...field,
                          token: `#{${field.id}}`,
                        },
                        true,
                      );
                    }}
                    className={cn(
                      "flex w-full items-start justify-between gap-3 px-4 py-3 text-left hover:bg-blue-50",
                      index === activeIndex && "bg-blue-50",
                    )}
                  >
                    <div>
                      <div className="font-medium text-gray-900">
                        {field.label}
                      </div>
                      <div className="mt-1 text-xs text-gray-500">
                        #{`{${field.id}}`} · {field.pageTitle}
                      </div>
                    </div>
                    <span className="rounded-full bg-gray-100 px-2 py-1 text-xs text-gray-600">
                      {field.kind}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
            <div className="mb-3">
              <h3 className="text-sm font-semibold text-gray-900">
                Form Fields
              </h3>
              <p className="mt-1 text-xs text-gray-500">
                Drag or click a field to insert its token.
              </p>
            </div>

            <div className="max-h-[32rem] space-y-3 overflow-y-auto pr-1">
              <div className="space-y-2">
                <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                  Member Details
                </p>
                {SHAREABLE_NAME_TOKENS.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    draggable
                    onDragStart={(event) => {
                      event.dataTransfer.effectAllowed = "copy";
                      event.dataTransfer.setData(
                        COMPLETED_SHAREABLE_INSERTION_DATA_KEY,
                        item.token,
                      );
                      event.dataTransfer.setData("text/plain", item.token);
                    }}
                    onClick={() => insertCompletedToken(item, false)}
                    className="w-full rounded-md border border-gray-200 bg-white px-3 py-3 text-left transition-colors hover:border-blue-300 hover:bg-blue-50"
                  >
                    <div className="font-medium text-gray-900">
                      {item.label}
                    </div>
                    <div className="mt-1 text-xs text-gray-500">
                      {item.token} · {item.pageTitle}
                    </div>
                  </button>
                ))}
              </div>

              <div className="space-y-2">
                <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                  Form Fields
                </p>
                {fields.length === 0 ? (
                  <p className="rounded-md border border-dashed border-gray-300 bg-white px-3 py-4 text-sm text-gray-500">
                    Add form fields in Form Builder first.
                  </p>
                ) : (
                  fields.map((field) => (
                    <button
                      key={field.id}
                      type="button"
                      draggable
                      onDragStart={(event) => {
                        const token = `#{${field.id}}`;
                        event.dataTransfer.effectAllowed = "copy";
                        event.dataTransfer.setData(
                          COMPLETED_SHAREABLE_INSERTION_DATA_KEY,
                          token,
                        );
                        event.dataTransfer.setData("text/plain", token);
                      }}
                      onClick={() =>
                        insertCompletedToken(
                          {
                            ...field,
                            token: `#{${field.id}}`,
                          },
                          false,
                        )
                      }
                      className="w-full rounded-md border border-gray-200 bg-white px-3 py-3 text-left transition-colors hover:border-blue-300 hover:bg-blue-50"
                    >
                      <div className="font-medium text-gray-900">
                        {field.label}
                      </div>
                      <div className="mt-1 text-xs text-gray-500">
                        #{`{${field.id}}`} · {field.pageTitle}
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-gray-900">
            Default Shareable Text
          </h2>
          <p className="mt-1 text-sm text-gray-600">
            This text is copied when a user shares the action before completing
            it. Only member-detail tokens are supported in this box.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div>
            <TextareaWithHighlights
              value={defaultTemplate}
              onChange={updateDefaultTemplate}
              keywords={defaultKeywords}
              placeholder="Example: Join me in taking this action."
              rows={6}
              textareaRef={defaultTextareaRef}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                const droppedToken = event.dataTransfer.getData(
                  DEFAULT_SHAREABLE_INSERTION_DATA_KEY,
                );
                if (!droppedToken) {
                  return;
                }
                const item = defaultInsertables.find(
                  (candidate) => candidate.token === droppedToken,
                );
                if (!item) {
                  return;
                }
                insertDefaultToken(item);
              }}
              textareaClassName="rounded-lg border border-gray-300 px-4 py-3 text-sm text-gray-900 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />

            <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50/70 p-3">
              <p className="text-sm font-medium text-amber-950">
                No form-field inputs in this text box
              </p>
              <p className="mt-1 text-xs text-amber-900">
                Entries like <span className="font-mono">#{"{field}"}</span> are
                removed here because this default message is used before the
                user has completed the task. Member-detail tokens like{" "}
                <span className="font-mono">{FIRST_NAME_TOKEN}</span> and{" "}
                <span className="font-mono">{FULL_NAME_TOKEN}</span> are
                supported.
              </p>
            </div>

            <div className="mt-3 rounded-lg border border-dashed border-blue-200 bg-blue-50/60 p-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-blue-950">
                    Member Referral URL
                  </p>
                  <p className="mt-1 text-xs text-blue-800">
                    This is always appended automatically when the action is
                    shared. It is not editable here and cannot be removed from
                    the real share text.
                  </p>
                </div>
                <span className="rounded-full bg-white px-2 py-1 text-xs font-medium text-blue-900">
                  Always Included
                </span>
              </div>
              <div className="mt-3 rounded-md border border-blue-200 bg-white px-3 py-2 font-mono text-xs text-blue-900">
                {REFERRAL_URL_PREVIEW}
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
            <div className="mb-3">
              <h3 className="text-sm font-semibold text-gray-900">
                Member Details
              </h3>
              <p className="mt-1 text-xs text-gray-500">
                Drag or click a member detail to insert it into Default
                Shareable Text.
              </p>
            </div>

            <div className="space-y-2">
              {defaultInsertables.map((item) => (
                <button
                  key={`default-${item.id}`}
                  type="button"
                  draggable
                  onDragStart={(event) => {
                    event.dataTransfer.effectAllowed = "copy";
                    event.dataTransfer.setData(
                      DEFAULT_SHAREABLE_INSERTION_DATA_KEY,
                      item.token,
                    );
                    event.dataTransfer.setData("text/plain", item.token);
                  }}
                  onClick={() => insertDefaultToken(item)}
                  className="w-full rounded-md border border-gray-200 bg-white px-3 py-3 text-left transition-colors hover:border-blue-300 hover:bg-blue-50"
                >
                  <div className="font-medium text-gray-900">{item.label}</div>
                  <div className="mt-1 text-xs text-gray-500">
                    {item.token} · {item.pageTitle}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
