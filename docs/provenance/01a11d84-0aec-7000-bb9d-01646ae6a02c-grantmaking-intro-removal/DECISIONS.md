# Decisions

- Remove the card and its wrapper; reuse the existing signup form directly in the hero grid.
- Center the desktop hero in the available space above the timeline, replacing the card's translation and tall-screen margin with flex layout. Clamp desktop padding and timeline spacing to viewport height so short screens have room and tall screens stay balanced; verify the timeline fits at 1024×600.
- Keep the stacked mobile layout, short-phone top-padding rule, and natural-height exception for tall narrow screens. Scale ordinary phone bottom padding with viewport height to shift the shorter content upward; retain tablet padding.
