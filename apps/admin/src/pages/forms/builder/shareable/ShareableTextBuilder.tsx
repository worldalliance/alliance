import type { FormSchema } from "@alliance/common/forms/form-schema";
import { isQuestionField } from "@alliance/common/forms/form-schema";
import {
  FIRST_NAME_TOKEN,
  FULL_NAME_TOKEN,
} from "@alliance/shared/lib/shareText";
import type React from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import TextareaWithHighlights from "../../../../components/TextareaWithHighlights";
import { cn } from "../../../../ui/cn";
import { controlClass } from "../../../../ui/styles";
import { Banner, BannerTone } from "../../../../ui/templates/Banner";
import { FormSection } from "../../../../ui/templates/Form";
import { focusInPlace } from "../kit/revealInPane";
import {
  findDroppedInsertable,
  InsertableTokenButton,
  type ShareableInsertable,
} from "./InsertableTokenButton";
import { ReferralUrlNotice } from "./ReferralUrlNotice";

interface ShareableTextBuilderProps {
  schema: FormSchema;
  onSchemaChange: (schema: FormSchema) => void;
}

const SHAREABLE_TOKEN_PATTERN = /#\{[^}]*\}/g;
const DEFAULT_TEMPLATE_ALLOWED_TOKENS = new Set<string>([
  FIRST_NAME_TOKEN,
  FULL_NAME_TOKEN,
]);
const COMPLETED_SHAREABLE_INSERTION_DATA_KEY =
  "application/x-completed-shareable-text-token";
const DEFAULT_SHAREABLE_INSERTION_DATA_KEY =
  "application/x-default-shareable-text-token";

const TEXTAREA_CLASS = cn(controlClass, "py-2 leading-6");
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

const collectShareableFields = (schema: FormSchema): ShareableInsertable[] => {
  const fields: ShareableInsertable[] = [];
  schema.pages.forEach((page, pageIndex) => {
    page.fields.forEach((field) => {
      if (!isQuestionField(field) || !field.label) {
        return;
      }
      fields.push({
        id: field.id,
        label: field.label,
        token: `#{${field.id}}`,
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
    () => [...SHAREABLE_NAME_TOKENS, ...fields],
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
      focusInPlace(completedTextareaRef.current);
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
      focusInPlace(defaultTextareaRef.current);
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
          insertCompletedToken(suggestion, true);
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
    <div className="mx-auto flex w-full max-w-176 flex-col gap-section">
      <FormSection
        title="Shareable text for completed tasks"
        description={
          <>
            The text copied when a member shares a completed task. Type{" "}
            <span className="font-mono text-xs">#{"{"}</span> to pick a field,
            or click or drag a token below into the text.
          </>
        }
      >
        <div className="relative">
          <TextareaWithHighlights
            value={completedTemplate}
            onChange={(next) => {
              updateCompletedTemplate(next);
              window.requestAnimationFrame(syncCompletedCaret);
            }}
            keywords={keywords}
            placeholder="Example: I have #{field-123} things!"
            rows={8}
            textareaRef={completedTextareaRef}
            onClick={syncCompletedCaret}
            onKeyUp={syncCompletedCaret}
            onKeyDown={handleKeyDown}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault();
              const item = findDroppedInsertable({
                event,
                dataKey: COMPLETED_SHAREABLE_INSERTION_DATA_KEY,
                insertables: completedInsertables,
              });
              if (!item) {
                return;
              }
              insertCompletedToken(item, false);
            }}
            textareaClassName={TEXTAREA_CLASS}
          />
          {activeToken && suggestions.length > 0 && (
            <div className="absolute inset-x-0 top-full z-20 mt-1 overflow-hidden rounded-md bg-surface shadow-pop">
              {suggestions.map((field, index) => (
                <button
                  key={field.id}
                  type="button"
                  onMouseDown={(event) => {
                    event.preventDefault();
                    insertCompletedToken(field, true);
                  }}
                  className={cn(
                    "flex w-full items-start justify-between gap-3 px-3 py-2 text-left hover:bg-surface-2",
                    index === activeIndex && "bg-surface-2",
                  )}
                >
                  <span className="min-w-0">
                    <span className="block font-medium">{field.label}</span>
                    <span className="block truncate text-caption text-fg-muted">
                      {field.token} · {field.pageTitle}
                    </span>
                  </span>
                  <span className="text-caption text-fg-muted">
                    {field.kind}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        <TokenGroup label="Member details">
          {SHAREABLE_NAME_TOKENS.map((item) => (
            <InsertableTokenButton
              key={item.id}
              item={item}
              dataKey={COMPLETED_SHAREABLE_INSERTION_DATA_KEY}
              onInsert={() => insertCompletedToken(item, false)}
            />
          ))}
        </TokenGroup>
        <TokenGroup label="Form fields">
          {fields.length === 0 ? (
            <p className="text-fg-muted">
              This form has no labelled questions yet.
            </p>
          ) : (
            fields.map((field) => (
              <InsertableTokenButton
                key={field.id}
                item={field}
                dataKey={COMPLETED_SHAREABLE_INSERTION_DATA_KEY}
                onInsert={() => insertCompletedToken(field, false)}
              />
            ))
          )}
        </TokenGroup>
        <ReferralUrlNotice />
      </FormSection>

      <FormSection
        title="Default shareable text"
        description="Copied when a member shares the task before completing it, so it can only use the member's name."
      >
        <TextareaWithHighlights
          value={defaultTemplate}
          onChange={updateDefaultTemplate}
          keywords={defaultKeywords}
          placeholder="Example: Join me in taking this action."
          rows={5}
          textareaRef={defaultTextareaRef}
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            event.preventDefault();
            const item = findDroppedInsertable({
              event,
              dataKey: DEFAULT_SHAREABLE_INSERTION_DATA_KEY,
              insertables: defaultInsertables,
            });
            if (!item) {
              return;
            }
            insertDefaultToken(item);
          }}
          textareaClassName={TEXTAREA_CLASS}
        />
        <TokenGroup label="Member details">
          {defaultInsertables.map((item) => (
            <InsertableTokenButton
              key={`default-${item.id}`}
              item={item}
              dataKey={DEFAULT_SHAREABLE_INSERTION_DATA_KEY}
              onInsert={() => insertDefaultToken(item)}
            />
          ))}
        </TokenGroup>
        <Banner inline tone={BannerTone.Warning}>
          <p className="font-medium">Form-field tokens are removed here</p>
          <p className="text-fg-muted">
            A token like <span className="font-mono text-xs">#{"{field}"}</span>{" "}
            is dropped from this text as you type, since nothing has been
            answered yet. The member tokens{" "}
            <span className="font-mono text-xs">{FIRST_NAME_TOKEN}</span> and{" "}
            <span className="font-mono text-xs">{FULL_NAME_TOKEN}</span> stay.
          </p>
        </Banner>
        <ReferralUrlNotice />
      </FormSection>
    </div>
  );
}

function TokenGroup({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-caption font-medium text-fg-muted">{label}</p>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}
