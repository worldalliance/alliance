import { ApiProperty, PickType } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { Allow } from "class-validator";
import { ActionSuite } from "../entities/action-suite.entity";
import {
  loadedActionEvents,
  type ParsedAction,
} from "../entities/action.entity";
import { ActionEventDto } from "./action-event.dto";
import { ActionDto } from "./action.dto";
import { GeneralUpdateDto } from "./general-update.dto";
import { ReminderGroupDto } from "./reminder-group.dto";

export class CreateActionSuiteDto extends PickType(ActionSuite, ["name"]) {}

export class ActionSuiteDto extends PickType(ActionSuite, ["id", "name"]) {
  @ApiProperty({ type: () => ActionDto, isArray: true })
  @Type(() => ActionDto)
  @Allow()
  actions: ActionDto[];

  @ApiProperty({ type: () => ActionEventDto, isArray: true })
  @Type(() => ActionEventDto)
  @Allow()
  events: ActionEventDto[];

  @ApiProperty({ type: () => ReminderGroupDto, isArray: true })
  @Type(() => ReminderGroupDto)
  @Allow()
  reminderGroups: ReminderGroupDto[];

  @ApiProperty({ type: () => GeneralUpdateDto, isArray: true })
  @Type(() => GeneralUpdateDto)
  @Allow()
  generalUpdates: GeneralUpdateDto[];

  constructor(suite: ActionSuite, actions: ParsedAction[]) {
    super();
    this.id = suite.id;
    this.name = suite.name;
    this.actions = actions.map((action) => new ActionDto(action));
    // Suite events are stored as per-action duplicate rows tagged suiteManaged;
    // we surface actions[0]'s copies as canonical. Brittle if actions drift —
    // any divergence (extra/missing rows, reordering) is invisible here.
    this.events = actions.length
      ? loadedActionEvents(actions[0])
          .filter((event) => event.suiteManaged)
          .map((event) => new ActionEventDto(event))
      : [];
    this.reminderGroups =
      suite.reminderGroups?.map((group) => new ReminderGroupDto(group)) ?? [];
    this.generalUpdates =
      suite.generalUpdates?.map((update) => new GeneralUpdateDto(update)) ?? [];
  }
}
