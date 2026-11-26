import type {
  OutputBlock,
  OutputViewSchema,
} from "@alliance/common/forms/form-schema";
import type { OutputDisplayBlockKind } from "./outputDisplayKinds";

export enum OutputTarget {
  All = "all",
  View = "view",
  Block = "block",
}

export type OutputSelection =
  | { target: OutputTarget.All; viewId: string | null }
  | { target: OutputTarget.View; viewId: string }
  | { target: OutputTarget.Block; viewId: string; blockKey: string };

/** A block's stable handle: its id, or kind and place for the rare block without one. */
export const outputBlockKey = (block: OutputBlock, index: number) =>
  "kind" in block ? (block.id ?? `${block.kind}-${index}`) : block.id;

export const DISPLAY_KIND_LABELS: Record<OutputDisplayBlockKind, string> = {
  header: "Header",
  text: "Text",
  label: "Label",
  divider: "Divider",
  spacer: "Spacer",
  html: "HTML",
  images: "Images",
  quote: "Quote",
  userLocation: "User location",
};

export const VIEW_LAYOUTS: {
  value: OutputViewSchema["type"];
  label: string;
}[] = [
  { value: "default", label: "Default" },
  { value: "page", label: "Detail page" },
  { value: "card", label: "Activity list card" },
  { value: "personal", label: "Personal response view" },
];
