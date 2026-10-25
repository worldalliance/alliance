# Progress page layout

- The header uses `PageShell`'s default surface tone, so the navy band and inverted type are gone and the navbar is no longer drawn over a primary band.
- The shared column is `max-w-7xl`, applied to the page header and the projects band. It replaces the site column's `max-w-[1750px]`. The join call to action and footer stay on the site column.
- An attached link is a project writeup's page, or a featured action's `customLink`. Featured actions do not fall back to `/actions/:id` on this page. That fallback remains on `ImpactCard`, which the guide still uses, and those guide cards do not show the arrow.
- The arrow is a green right-pointing icon, rendered only when the progress card has a destination.
