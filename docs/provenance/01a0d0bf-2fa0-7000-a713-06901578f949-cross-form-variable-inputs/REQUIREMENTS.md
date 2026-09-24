---
user: Charles Lien
task: Allow form variables to use input values from other forms
---

## User-origin request

“Allow variables to also take in input values from other forms.”

The user suggested returning all answers in a list and observed that a single answer would also need a list for consistency.

## User-approved agent proposals

The following choices originated with the agent; the user approved them during the spec interview.

### Sources and access

- Read the signed-in member's own submitted answers. Admin previews and reviews read the selected member's answers. Other people's answers and aggregates are outside scope.
- Any other form selectable in the admin builder can be a source, including follow-up forms and forms belonging to another action.
- Support member forms on web and mobile and admin previews/reviews. Guests receive empty external inputs.
- Limit external variables to filling out forms, reopening one's own completed forms, and admin previews/reviews. Reject references to external variables in shared output when saving the form; shared response summaries and feed cards are outside scope.

### Input values

- Include all submitted responses, oldest first, excluding drafts. Every external input has an outer list, including zero or one submissions.
- Support the same question kinds and list fields as local inputs. One variable can combine local inputs and external inputs from multiple forms.
- Preserve one position per source submission. An unanswered individual question supplies `undefined` at its position; an unanswered list question supplies `[]` at its position. Inputs from the same source form remain aligned by submission.
- Preserve list answers as separate lists per submission rather than flattening them. With no submissions, the external input is `[]`.
- Interpret each answer using the field definitions in the form version attached to that response, including its original option labels.
- Load the available source history each time the destination opens, including when reopening a completed form. Do not save a historical copy of external values with the destination response.
- Keep external values stable while the destination remains open. Reopen or reload to pick up new submissions. Local inputs continue updating while the member types.

### Builder and loading

- Each variable input has a form picker defaulting to “This form,” followed by a field picker. Retain the sample-value formula preview.
- Show broken references in the builder and prevent saving them.
- Wait for required source answers before displaying the destination form. A failed load shows an error with retry rather than behaving as an unanswered question.

## User clarifications after implementation

- A question's type changing between submissions to a source form can be assumed not to happen, and the implementation may ignore that case for now. A future guard may stop admins from changing a question's type.
