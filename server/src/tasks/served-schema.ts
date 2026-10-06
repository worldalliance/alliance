import type { FormSchema, Page } from "@alliance/common/forms/form-schema";
import { getImageSource } from "src/images/images.service";
import { getVideoSource } from "src/videos/videos.service";
import type { FormSnapshot } from "./entities/formsnapshot.entity";
import { formSchemaOf } from "./form-snapshot-schema";

/** The schema getForm serves for a stored snapshot, without the contracts it fills in. */
export function servedSchema(snapshot: FormSnapshot): FormSchema {
  const schema = structuredClone(formSchemaOf(snapshot));
  const pages = schema.pages;
  const transformElement = (field: Page["fields"][number]): void => {
    if (field.kind === "images") {
      field.images = field.images.map((image) => ({
        ...image,
        src: getImageSource(image.src),
      }));
    }
    if (field.kind === "video") {
      field.src = getVideoSource(field.src);
    }
    if (field.kind === "accordion") {
      for (const section of field.sections) {
        section.blocks.forEach(transformElement);
      }
    }
  };
  for (const page of pages) {
    page.fields.forEach(transformElement);
  }
  return schema;
}
