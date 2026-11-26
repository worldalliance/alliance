# Evidence

## Contrast

Method: WCAG 2.2 relative-luminance contrast ratio, computed by hand from the colour values in `apps/frontend/src/index.css` and `sharedweb/ui/Button.tsx` at revision `ff886c540`, 2026-11-25.

- White text on `ButtonColor.Stone` (`--color-gray-4: #404040`): about 10.4:1; on its hover `#444`: about 9.7:1.
- Black text on `ButtonColor.Grey` (`--color-grey-1: oklch(95.5% 0 0)`): about 18:1.
- White text on `ButtonColor.Green` (`--color-green: rgb(98, 161, 36)`): about 3.2:1.
- `--color-green` against white, for the 3 px highlighted-reply bar: about 3.2:1.
- `text-zinc-500` (`#71717a`) and `text-red-600` (`#dc2626`) on mobile's highlighted-row tints, alpha-blended over white: on white about 4.8:1, on `bg-blue-50` about 4.4:1, on `bg-green/10` about 4.4:1, on `bg-green/20` about 3.9:1.
