import type { FormSchema, Page } from "@alliance/common/forms/form-schema";
import { uploadedVideoKey } from "@alliance/common/video-src";
import { getImageSource } from "src/images/images.service";
import type { FormSnapshot } from "./entities/formsnapshot.entity";
import { formSchemaOf } from "./form-snapshot-schema";

/**
 * The schema getForm serves for a stored snapshot, without the contracts it
 * fills in. Image sources go out as stored, upload keys included, for clients
 * to resolve: an editor sends back what it was served, so a url here would be
 * saved in place of the key.
 */
export function servedSchema(snapshot: FormSnapshot): FormSchema {
  const schema = structuredClone(formSchemaOf(snapshot));
  serveVideoSources(schema);
  return schema;
}

/**
 * `schema` with page image sources rendered as urls, the shape getForm served
 * until it sent them as stored, which a legacy client may still echo.
 * BACKCOMPAT(served-image-urls): goes with the schemaSnapshot submission
 * branch, BACKCOMPAT(form-snapshot).
 */
export function withImageUrls(schema: FormSchema): FormSchema {
  const rendered = structuredClone(schema);
  const transformElement = (field: Page["fields"][number]): void => {
    if (field.kind === "images") {
      field.images = field.images.map((image) => ({
        ...image,
        src: getImageSource(image.src),
      }));
    }
    if (field.kind === "accordion") {
      for (const section of field.sections) {
        section.blocks.forEach(transformElement);
      }
    }
  };
  for (const page of rendered.pages) {
    page.fields.forEach(transformElement);
  }
  return rendered;
}

/** Mobile bundles older than useVideoSource's storage-url check would play an
 * absolute src straight from storage, so every video block anywhere in the
 * schema, output views included, is served by its key. */
function serveVideoSources(value: unknown): void {
  if (Array.isArray(value)) {
    value.forEach(serveVideoSources);
    return;
  }
  if (typeof value !== "object" || value === null) return;
  if ("kind" in value && value.kind === "video" && "src" in value) {
    if (typeof value.src === "string") {
      value.src = uploadedVideoKey(value.src) ?? value.src;
    }
  }
  Object.values(value).forEach(serveVideoSources);
}

/** A legacy client's echo of a served schema, with its video sources mapped as
 * getForm serves them now. A client that fetched the form while getForm
 * rewrote keys into storage urls echoes those urls. */
export function withServedVideoSources(
  schema: Record<string, unknown>,
): Record<string, unknown> {
  const echoed = structuredClone(schema);
  serveVideoSources(echoed);
  return echoed;
}
