export enum WaitlistEmailPlaceholder {
  Name = "name",
  OrganizationName = "organizationName",
  SignupLink = "signupLink",
  PersonalShareLink = "personalShareLink",
}

// An unclosed `#{` matches to the end of its line, so it reads as unknown.
const PLACEHOLDER_PATTERN = /#\{([^}\n]*)(\}|$)/gm;

const PLACEHOLDERS = new Set<string>(Object.values(WaitlistEmailPlaceholder));

const isPlaceholder = (name: string): name is WaitlistEmailPlaceholder =>
  PLACEHOLDERS.has(name);

export type WaitlistEmailPlaceholders = {
  used: Set<WaitlistEmailPlaceholder>;
  unknown: string[];
};

export function findWaitlistEmailPlaceholders(
  texts: string[],
): WaitlistEmailPlaceholders {
  const used = new Set<WaitlistEmailPlaceholder>();
  const unknown = new Set<string>();
  for (const text of texts) {
    for (const [token, name, close] of text.matchAll(PLACEHOLDER_PATTERN)) {
      if (close && isPlaceholder(name)) used.add(name);
      else unknown.add(token);
    }
  }
  return { used, unknown: [...unknown] };
}

/** Replaces every known placeholder; unknown ones stay as written. */
export const replaceWaitlistEmailPlaceholders = (
  text: string,
  valueOf: (placeholder: WaitlistEmailPlaceholder) => string,
): string =>
  text.replace(PLACEHOLDER_PATTERN, (token, name: string, close: string) =>
    close && isPlaceholder(name) ? valueOf(name) : token,
  );
