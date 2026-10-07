# Layout

- Share the hero’s 1,400px container with the progress bar, timeline, and questions so their outside edges align.
- Keep a viewport minimum height for the blue section. Increase desktop top spacing and split extra height equally between the area above the progress bar and below the timeline. The base 8.5rem lower gap approximately matches the advisor-to-timeline space occupied by the progress bar and its margins. Pending clarification, interpret the requested lower gap as the blue section’s bottom edge.
- Increase the progress-to-timeline gap and bottom padding by the same small increment to preserve desktop vertical balance.
- Place timeline nodes at five equal intervals. Keep centered intermediate labels and inward-aligned endpoints; use vertical steps on smaller screens.
- Present the questions as a 2×2 card grid using the homepage HowItWorks/ProductCards treatment: zinc-100 surfaces, the shared site-radius-card token, and compact gutters. Keep serif headings and centered prose on desktop, with the ordered process left-aligned. Below the two-column breakpoint, use a plain left-aligned list without card backgrounds or inset padding. Pair the short overview and participation answers in the first row and the longer process and rationale answers in the second.
- Reuse the site’s display headings, Markdown renderer, navy, and green accents.

# Design references

- [Stripe Climate](https://stripe.com/climate): inspected its full-width content panels as a reference for grouping explanations.
- [Process Steps Pro](https://www.framer.com/marketplace/components/process-steps-pro/): inspected its stacked rows and variable-height expanded answers. Borrow the row structure while keeping all answers visible.
- [GiveWell](https://www.givewell.org/how-we-work): inspected its text grid; it is too close to the floating quadrants the user disliked.

- Apply a 2.5rem desktop downward offset to the signup form for the visual alignment requested in the screenshot. Matching element-box centers alone did not satisfy that alignment.

- Group the mobile hero and progress bar in a viewport-height minimum, subtracting the reserved navbar height; use automatic space above progress to place it near the bottom. Let unusually short viewports scroll rather than clip signup controls. Use display: contents at desktop widths to preserve the existing blue-section layout.
- Reduce this page’s title line height from 1.35 to 1.2 through DisplayHeading’s existing leading prop.
- At desktop widths, allocate one third of viewport height above 1,000px to extra space above the hero. The existing two growing regions split the remaining surplus, balancing top, middle, and bottom space while leaving shorter desktops and mobile unchanged.
