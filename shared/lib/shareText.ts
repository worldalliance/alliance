import type { FormSchema } from "@alliance/common/forms/form-schema";
import { isQuestionField } from "@alliance/common/forms/form-schema";
import { actionsGetActionReferralCode } from "../client/sdk.gen";
import type { FormResponseDto } from "../client/types.gen";

export const FIRST_NAME_TOKEN = "#{first-name}";
export const FULL_NAME_TOKEN = "#{full-name}";

/**
 * Canonical action share URL. Authenticated callers get a personal
 * `?sid=<code>` suffix via the server's share-url lookup; unauthenticated
 * callers get the plain URL.
 */
export async function buildActionShareUrl({
  actionId,
  baseUrl,
  isAuthenticated,
}: {
  actionId: number;
  baseUrl: string;
  isAuthenticated: boolean;
}): Promise<string> {
  const url = `${baseUrl}/actions/${actionId}`;
  if (!isAuthenticated) return url;
  const { data } = await actionsGetActionReferralCode({
    path: { id: actionId },
  });
  return data?.referralCode
    ? `${url}?sid=${encodeURIComponent(data.referralCode)}`
    : url;
}

const getUserNameParts = (name?: string | null) => {
  const trimmedName = name?.trim() ?? "";
  if (!trimmedName) {
    return {
      firstName: null,
      fullName: null,
    };
  }

  const [firstName] = trimmedName.split(/\s+/, 1);
  return {
    firstName: firstName || null,
    fullName: trimmedName,
  };
};

const replaceLiteralToken = (
  value: string,
  token: string,
  replacement: string,
) => value.split(token).join(replacement);

const interpolateMemberNameTokens = ({
  template,
  userName,
}: {
  template: string;
  userName?: string | null;
}) => {
  const { firstName, fullName } = getUserNameParts(userName);

  let interpolatedTemplate = template;
  if (firstName) {
    interpolatedTemplate = replaceLiteralToken(
      interpolatedTemplate,
      FIRST_NAME_TOKEN,
      firstName,
    );
  }
  if (fullName) {
    interpolatedTemplate = replaceLiteralToken(
      interpolatedTemplate,
      FULL_NAME_TOKEN,
      fullName,
    );
  }

  return interpolatedTemplate;
};

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
          (isQuestionField(field) &&
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
  const snapshotTemplate = getShareableTextTemplate(schemaSnapshot);
  if (typeof snapshotTemplate === "string" && snapshotTemplate.trim()) {
    return snapshotTemplate;
  }

  const currentCompletedTemplate = getShareableTextTemplate(currentSchema);
  if (
    typeof currentCompletedTemplate === "string" &&
    currentCompletedTemplate.trim()
  ) {
    return currentCompletedTemplate;
  }

  return getDefaultShareableTextTemplate(currentSchema);
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
  userName?: string | null,
): string {
  const schema = formResponse.schemaSnapshot as unknown as FormSchema;
  // Form-response fetches don't always eager-load user, so fall back to the
  // explicitly passed userName. A blank user.name string is treated as absent.
  const responseName = formResponse.user?.name;
  const resolvedUserName =
    responseName && responseName.trim() ? responseName : userName;
  const interpolatedTemplate = interpolateMemberNameTokens({
    template,
    userName: resolvedUserName,
  });

  if (!schema?.pages) return interpolatedTemplate;

  const replaceToken = (match: string, token: string) => {
    const field = findSchemaField(schema, token);
    if (!field || !("id" in field) || typeof field.id !== "string") {
      return match;
    }
    const resolved = resolveAnswerValue(formResponse.answers[field.id]);
    return resolved ?? match;
  };

  return interpolatedTemplate.replace(/#\{([^}]+)\}/g, replaceToken);
}

export function buildShareText({
  template,
  formResponse,
  userName,
  url,
}: {
  template?: string | null;
  formResponse?: FormResponseDto | null;
  userName?: string | null;
  url: string;
}): string {
  if (!template) return url;

  const interpolated = formResponse
    ? interpolateShareText(template, formResponse, userName)
    : interpolateMemberNameTokens({ template, userName });
  const trimmed = interpolated.trim();

  return trimmed ? `${trimmed}\n\n${url}` : url;
}
