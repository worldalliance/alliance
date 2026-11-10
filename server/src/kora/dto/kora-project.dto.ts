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

export type KoraAdminProject = { project: KoraProject; canActivate: boolean };

export class KoraAdminProjectDto extends PickType(KoraProject, ["status"]) {
  @ApiProperty({ description: "Whether the project may be made active now" })
  canActivate: boolean;

  constructor(input: KoraAdminProject) {
    super();
    this.status = input.project.status;
    this.canActivate = input.canActivate;
  }
}

export class UpdateKoraProjectDto {
  @ApiProperty({ enum: KoraProjectStatus, enumName: "KoraProjectStatus" })
  @IsEnum(KoraProjectStatus)
  status: KoraProjectStatus;
}
