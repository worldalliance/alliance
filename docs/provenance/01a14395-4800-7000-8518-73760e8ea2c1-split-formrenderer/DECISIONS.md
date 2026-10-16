# Split shared/formrenderer.ts under the 500-line limit

[REQUIREMENTS.md](./REQUIREMENTS.md) defines the task. The choices below are agent-authored.

## Split

- The fix the waiver asks for is splitting the file. `validateFieldValue` and `getListSubFieldErrors` move into `shared/forms/fieldValidation.ts`, with their unit tests and unchanged bodies.
- Consumers import moved functions from their new modules. `formrenderer.ts` does not re-export them, as in the earlier `shared/lib/messages.ts` split; a re-export layer would leave two import paths for one function.
- The waiver goes in the commit that takes the file under 500 lines, so no commit carries an unused directive.
