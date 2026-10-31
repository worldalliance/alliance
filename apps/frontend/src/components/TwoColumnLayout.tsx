import { cn } from "@alliance/shared/styles/util";
import { ReactNode, RefObject } from "react";

const TWO_COLUMN_LAYOUT_CLASSNAME =
  "w-full h-[calc(100vh-var(--navbar-top-bar-height))] bg-page";

interface TwoColumnLayoutProps {
  main: ReactNode; // main content on the left
  sidebar?: ReactNode; // optional right column content
  sidebarWidth?: number; // width of the sidebar in pixels
  className?: string; // optional outer class for customization
  noSidebarOverflow?: boolean;
  mainScrollRef?: RefObject<HTMLDivElement | null>;
}

/**
 * A flexible two-column layout:
 * - Left: white page area with scroll
 * - Right: sidebar column for extra content
 */
export default function TwoColumnLayout({
  main,
  sidebar,
  sidebarWidth = 380,
  className = "",
  noSidebarOverflow = false,
  mainScrollRef,
}: TwoColumnLayoutProps) {
  return (
    <div className={cn(TWO_COLUMN_LAYOUT_CLASSNAME, className)}>
      <div className="absolute rounded-lg top-0 left-0 bottom-0 right-0 flex flex-row items-center overflow-hidden">
        <div
          ref={mainScrollRef}
          className="w-full h-full overflow-y-auto [scrollbar-gutter:stable]"
        >
          {main}
        </div>
        {sidebar && (
          <div
            style={{ width: `${sidebarWidth}px` }}
            className="shrink-0 hidden lg:block"
          ></div>
        )}
      </div>
      {!!sidebar && (
        <div
          className="ml-auto sticky top-0 h-full bg-page flex-col gap-y-5 items-stretch overflow-y-auto transition-all duration-200 ease-in-out overflow-x-hidden"
          style={{
            width: `${sidebarWidth}px`,
            overflowY:
              sidebarWidth === 0 || noSidebarOverflow ? "hidden" : "auto",
          }}
        >
          {sidebar}
        </div>
      )}
    </div>
  );
}
