import { PickType } from "@nestjs/swagger";
import { DailyStatsRecord } from "./dailystats.entity";

export class DailyStatsDto extends PickType(DailyStatsRecord, [
  "id",
  "dayId",
  "date",
  "signedMembers",
  "suspendedMembers",
  "actionsCompleted",
  "anonFormSubmissions",
  "invitesCreated",
  "invitesAccepted",
] as const) {
  constructor(input: DailyStatsRecord) {
    super();
    this.id = input.id;
    this.dayId = input.dayId;
    this.date = input.date;
    this.signedMembers = input.signedMembers;
    this.suspendedMembers = input.suspendedMembers;
    this.actionsCompleted = input.actionsCompleted;
    this.anonFormSubmissions = input.anonFormSubmissions;
    this.invitesCreated = input.invitesCreated;
    this.invitesAccepted = input.invitesAccepted;
  }
}
