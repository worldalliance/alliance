import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

// tailwind-merge only knows Tailwind's default theme: without these it reads
// `text-body` as a colour and drops it beside `text-fg`. Keep in step with the
// admin's `@theme` block in `index.css`.
const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      text: ["caption", "body", "heading", "title", "stat"],
      spacing: [
        "control",
        "control-sm",
        "row",
        "th",
        "cell",
        "tab",
        "page",
        "page-top",
        "section",
        "card",
        "dialog",
        "bar",
      ],
      radius: ["card"],
      shadow: ["pop"],
      ease: ["standard"],
    },
    classGroups: {
      duration: [{ duration: ["fast", "base", "slow"] }],
      "max-h": [{ "max-h": ["available"] }],
    },
  },
});

export function cn(...classes: ClassValue[]): string {
  return twMerge(clsx(classes));
}
