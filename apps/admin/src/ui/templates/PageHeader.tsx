import type { ReactNode } from "react";
import { Link } from "react-router";
import { formatCount } from "../../lib/formatNumber";
import type { Crumb } from "../../places";
import { TabsList, TabsTab } from "../Tabs";

export type PageTab<T extends string = string> = {
  id: T;
  label: string;
  /** Only where today's page shows this count. `null` when it couldn't load: the tab shows "!". */
  count?: number | null;
};

export type PageHeaderProps = {
  /** The links above this page, nearest last. */
  trail: readonly Crumb[];
  /** The page's name: the `h1`, and the end of the trail. */
  title: string;
  /** The record's status badge, directly after the title. */
  badge?: ReactNode;
  /**
   * One muted line under the title: a count, or a record's facts. Pass `""`
   * while the record loads, which holds the line so nothing below moves.
   */
  description?: ReactNode;
  /** At most one primary button, then secondary ones, then a "More" menu. */
  actions?: ReactNode;
};

export function PageHeader({
  trail,
  title,
  badge,
  description,
  actions,
}: PageHeaderProps) {
  return (
    <header className="flex shrink-0 flex-col gap-1 px-page pt-page-top">
      {/* An area's own page has no trail; the row stays so every title sits at one height. */}
      <div className="min-h-4">
        {trail.length > 0 && (
          <nav aria-label="Breadcrumb">
            <ol className="flex items-center gap-1.5 text-caption text-fg-muted">
              {trail.map((crumb) => (
                <li
                  key={crumb.to}
                  className="flex min-w-0 items-center gap-1.5"
                >
                  <Link
                    to={crumb.to}
                    title={crumb.label}
                    className="truncate rounded-sm focus-ring hover:text-fg hover:underline"
                  >
                    {crumb.label}
                  </Link>
                  <span
                    aria-hidden="true"
                    className="shrink-0 text-line-strong"
                  >
                    /
                  </span>
                </li>
              ))}
              <li
                aria-current="page"
                className="min-w-0 truncate font-medium text-fg"
              >
                {title}
              </li>
            </ol>
          </nav>
        )}
      </div>
      <div className="flex min-h-control flex-wrap items-center gap-x-3 gap-y-2">
        <div className="flex min-w-0 flex-1 items-center gap-2.5">
          <h1 className="truncate text-title font-semibold">{title}</h1>
          {badge && <span className="flex shrink-0 items-center">{badge}</span>}
        </div>
        {actions && (
          <div className="flex shrink-0 items-center gap-2">{actions}</div>
        )}
      </div>
      {description !== undefined && (
        <div className="min-h-lh text-fg-muted">{description}</div>
      )}
    </header>
  );
}

/** The tab row under a page header. Sits inside a `Tabs` root, which `Page` provides. */
export function PageTabList({ tabs }: { tabs: readonly PageTab[] }) {
  return (
    <TabsList className="mt-3 shrink-0 px-page">
      {tabs.map((tab) => (
        <TabsTab key={tab.id} value={tab.id}>
          {tab.label}
          {tab.count !== undefined && (
            <span className="text-caption text-fg-muted tabular-nums">
              {tab.count === null ? (
                <>
                  <span aria-hidden="true">!</span>
                  <span className="sr-only">(count couldn't load)</span>
                </>
              ) : (
                formatCount(tab.count)
              )}
            </span>
          )}
        </TabsTab>
      ))}
    </TabsList>
  );
}
