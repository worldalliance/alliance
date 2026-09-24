import { ApiProperty, PickType } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import {
  IsInt,
  IsNotEmpty,
  IsString,
  MaxLength,
  ValidateIf,
} from "class-validator";
import { Project } from "../entities/project.entity";
import type { ProjectStep, ProjectWithSteps } from "../projects.service";

export const PROJECT_NAME_MAX_LENGTH = 100;

export class ProjectDto extends PickType(Project, ["id", "name"]) {
  constructor(input: Project) {
    super();
    this.id = input.id;
    this.name = input.name;
  }
}

export class ProjectStepDto {
  @ApiProperty()
  actionId: number;

  @ApiProperty()
  actionName: string;

  @ApiProperty({ type: Date, nullable: true })
  memberActionAt: Date | null;

  constructor(input: ProjectStep) {
    this.actionId = input.action.id;
    this.actionName = input.action.name;
    this.memberActionAt = input.memberActionAt;
  }
}

export class ProjectWithStepsDto extends ProjectDto {
  @ApiProperty({
    type: () => ProjectStepDto,
    isArray: true,
    description: "The project's actions, ordered by member-action start",
  })
  steps: ProjectStepDto[];

  constructor(input: ProjectWithSteps) {
    super(input.project);
    this.steps = input.steps.map((step) => new ProjectStepDto(step));
  }
}

export class ProjectNameDto {
  @ApiProperty({ maxLength: PROJECT_NAME_MAX_LENGTH })
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(PROJECT_NAME_MAX_LENGTH)
  name: string;
}

export class AssignProjectDto {
  @ApiProperty({ type: Number, nullable: true })
  @ValidateIf((dto: AssignProjectDto) => dto.projectId !== null)
  @IsInt()
  projectId: number | null;
}
