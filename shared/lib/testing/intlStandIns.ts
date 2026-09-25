import { resetTimeZoneCaches } from "../../forms/timeZoneSelect";

type FormatterArgs = {
  locales?: Intl.LocalesArgument;
  options?: Intl.DateTimeFormatOptions;
};

type Formatting = (
  locales?: Intl.LocalesArgument,
  options?: Intl.DateTimeFormatOptions,
) => Intl.DateTimeFormat;

// Each of these wraps whichever Intl.DateTimeFormat is in place rather than the
// real one, so they nest into a runtime short of several things at once.
export function standingInFor(formatting: Formatting, body: () => void): void {
  const real = Intl.DateTimeFormat;

  // The picker reaches Intl.DateTimeFormat with `new`, which an arrow cannot
  // answer.
  function standIn(
    locales?: Intl.LocalesArgument,
    options?: Intl.DateTimeFormatOptions,
  ) {
    return formatting(locales, options);
  }

  Intl.DateTimeFormat = Object.assign(standIn, real);
  resetTimeZoneCaches();
  try {
    body();
  } finally {
    Intl.DateTimeFormat = real;
    resetTimeZoneCaches();
  }
}

export function patchingIntl(
  patch: (args: FormatterArgs) => FormatterArgs,
  body: () => void,
): void {
  const real = Intl.DateTimeFormat;

  standingInFor((locales, options) => {
    const taken = patch({ locales, options });
    return new real(taken.locales, taken.options);
  }, body);
}

export const rejecting = (style: string, body: () => void) =>
  patchingIntl((args) => {
    if (args.options?.timeZoneName === style) throw new RangeError("no data");
    return args;
  }, body);

export const fallingBackTo = (
  { locale, ignoring }: { locale: string; ignoring?: "calendar" },
  body: () => void,
) =>
  patchingIntl(
    ({ options }) => ({
      locales: locale,
      options: ignoring ? { ...options, [ignoring]: undefined } : options,
    }),
    body,
  );
