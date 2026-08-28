import { type ReactNode, useEffect } from "react";

export function HtmlBackgroundManager({ children }: { children: ReactNode }) {
  return children;
}

export const useWhiteBackground = () => {
  useEffect(() => {
    if (typeof document === "undefined") return;
    document.documentElement.classList.add("white");
  }, []);
};

/**
 * The public site's surface. Set on `html` so overscroll and the scrollbar
 * gutter match the page.
 */
export const useSiteBackground = () => {
  useEffect(() => {
    if (typeof document === "undefined") return;
    const root = document.documentElement;
    root.classList.remove("white");
    root.classList.add("site-surface");
    return () => root.classList.remove("site-surface");
  }, []);
};

export const useGrayBackground = () => {
  useEffect(() => {
    if (typeof document === "undefined") return;
    document.documentElement.classList.remove("white");
  }, []);
};
