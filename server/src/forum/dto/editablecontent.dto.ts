import { PickType } from "@nestjs/swagger";
import { getImageSource } from "src/images/images.service";
import { EditableContent } from "../entities/editablecontent.entity";

export class EditableContentDto extends PickType(EditableContent, [
  "body",
  "attachments",
  "id",
] as const) {
  constructor(editableContent: EditableContent) {
    super();
    Object.assign(this, editableContent);
    this.attachments = editableContent
      ? editableContent.attachments.map((attachment) =>
          getImageSource(attachment),
        )
      : [];
  }
}

export class CreateEditableContentDto extends PickType(EditableContent, [
  "body",
  "attachments",
] as const) {}

export class UpdateEditableContentDto extends PickType(EditableContent, [
  "body",
  "attachments",
] as const) {}
