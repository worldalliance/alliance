# Evidence

## What products call ordered, exclusive audience buckets

Question: what do established products call the mutually exclusive, ordered subsets a rule assigns each person to (first match wins, with a catch-all), and what does "segment" mean there? Checked 2026-11-24 by a research subagent; all are vendor documentation (vendor practice, not formal standards). No source settles a single term.

- LaunchDarkly: ordered targeting rules, first match wins, ending in a default rule; a segment is a reusable group of contexts referenced inside rules. https://launchdarkly.com/docs/home/flags/target-rules, https://launchdarkly.com/docs/home/flags/segments
- Optimizely: rules within a ruleset, with an "Everyone else" rule; reusable definitions are audiences. https://support.optimizely.com/hc/en-us/articles/38937135930253
- Statsig: rules, with an "Everyone else" rule. https://docs.statsig.com/feature-flags/conditions
- GrowthBook: rules, first match wins, then a default value; reusable definitions are saved groups. https://docs.growthbook.io/features/rules
- Braze Audience Paths: ranked audience groups, first match wins, with an "Everyone else" group last. https://www.braze.com/docs/user_guide/messaging/canvas/canvas_components/audience_paths
- Customer.io multi-split: paths evaluated in order, with a catch-all path. https://docs.customer.io/messaging/send/workflows/branches/multi-split/
- OpenFeature glossary: rules assign variants; no term for the bucket. https://openfeature.dev/specification/glossary/
- Intercom and Google Analytics use "segment" for a saved or analysis filter that can overlap others. https://www.intercom.com/help/intercom-s-key-features-explained/grouping-users/how-to-filter-and-segment-your-users, https://support.google.com/analytics/answer/12799087
