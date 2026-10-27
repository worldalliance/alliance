import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect } from "react";
import { useSearchParams } from "react-router";

type FontOption = {
  family: string;
  fallback: string;
  /** Absent for faces self-hosted in fonts.css. */
  google?: string;
};

const SANS = "system-ui, sans-serif";
const SERIF = "Georgia, serif";
const FULL = "ital,wght@0,300;0,400;0,500;0,600;0,700;1,400;1,500";

const BODY_FONTS: FontOption[] = [
  { family: "TT Neoris", fallback: SANS },
  { family: "Inter", fallback: SANS, google: FULL },
  { family: "Source Sans 3", fallback: SANS, google: FULL },
  { family: "IBM Plex Sans", fallback: SANS, google: FULL },
  { family: "DM Sans", fallback: SANS, google: FULL },
  { family: "Work Sans", fallback: SANS, google: FULL },
  { family: "Figtree", fallback: SANS, google: FULL },
  { family: "Public Sans", fallback: SANS, google: FULL },
  {
    family: "Instrument Sans",
    fallback: SANS,
    google: "ital,wght@0,400;0,500;0,600;0,700;1,400",
  },
  { family: "Manrope", fallback: SANS, google: "wght@300;400;500;600;700" },
  { family: "Geist", fallback: SANS, google: "wght@300;400;500;600;700" },
  {
    family: "Atkinson Hyperlegible",
    fallback: SANS,
    google: "ital,wght@0,400;0,700;1,400",
  },
  { family: "Literata", fallback: SERIF },
  { family: "Source Serif 4", fallback: SERIF, google: FULL },
  { family: "Newsreader", fallback: SERIF, google: FULL },
  {
    family: "Lora",
    fallback: SERIF,
    google: "ital,wght@0,400;0,500;0,600;0,700;1,400;1,500",
  },
  { family: "Crimson Pro", fallback: SERIF, google: FULL },
  {
    family: "EB Garamond",
    fallback: SERIF,
    google: "ital,wght@0,400;0,500;0,600;0,700;1,400;1,500",
  },
  { family: "Spectral", fallback: SERIF, google: FULL },
  { family: "IBM Plex Serif", fallback: SERIF, google: FULL },
  { family: "Fraunces", fallback: SERIF, google: FULL },
];

const DISPLAY_FONTS: FontOption[] = [
  { family: "Libre Caslon Condensed", fallback: SERIF },
  { family: "Libre Caslon Text", fallback: SERIF },
  {
    family: "Playfair Display",
    fallback: SERIF,
    google: FULL.replace("0,300;", ""),
  },
  { family: "Cormorant Garamond", fallback: SERIF, google: FULL },
  {
    family: "Bodoni Moda",
    fallback: SERIF,
    google: "ital,wght@0,400;0,500;0,600;0,700;1,400;1,500",
  },
  { family: "DM Serif Display", fallback: SERIF, google: "ital@0;1" },
  { family: "Instrument Serif", fallback: SERIF, google: "ital@0;1" },
  {
    family: "Libre Baskerville",
    fallback: SERIF,
    google: "ital,wght@0,400;0,700;1,400",
  },
  { family: "Young Serif", fallback: SERIF, google: "" },
  { family: "Gloock", fallback: SERIF, google: "" },
  { family: "Fraunces", fallback: SERIF, google: FULL },
  { family: "Newsreader", fallback: SERIF, google: FULL },
  {
    family: "EB Garamond",
    fallback: SERIF,
    google: "ital,wght@0,400;0,500;0,600;0,700;1,400;1,500",
  },
  { family: "Source Serif 4", fallback: SERIF, google: FULL },
  { family: "Inter", fallback: SANS, google: FULL },
  {
    family: "Instrument Sans",
    fallback: SANS,
    google: "ital,wght@0,400;0,500;0,600;0,700;1,400",
  },
];

const SLOTS = [
  {
    param: "body",
    label: "Body",
    variable: "--site-font-body",
    fonts: BODY_FONTS,
  },
  {
    param: "display",
    label: "Headings",
    variable: "--site-font-display",
    fonts: DISPLAY_FONTS,
  },
];

function loadGoogleFont(font: FontOption) {
  if (font.google === undefined) return;
  const id = `font-switcher-${font.family}`;
  if (document.getElementById(id)) return;
  const link = document.createElement("link");
  link.id = id;
  link.rel = "stylesheet";
  const axes = font.google ? `:${font.google}` : "";
  link.href = `https://fonts.googleapis.com/css2?family=${font.family.replaceAll(" ", "+")}${axes}&display=swap`;
  document.head.appendChild(link);
}

export function FontSwitcher() {
  const [params, setParams] = useSearchParams();
  const enabled = params.has("fonts");

  const choices = SLOTS.map((slot) => ({
    slot,
    font:
      slot.fonts.find((f) => f.family === params.get(slot.param)) ??
      slot.fonts[0],
  }));

  useEffect(() => {
    if (!enabled) return;
    const root = document.documentElement.style;
    for (const { slot, font } of choices) {
      loadGoogleFont(font);
      root.setProperty(slot.variable, `"${font.family}", ${font.fallback}`);
    }
    return () => {
      for (const { slot } of choices) root.removeProperty(slot.variable);
    };
  });

  if (!enabled) return null;

  const choose = (param: string, family: string) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.set(param, family);
        return next;
      },
      { replace: true, preventScrollReset: true },
    );

  return (
    <div className="site-sans fixed right-4 bottom-4 z-50 flex flex-col gap-2 rounded-lg border border-zinc-300 bg-white/95 p-3 text-sm shadow-lg backdrop-blur">
      {choices.map(({ slot, font }) => {
        const index = slot.fonts.indexOf(font);
        const step = (delta: number) =>
          choose(
            slot.param,
            slot.fonts[(index + delta + slot.fonts.length) % slot.fonts.length]
              .family,
          );
        return (
          <label key={slot.param} className="flex items-center gap-2">
            <span className="w-16 text-zinc-500">{slot.label}</span>
            <button
              type="button"
              aria-label={`Previous ${slot.label} font`}
              onClick={() => step(-1)}
              className="px-1.5 text-zinc-500 hover:text-black"
            >
              <ChevronLeft className="size-4" />
            </button>
            <select
              value={font.family}
              onChange={(e) => choose(slot.param, e.target.value)}
              className="w-52 rounded border border-zinc-300 px-2 py-1"
            >
              {slot.fonts.map((f) => (
                <option key={f.family} value={f.family}>
                  {f.family}
                  {f === slot.fonts[0] ? " (current)" : ""}
                </option>
              ))}
            </select>
            <button
              type="button"
              aria-label={`Next ${slot.label} font`}
              onClick={() => step(1)}
              className="px-1.5 text-zinc-500 hover:text-black"
            >
              <ChevronRight className="size-4" />
            </button>
          </label>
        );
      })}
    </div>
  );
}
