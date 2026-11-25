# Decisions

- **No empty wrapper above "Tasks".** On desktop the general updates wrapper above "Tasks" renders only when there are general updates or a load error. Empty, it still took a page gap (4rem), which pushed "Tasks" below the sidebar's heading. When general updates do show, they open the main column, level with the sidebar. (agent decision)
- **Matching top padding.** The sidebar's top padding is 2rem (`pt-8`), the main column's `sm:py-8`, so the two headings start level; it was 1.5rem. Measured on a 1440×900 viewport: "Tasks" and "Project updates" both at 90 px, "Recent activity" still 263 px below "Tasks". (agent decision)
- **Sidebar bottom padding.** The sidebar's children keep 1rem of bottom padding except the last (`*:not-last:pb-4`), which is the scrolling updates list, so the list runs to the viewport's bottom edge; the list's own `pb-4` still leaves room after the last card when scrolled to the end. (agent decision)
