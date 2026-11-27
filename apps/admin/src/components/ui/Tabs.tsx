import { cn } from "@alliance/shared/styles/util";
import { Link } from "react-router";

export enum TabsStyle {
  /** A page's main tabs, underlined. */
  Underline = "underline",
  /** Views within one tab, as a segmented control. */
  Segmented = "segmented",
}

const NAV_CLASS: Record<TabsStyle, string> = {
  [TabsStyle.Underline]:
    "flex gap-x-6 overflow-x-auto shadow-[inset_0_-1px_0_var(--color-zinc-200)]",
  [TabsStyle.Segmented]:
    "flex w-fit gap-x-1 rounded-md border border-zinc-200 bg-zinc-100 p-0.5",
};

const LINK_CLASS: Record<TabsStyle, { base: string; current: string }> = {
  [TabsStyle.Underline]: {
    base: "border-b-2 border-transparent px-1 py-2 text-sm whitespace-nowrap text-zinc-600 hover:text-zinc-900",
    current: "border-zinc-900 font-medium text-zinc-900",
  },
  [TabsStyle.Segmented]: {
    base: "rounded-md px-3 py-1 text-sm whitespace-nowrap text-zinc-600 hover:text-zinc-900",
    current: "bg-white font-medium text-zinc-900 shadow-sm",
  },
};

export type TabItem<T extends string> = { key: T; label: string };

/** Links that switch a URL-kept tab, from `useSearchParamTab`. */
const Tabs = <T extends string>({
  label,
  items,
  current,
  href,
  style = TabsStyle.Underline,
}: {
  /** Names the set for screen readers, as several can share a page. */
  label: string;
  items: TabItem<T>[];
  current: T;
  href: (key: T) => string;
  style?: TabsStyle;
}) => (
  <nav aria-label={label}>
    <ul className={NAV_CLASS[style]}>
      {items.map((item) => (
        <li key={item.key} className="flex">
          <Link
            to={href(item.key)}
            preventScrollReset
            aria-current={item.key === current ? "page" : undefined}
            className={cn(
              "outline-hidden focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-inset",
              LINK_CLASS[style].base,
              item.key === current && LINK_CLASS[style].current,
            )}
          >
            {item.label}
          </Link>
        </li>
      ))}
    </ul>
  </nav>
);

export default Tabs;
