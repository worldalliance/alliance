import type { FormResponseDto } from "../client/types.gen";
import type { FormSchema } from "@alliance/common/forms/form-schema";

const resolveAnswerValue = (value: unknown): string | null => {
  if (value === undefined || value === null) {
    return null;
  }
  if (Array.isArray(value)) {
    return value
      .map((entry) => resolveAnswerValue(entry))
      .filter((entry): entry is string => Boolean(entry))
      .join(", ");
  }
  if (typeof value === "object") {
    const objectValue = value as { name?: string; key?: string };
    if (objectValue.name || objectValue.key) {
      return objectValue.name || objectValue.key || null;
    }
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
  return String(value);
};

const findSchemaField = (schema: FormSchema, token: string) => {
  const normalizedToken = token.trim().toLowerCase();
  return schema.pages
    .flatMap((page) => page.fields)
    .find(
      (field) =>
        "id" in field &&
        ((typeof field.id === "string" &&
          field.id.trim().toLowerCase() === normalizedToken) ||
          ("label" in field &&
            typeof field.label === "string" &&
            field.label.trim().toLowerCase() === normalizedToken)),
    );
};

export function getShareableTextTemplate(
  schemaLike: FormSchema | Record<string, unknown> | null | undefined,
): string | undefined {
  if (!schemaLike || typeof schemaLike !== "object") {
    return undefined;
  }
  const template = (schemaLike as FormSchema).shareableTextTemplate;
  return typeof template === "string" ? template : undefined;
}

export function getDefaultShareableTextTemplate(
  schemaLike: FormSchema | Record<string, unknown> | null | undefined,
): string | undefined {
  if (!schemaLike || typeof schemaLike !== "object") {
    return undefined;
  }
  const template = (schemaLike as FormSchema).defaultShareableTextTemplate;
  return typeof template === "string" ? template : undefined;
}

export function getCompletedShareableTextTemplate({
  schemaSnapshot,
  currentSchema,
}: {
  schemaSnapshot?: FormSchema | Record<string, unknown> | null;
  currentSchema?: FormSchema | Record<string, unknown> | null;
}): string | undefined {
  return (
    getShareableTextTemplate(schemaSnapshot) ??
    getShareableTextTemplate(currentSchema)
  );
}

/**
 * Interpolates a share text template using form response answers.
 *
 * Template syntax:
 * - #{field-id}
 *
 * If a variable name doesn't match a field, it is left as-is.
 */
export function interpolateShareText(
  template: string,
  formResponse: FormResponseDto,
): string {
  const schema = formResponse.schemaSnapshot as unknown as FormSchema;
  if (!schema?.pages) return template;

  const replaceToken = (match: string, token: string) => {
    const field = findSchemaField(schema, token);
    if (!field || !("id" in field) || typeof field.id !== "string") {
      return match;
    }
    const resolved = resolveAnswerValue(formResponse.answers[field.id]);
    return resolved ?? match;
  };

  return template.replace(/#\{([^}]+)\}/g, replaceToken);
}

export function buildShareText({
  template,
  formResponse,
  url,
}: {
  template?: string | null;
  formResponse?: FormResponseDto | null;
  url: string;
}): string {
  if (!template) return url;

  const interpolated = formResponse
    ? interpolateShareText(template, formResponse)
    : template;
  const trimmed = interpolated.trim();

  return trimmed ? `${trimmed}\n\n${url}` : url;
}
