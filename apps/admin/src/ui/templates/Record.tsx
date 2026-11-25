import type { ReactNode } from "react";

/**
 * A Record's body: the main column, with the side panel at a fixed width on
 * its right. In a narrow frame the panel moves above the main column.
 */
export function RecordBody({
  side,
  children,
}: {
  side: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-1 flex-col @4xl:flex-row">
      <div className="flex min-w-0 flex-1 flex-col gap-section px-page pt-section pb-12">
        {children}
      </div>
      <aside className="order-first shrink-0 border-b border-line bg-canvas px-page py-card @4xl:order-none @4xl:px-6 @4xl:w-80 @4xl:border-b-0 @4xl:border-l">
        {side}
      </aside>
    </div>
  );
}

/** A titled group in a side panel or an inspector. */
export function SidePanelSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-1 border-b border-line pb-4 not-first:pt-4 last:border-b-0">
      <h2 className="pb-1 text-caption font-medium text-fg-muted">{title}</h2>
      {children}
    </section>
  );
}

/** The label and value rows of a side panel. */
export function FactList({ children }: { children: ReactNode }) {
  return <dl className="flex flex-col">{children}</dl>;
}

export function Fact({
  label,
  children,
}: {
  label: string;
  /** "—" when the server has no value. */
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-9 items-center">
      <dt className="w-27 shrink-0 pr-2 text-fg-muted">{label}</dt>
      <dd className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
        {children}
      </dd>
    </div>
  );
}
