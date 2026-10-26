import {
  ApiProperty,
  IntersectionType,
  PartialType,
  PickType,
} from "@nestjs/swagger";
import { Transform } from "class-transformer";
import {
  IsInt,
  IsNotEmpty,
  IsString,
  MaxLength,
  ValidateIf,
} from "class-validator";
import { OptionalSlugField, slugGiven } from "src/datasources/slug-column";
import { Project } from "../entities/project.entity";
import type { ProjectStep, ProjectWithSteps } from "../projects.service";

export const PROJECT_NAME_MAX_LENGTH = 100;

export class ProjectDto extends PickType(Project, ["id", "name", "category"]) {
  constructor(input: Project) {
    super();
    this.id = input.id;
    this.name = input.name;
    this.category = input.category;
  }
}

export class AdminProjectDto extends ProjectDto {
  @ApiProperty()
  slug: string;

  constructor(input: Project) {
    super(input);
    this.slug = input.slug;
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

export class ProjectWithStepsDto extends AdminProjectDto {
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

export class CreateProjectDto extends ProjectNameDto {
  @OptionalSlugField()
  @ValidateIf(slugGiven)
  slug?: string;
}

export class UpdateProjectDto extends PartialType(
  IntersectionType(ProjectNameDto, PickType(Project, ["category"])),
) {
  @OptionalSlugField()
  @ValidateIf(slugGiven)
  slug?: string;
}

export class AssignProjectDto {
  @ApiProperty({ type: Number, nullable: true })
  @ValidateIf((dto: AssignProjectDto) => dto.projectId !== null)
  @IsInt()
  projectId: number | null;
}
