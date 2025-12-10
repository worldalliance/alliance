import { ReactNode } from "react";

interface TwoColumnLayoutProps {
  main: ReactNode; // main content on the left
  sidebar?: ReactNode; // optional right column content
  sidebarWidth?: number; // width of the sidebar in pixels
  className?: string; // optional outer class for customization
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
}: TwoColumnLayoutProps) {
  return (
    <div
      className={`w-full h-[calc(100vh-var(--mobile-nav-height))] bg-white  ${className}`}
    >
      <div
        className={`absolute rounded-lg top-0 left-0 bottom-0 right-0 flex flex-row items-center overflow-hidden`}
      >
        <div className="w-full h-full overflow-y-auto">{main}</div>
        {sidebar && (
          <div
            style={{ width: `${sidebarWidth}px` }}
            className="shrink-0 hidden lg:block"
          ></div>
        )}
      </div>
      {sidebar && sidebarWidth && (
        <div
          className={`ml-auto sticky top-0 h-screen bg-page px-2 hidden lg:flex flex-col gap-y-5 items-stretch overflow-y-auto mr-3 transition-all duration-200 ease-in-out `}
          style={{
            width: `${sidebarWidth}px`,
            overflowY: sidebarWidth === 0 ? "hidden" : "auto",
          }}
        >
          {sidebar}
        </div>
      )}
    </div>
  );
}
