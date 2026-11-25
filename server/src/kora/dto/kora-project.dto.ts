import { KoraProjectStatus } from "@alliance/common/kora";
import { ApiProperty, PickType } from "@nestjs/swagger";
import { IsEnum } from "class-validator";
import { KoraProject } from "../entities/kora-project.entity";

export class KoraProjectDto extends PickType(KoraProject, ["status"]) {
  constructor(input: KoraProject) {
    super();
    this.status = input.status;
  }
}

export type KoraAdminProject = {
  project: KoraProject;
  canActivate: boolean;
  toNotify: number;
  moreToNotify: number;
};

export class KoraAdminProjectDto extends PickType(KoraProject, ["status"]) {
  @ApiProperty({ description: "Whether the project may be made active now" })
  canActivate: boolean;

  @ApiProperty({
    description: "Participants not yet told the reviews are open",
  })
  toNotify: number;

  @ApiProperty({
    description:
      "Reviewers who finished and haven't been told about the newest batch",
  })
  moreToNotify: number;

  constructor(input: KoraAdminProject) {
    super();
    this.status = input.project.status;
    this.canActivate = input.canActivate;
    this.toNotify = input.toNotify;
    this.moreToNotify = input.moreToNotify;
  }
}

export class UpdateKoraProjectDto {
  @ApiProperty({ enum: KoraProjectStatus, enumName: "KoraProjectStatus" })
  @IsEnum(KoraProjectStatus)
  status: KoraProjectStatus;
}

export class KoraNotifyQueuedDto {
  @ApiProperty({
    description: "Participants the launch message is being sent to",
  })
  queued: number;

  constructor(input: { queued: number }) {
    this.queued = input.queued;
  }
}
