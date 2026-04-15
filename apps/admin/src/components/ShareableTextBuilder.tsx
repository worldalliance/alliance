import type { AnyField, FormSchema } from "@alliance/common/forms/form-schema";
import FormTextarea from "./FormTextarea";
import TextareaWithHighlights from "./TextareaWithHighlights";
import type React from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@alliance/shared/styles/util";

interface ShareableTextBuilderProps {
  schema: FormSchema;
  onSchemaChange: (schema: FormSchema) => void;
}

const REFERRAL_URL_PREVIEW =
  "https://alliance.example/actions/123?ref=member-code";
const SHAREABLE_TOKEN_PATTERN = /#\{[^}]*\}/g;

type ShareableField = Pick<AnyField, "id" | "label" | "kind"> & {
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
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [caretIndex, setCaretIndex] = useState(0);
  const [activeIndex, setActiveIndex] = useState(0);
  const fields = useMemo(() => collectShareableFields(schema), [schema]);
  const keywords = useMemo(
    () => fields.map((field) => `#{${field.id}}`),
    [fields],
  );

  const completedTemplate = schema.shareableTextTemplate ?? "";
  const defaultTemplate = schema.defaultShareableTextTemplate ?? "";
  const activeToken = useMemo(
    () => getActiveTokenQuery(completedTemplate, caretIndex),
    [completedTemplate, caretIndex],
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
        return (
          field.id.toLowerCase().includes(query) || label.includes(query)
        );
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
        "",
      ),
    });
  };

  const syncCaret = () => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    setCaretIndex(textarea.selectionStart ?? 0);
  };

  const insertToken = (field: ShareableField, replaceActiveToken = false) => {
    const textarea = textareaRef.current;
    const currentValue = completedTemplate;
    const selectionStart = textarea?.selectionStart ?? currentValue.length;
    const selectionEnd = textarea?.selectionEnd ?? selectionStart;
    const token = `#{${field.id}}`;
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
      textareaRef.current?.focus();
      textareaRef.current?.setSelectionRange(nextCaret, nextCaret);
      setCaretIndex(nextCaret);
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
        insertToken(suggestions[activeIndex] ?? suggestions[0], true);
        return;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        setCaretIndex(-1);
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
                window.requestAnimationFrame(syncCaret);
              }}
              keywords={keywords}
              placeholder='Example: I have #{field-123} things!'
              rows={10}
              textareaRef={textareaRef}
              onClick={syncCaret}
              onKeyUp={syncCaret}
              onKeyDown={handleKeyDown}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                const fieldId = event.dataTransfer.getData(
                  "application/x-shareable-text-field-id",
                );
                if (!fieldId) {
                  return;
                }
                const field = fields.find((candidate) => candidate.id === fieldId);
                if (!field) {
                  return;
                }
                insertToken(field, false);
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
                      insertToken(field, true);
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

            <div className="space-y-2">
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
                      event.dataTransfer.effectAllowed = "copy";
                      event.dataTransfer.setData(
                        "application/x-shareable-text-field-id",
                        field.id,
                      );
                      event.dataTransfer.setData("text/plain", `#{${field.id}}`);
                    }}
                    onClick={() => insertToken(field, false)}
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

      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-gray-900">
            Default Shareable Text
          </h2>
          <p className="mt-1 text-sm text-gray-600">
            This text is copied when a user shares the action before completing
            it. User-input tokens and dragged form fields are not supported in
            this box.
          </p>
        </div>

        <FormTextarea
          value={defaultTemplate}
          onChange={(event) => updateDefaultTemplate(event.target.value)}
          placeholder="Example: Join me in taking this action."
          minRows={6}
          className="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm text-gray-900 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
        />

        <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50/70 p-3">
          <p className="text-sm font-medium text-amber-950">
            No user inputs in this text box
          </p>
          <p className="mt-1 text-xs text-amber-900">
            Entries like <span className="font-mono">#{"{field}"}</span> are
            removed here because this default message is used before the user
            has completed the task.
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
                shared. It is not editable here and cannot be removed from the
                real share text.
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
    </div>
  );
}
