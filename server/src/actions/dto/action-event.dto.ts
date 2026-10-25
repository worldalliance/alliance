import { OmitType, PartialType, PickType } from "@nestjs/swagger";
import { ActionEvent } from "../entities/action-event.entity";

export class ActionEventDto extends PickType(ActionEvent, [
  "id",
  "title",
  "description",
  "newStatus",
  "suiteManaged",
  "date",
]) {
  constructor(event: ActionEvent) {
    super();
    this.id = event.id;
    this.title = event.title;
    this.description = event.description;
    this.newStatus = event.newStatus;
    this.suiteManaged = event.suiteManaged;
    this.date = event.date;
  }
}

export class CreateActionEventDto extends OmitType(ActionEventDto, [
  "id",
  "suiteManaged",
]) {}

export class UpdateActionEventDto extends PartialType(CreateActionEventDto) {}
