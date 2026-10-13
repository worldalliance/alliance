import { thrownMessage } from "@alliance/common/errorMessage";
import type { PageItem } from "@alliance/common/forms/form-schema";
import { TriangleAlert } from "lucide-react";
import { useContext, type ReactNode } from "react";
import { ErrorBoundary } from "react-error-boundary";
import { OverrideTargetContext } from "../display-blocks/perUserContent";
import { SectionPanels, SidebarSection } from "./sidebarSections";

/**
 * Renders `fallback` in place of `children` when they throw, until `element`
 * or the user whose content it shows changes, so one malformed element leaves
 * the rest of the builder working and its repair shows at once. `children`
 * runs inside the boundary, so a throw while building the content is caught.
 */
export function ElementBoundary({
  element,
  fallback,
  onFlagged,
  children,
}: {
  element: PageItem;
  fallback: (message: string) => ReactNode;
  onFlagged?: (flagged: boolean) => void;
  children: () => ReactNode;
}) {
  const userId = useContext(OverrideTargetContext)?.userId;
  return (
    <ErrorBoundary
      resetKeys={[element, userId]}
      fallbackRender={({ error }) => fallback(thrownMessage(error))}
      onError={() => onFlagged?.(true)}
      onReset={() => onFlagged?.(false)}
    >
      <Rendered render={children} />
    </ErrorBoundary>
  );
}

function Rendered({ render }: { render: () => ReactNode }) {
  return render();
}

export function FlaggedElement({
  message,
  repair,
}: {
  message: string;
  repair: string;
}) {
  return (
    <ErrorCard
      heading="This element can't be shown"
      message={message}
      repair={repair}
    />
  );
}

/** The flag in every settings section, so it shows whichever one is open. */
export function FlaggedSettings(props: { message: string; repair: string }) {
  const flag = <FlaggedElement {...props} />;
  const panels: Record<SidebarSection, ReactNode> = {
    [SidebarSection.Content]: flag,
    [SidebarSection.Conditions]: flag,
    [SidebarSection.Advanced]: flag,
  };
  return <SectionPanels {...panels} />;
}

function ErrorCard({
  heading,
  message,
  repair,
}: {
  heading: string;
  message: string;
  repair: string;
}) {
  return (
    <div className="flex gap-2 rounded-md border border-dashed border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">
      <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <div>
        <p className="font-medium">{heading}</p>
        <p className="break-words text-xs">{message}</p>
        <p className="text-xs">{repair}</p>
      </div>
    </div>
  );
}

/** Renders the preview, or what stops it rendering, until `resetKeys` change,
 * so the builder and its Edit toggle outlive a form that can't be shown. */
export function PreviewBoundary({
  resetKeys,
  children,
}: {
  resetKeys: unknown[];
  children: ReactNode;
}) {
  return (
    <ErrorBoundary
      resetKeys={resetKeys}
      fallbackRender={({ error }) => (
        <ErrorCard
          heading="The preview can't be shown"
          message={thrownMessage(error)}
          repair="Go back to Edit to repair the form."
        />
      )}
    >
      {children}
    </ErrorBoundary>
  );
}
