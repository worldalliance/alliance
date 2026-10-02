import { toString as mdastToString } from "mdast-util-to-string";
import { remark } from "remark";

export function getPreviewText(body: string) {
  const tree = remark().parse(body);
  const plainText = mdastToString(tree).replace(/\s+/g, " ").trim();

  return plainText.length > 140
    ? `${plainText.slice(0, 137).trimEnd()}...`
    : plainText;
}
