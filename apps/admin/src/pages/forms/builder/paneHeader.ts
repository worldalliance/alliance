/**
 * Keeps a `PaneHeader`'s title on one line, truncated, so the header never
 * changes height between selections. BACKCOMPAT(pane-header-truncate): remove
 * once `PaneHeader` truncates its own title (ask builder-02, A11).
 */
export const HEADER_TRUNCATES = "[&>h2]:min-w-0 [&>h2]:truncate";
