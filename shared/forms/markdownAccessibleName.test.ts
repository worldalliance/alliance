import { markdownAccessibleName } from "./markdownAccessibleName";

it.each([
  [
    "strips inline formatting",
    "Your **full** [name](https://x.test)",
    "Your full name",
  ],
  ["separates paragraphs", "Donation\n\nClothing", "Donation\nClothing"],
  ["keeps a soft line break", "Line1\nLine2", "Line1\nLine2"],
  ["keeps a hard line break", "Line1  \nLine2", "Line1\nLine2"],
  [
    "separates list items",
    "Pick one:\n\n- devices\n- Drones",
    "Pick one:\ndevices\nDrones",
  ],
  [
    "keeps a heading apart from its body",
    "# Step 3\nEnter a number",
    "Step 3\nEnter a number",
  ],
])("%s", (_case, markdown, expected) => {
  expect(markdownAccessibleName(markdown)).toBe(expected);
});

it.each([
  ["empty", ""],
  ["whitespace", "   \n  "],
  [
    "an image, which the label renderer doesn't show",
    "![alt](https://x.test/a.png)",
  ],
  ["a code block, which the label renderer doesn't show", "    indented code"],
])("has no name for a label that is %s", (_case, markdown) => {
  expect(markdownAccessibleName(markdown)).toBeUndefined();
});
