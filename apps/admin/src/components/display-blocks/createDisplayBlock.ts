import type {
  DisplayBlock,
  DisplayKind,
} from "@alliance/common/forms/display-blocks";

const FACTORIES: {
  [K in DisplayKind]: (id: string) => Extract<DisplayBlock, { kind: K }>;
} = {
  header: (id) => ({
    type: "display",
    kind: "header",
    id,
    text: "Header Text",
    level: 2,
  }),
  text: (id) => ({ type: "display", kind: "text", id, text: "Text content" }),
  label: (id) => ({ type: "display", kind: "label", id, text: "Label text" }),
  divider: (id) => ({
    type: "display",
    kind: "divider",
    id,
    thickness: "thin",
  }),
  spacer: (id) => ({ type: "display", kind: "spacer", id, size: "md" }),
  html: (id) => ({
    type: "display",
    kind: "html",
    id,
    html: "<p>Custom HTML content</p>",
  }),
  images: (id) => ({ type: "display", kind: "images", id, images: [] }),
  video: (id) => ({ type: "display", kind: "video", id, src: "" }),
  quote: (id) => ({ type: "display", kind: "quote", id, text: "body text" }),
  biglink: (id) => ({
    type: "display",
    kind: "biglink",
    id,
    text: "Link title",
    url: "/",
  }),
  copytext: (id) => ({ type: "display", kind: "copytext", id, text: "" }),
  previousAnswer: (id) => ({
    type: "display",
    kind: "previousAnswer",
    id,
    sourceFormId: 0,
    sourceFieldId: "",
    title: "",
    showLabel: true,
  }),
  userLocation: (id) => ({
    type: "display",
    kind: "userLocation",
    id,
    title: "Your location",
    emptyText: "No location set",
  }),
  chatTranscript: (id) => ({
    type: "display",
    kind: "chatTranscript",
    id,
    messages: [],
  }),
  accordion: (id) => ({ type: "display", kind: "accordion", id, sections: [] }),
};

export const createDisplayBlock = <K extends DisplayKind>(
  kind: K,
  id: string,
): Extract<DisplayBlock, { kind: K }> => FACTORIES[kind](id);
