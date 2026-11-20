# Evidence

## Sources

- KORA's conversation and export schemas, received 2026-11-19, copied unchanged to `docs/kora/kora_conversations.schema.yaml` and `docs/kora/kora_export.schema.yaml`. Their descriptions say the conversation format is The Alliance's proposal (Annex B) and that KORA's engineers will deliver the final import format. Status: partner specification, provisional.

## Measurements

All checked 2026-11-19 in Chrome (the desktop app's browser pane) against the local dev servers, on this branch.

- **Line boxes.** A token span's box is about 22 px tall inside a 28.9 px line (17 px text, line height 1.7). The reply's spacing rule `.bubble > * + * { margin-top: 10px }` also applied to the absolutely placed markers inside it and pushed them about 10 px down. Both caused the offset focus box the user reported.
- **SVG display.** The host page's reset makes every `svg` a block, which broke inline icons in the tip onto their own lines until they were set to `inline-block`.
- **Pane `requestAnimationFrame`.** In the desktop app's browser pane, `requestAnimationFrame` callbacks don't run while the pane is in the background. Resize redraws therefore couldn't be shown there and were checked by a synchronous redraw instead.
- **KORA's fixtures.** Run through the server's upload check (`checkTranscripts`): `kora-conversations-staging-demo-10.yaml` (10, scored), `kora-conversations-gta6-15.yaml` (15, test) and `kora_test_conversations_88.jsonl` (88, test) all pass. The older pair-format file is rejected, as expected.
