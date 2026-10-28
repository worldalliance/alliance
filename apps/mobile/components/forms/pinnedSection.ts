/** The open section whose title pins at this scroll offset: scrolled into, and
 * not so near its end that the pinned bar would cover the next title. */
export function pinnedSection<
  T extends { top: number; bottom: number },
>(params: {
  sections: Iterable<T>;
  scrollY: number;
  barHeight: number;
}): T | null {
  const { sections, scrollY, barHeight } = params;
  for (const section of sections) {
    if (scrollY > section.top && scrollY < section.bottom - barHeight) {
      return section;
    }
  }
  return null;
}
