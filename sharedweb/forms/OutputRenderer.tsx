import {
  plainAnswer,
  type ResolvedOutputFieldItem,
} from "@alliance/shared/outputrenderer";
import { CardStyle } from "@alliance/shared/styles/card";
import { cn } from "@alliance/shared/styles/util";
import { staticFieldContext } from "@alliance/shared/useFormRenderer";
import {
  useOutputItems,
  type OutputSource,
} from "@alliance/shared/useOutputItems";
import type { ReactNode } from "react";
import { imageSrcFromKey } from "../lib/imageSrc";
import Card from "../ui/Card";
import { ImageThumbnailGrid } from "../ui/ImageLightbox";
import RenderDisplayBlock from "./RenderDisplayBlock";
import RenderField from "./RenderField";

type OutputRendererProps = OutputSource & {
  className?: string;
  /** Answers as bare text and uploads as thumbnails, without the card or labels. */
  plain?: boolean;
};

const renderOutputFieldValue = (item: ResolvedOutputFieldItem): ReactNode => {
  if (!item.field) {
    return (
      <span className="text-xs text-gray-500">Field removed from form.</span>
    );
  }
  if (item.field.kind === "file" || item.field.kind === "image") {
    if (!item.fileValues.length) {
      return <span className="text-xs text-gray-500">No file uploaded</span>;
    }
    const imageUrls = item.fileValues.map((entry) => imageSrcFromKey(entry));
    return <ImageThumbnailGrid images={imageUrls} alt="Uploaded file" />;
  }
  if (!item.formattedValue) {
    return <span className="text-sm text-gray-400">No response</span>;
  }
  return <span className="text-sm text-gray-900">{item.formattedValue}</span>;
};

function PlainOutputFieldValue({ item }: { item: ResolvedOutputFieldItem }) {
  const { text, uploads } = plainAnswer(item);
  return (
    <>
      {text && (
        <p className="whitespace-pre-line text-base text-zinc-900">{text}</p>
      )}
      {uploads.length > 0 && (
        <ImageThumbnailGrid
          images={uploads.map((upload) => imageSrcFromKey(upload))}
          alt="Uploaded file"
        />
      )}
    </>
  );
}

export function OutputRenderer({
  className = "",
  plain = false,
  ...source
}: OutputRendererProps) {
  const items = useOutputItems(source);
  if (items.length === 0) {
    return null;
  }

  const answers = (
    <div className={cn("space-y-2", className)}>
      {items.map((item, index) => {
        if (item.type === "display") {
          return (
            <div
              key={item.key}
              className={cn(
                item.block.kind === "header" && index > 0 && "pt-4",
              )}
            >
              <RenderDisplayBlock block={item.block} />
            </div>
          );
        }
        if (plain) {
          return <PlainOutputFieldValue key={item.key} item={item} />;
        }

        const content = renderOutputFieldValue(item);
        if (item.format === "card") {
          return (
            <Card key={item.key}>
              {item.showLabel && (
                <p className="text-xs uppercase tracking-wide text-gray-500 mb-1">
                  {item.label}
                </p>
              )}
              <div className="text-lg">{content}</div>
            </Card>
          );
        }
        if (item.format === "textonly") {
          return (
            <div key={item.key} className="text-sm text-gray-900">
              {item.showLabel && (
                <span className="font-medium text-gray-700">
                  {item.label}:{" "}
                </span>
              )}
              {content}
            </div>
          );
        }
        if (!item.renderField) {
          return null;
        }
        return (
          <div key={item.key} className="space-y-1">
            <RenderField
              field={item.renderField}
              value={item.value}
              disabled
              isOutputView
              fieldContext={staticFieldContext}
            />
          </div>
        );
      })}
    </div>
  );
  return plain ? answers : <Card style={CardStyle.LightGrey}>{answers}</Card>;
}

export default OutputRenderer;
