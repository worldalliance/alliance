// display-blocks.ts
import { Condition } from './schema';

export type DisplayKind =
  | 'header' // H1–H6
  | 'text' // plain or markdown text
  | 'label' // small label/caption
  | 'divider' // horizontal rule
  | 'spacer' // vertical space
  | 'html' // controlled/allowlisted HTML snippet
  | 'image' // decorative image
  | 'quote';

interface BaseBlock {
  kind: DisplayKind;
  /** Optional: display blocks usually don’t need IDs, but you can keep one for analytics/testing */
  id?: string;
  visibleIf?: Condition[];
  width?: 'full' | '1/2' | '1/3';
}

// Specific blocks

export type HeaderBlock = BaseBlock & {
  kind: 'header';
  text: string;
  level?: 1 | 2 | 3 | 4 | 5 | 6; // default 2
};

export type TextBlock = BaseBlock & {
  kind: 'text';
  text: string;
};

export type QuoteBlock = BaseBlock & {
  kind: 'quote';
  text: string;
};

export type LabelBlock = BaseBlock & {
  kind: 'label';
  text: string;
};

export type DividerBlock = BaseBlock & {
  kind: 'divider';
  thickness?: 'hairline' | 'thin' | 'medium' | 'thick';
};

export type SpacerBlock = BaseBlock & {
  kind: 'spacer';
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
};

export type HtmlBlock = BaseBlock & {
  kind: 'html';
  /** store a sanitized/whitelisted HTML snippet on the server */
  html: string;
};

export type ImageBlock = BaseBlock & {
  kind: 'image';
  alt: string;
  src: string; // or { key: string } if you want S3 keys
  aspectRatio?: number; // e.g., 16/9
  caption?: string;
};

export type DisplayBlock =
  | HeaderBlock
  | TextBlock
  | QuoteBlock
  | LabelBlock
  | DividerBlock
  | SpacerBlock
  | HtmlBlock
  | ImageBlock;
