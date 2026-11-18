# Decisions

- **The plain card picks the thumbnail path by field kind (file or image), not by whether the answer has file values.** `getOutputFileValues` counts every non-empty string answer as a file value, so the earlier check sent text answers to the 14px non-plain style and lost their line breaks. (agent decision, from review finding `strings-as-files`)
