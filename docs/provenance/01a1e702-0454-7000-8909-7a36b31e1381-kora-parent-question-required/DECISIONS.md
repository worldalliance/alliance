# Decisions

- Whether a profile question offers "Prefer not to say" follows its `req` flag, so a question made required later drops the option with no separate setting. The optional questions keep it. (agent decision)
- The pre-survey's "Please answer" error drops its sentence 'Each one has a "Prefer not to say" option.', which would now be false for the parent question. (agent decision)
- The export schema still accepts `prefer_not_to_say` for `profile.is_parent`, `children_age_bands`, `country`, `age_band` and `english`, because exports saved before this change can hold it and there is no yes/no to migrate them to. Only its description changes. (agent decision)
