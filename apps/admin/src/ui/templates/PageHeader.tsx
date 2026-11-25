import type { ReactNode } from "react";
import { Link } from "react-router";
import { TabsList, TabsTab } from "../Tabs";

export type Crumb = { label: string; to: string };

export type PageTab<T extends string = string> = {
  id: T;
  label: string;
  /** Only where today's page shows this count. */
  count?: number;
};

export type PageHeaderProps = {
  /** The trail above this page, nearest last. The page itself is the title. */
  breadcrumb?: Crumb[];
  title: string;
  /** The record's status badge, directly after the title. */
  badge?: ReactNode;
  /** One muted line under the title: a count, or a record's facts. */
  description?: ReactNode;
  /** At most one primary button, then secondary ones, then a "More" menu. */
  actions?: ReactNode;
};

export function PageHeader({
  breadcrumb,
  title,
  badge,
  description,
  actions,
}: PageHeaderProps) {
  return (
    <header className="flex shrink-0 flex-col gap-1 px-page pt-page-top">
      {breadcrumb && breadcrumb.length > 0 && (
        <nav aria-label="Breadcrumb">
          <ol className="flex flex-wrap items-center gap-1.5 text-caption text-fg-muted">
            {breadcrumb.map((crumb, index) => (
              <li key={crumb.to} className="flex items-center gap-1.5">
                {index > 0 && (
                  <span aria-hidden="true" className="text-line-strong">
                    /
                  </span>
                )}
                <Link
                  to={crumb.to}
                  className="rounded-sm focus-ring hover:text-fg hover:underline"
                >
                  {crumb.label}
                </Link>
              </li>
            ))}
          </ol>
        </nav>
      )}
      <div className="flex min-h-control flex-wrap items-center gap-x-3 gap-y-2">
        <div className="flex min-w-0 flex-1 items-center gap-2.5">
          <h1 className="truncate text-title font-semibold">{title}</h1>
          {badge && <span className="flex shrink-0 items-center">{badge}</span>}
        </div>
        {actions && (
          <div className="flex shrink-0 items-center gap-2">{actions}</div>
        )}
      </div>
      {description && <div className="text-fg-muted">{description}</div>}
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
              {tab.count.toLocaleString("en-US")}
            </span>
          )}
        </TabsTab>
      ))}
    </TabsList>
  );
}
