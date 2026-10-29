# Proposed approach

Status: deferred until conversation logging is available. These are candidate implementation choices to revisit then.

- Build cases from real tasks and user corrections in the recorded conversations, redacting secrets and incidental personal information. Preserve the starting repository revision, task and relevant user messages, instruction version, model and harness settings, and observable success criteria so a case can be replayed.
- Compare current and candidate instructions on the same model and starting state. Evaluate model upgrades separately with instructions held fixed. Repeat trials in fresh environments to distinguish consistent improvements from individual successful runs.
- Check task outcomes and required boundaries rather than one exact sequence of tool calls. Use tests and artifact checks where possible, and human assessment for explanation quality, appropriate questions, and unsupported review findings. Track time, cost, unnecessary interruptions, and unrequested behavior changes separately.
- Include explanation-versus-action requests, conflicts with accepted decisions, code questions with missing documentation, appropriate research, and review anchoring. For anchoring, compare independent reviews with reviews exposed to prior rationale, retaining the independent findings before any reconciliation.
- Start with a small runner around the existing agent tools. Calibrate any automated judgment against human assessments before using it to decide instruction changes.
