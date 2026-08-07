import type { DisplayKind } from "@alliance/common/forms/display-blocks";

// The `text` block needs a distinct id to avoid colliding with the text field.
export const BLOCK_ELEMENTS = {
  header: { id: "header", name: "Header Block" },
  text: { id: "text-block", name: "Text Block" },
  label: { id: "label", name: "Label Block" },
  divider: { id: "divider", name: "Divider Block" },
  spacer: { id: "spacer", name: "Spacer Block" },
  html: { id: "html", name: "HTML Block" },
  image: { id: "image", name: "Image Block" },
  video: { id: "video", name: "Video Block" },
  quote: { id: "quote", name: "Quote Block" },
  biglink: { id: "biglink", name: "Big Link Block" },
  copytext: { id: "copytext", name: "Copy Text Block" },
  previousAnswer: { id: "previousAnswer", name: "Previous Answer Block" },
  userLocation: { id: "userLocation", name: "User Location Block" },
  chatTranscript: { id: "chatTranscript", name: "Chat Transcript Block" },
} as const satisfies Record<DisplayKind, { id: string; name: string }>;

export const BLOCK_KINDS = Object.keys(BLOCK_ELEMENTS) as DisplayKind[];
