import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Put,
  UseGuards,
} from "@nestjs/common";
import { ApiOkResponse } from "@nestjs/swagger";
import { AdminGuard } from "src/auth/guards/admin.guard";
import {
  AssignProjectDto,
  ProjectDto,
  ProjectNameDto,
  ProjectWithStepsDto,
} from "./dto/project.dto";
import { ProjectsService } from "./projects.service";

@Controller("projects")
@UseGuards(AdminGuard)
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Get()
  @ApiOkResponse({ type: ProjectDto, isArray: true })
  async findAllAdmin(): Promise<ProjectDto[]> {
    const projects = await this.projectsService.findAll();
    return projects.map((project) => new ProjectDto(project));
  }

  @Get(":id")
  @ApiOkResponse({ type: ProjectWithStepsDto })
  async findOneAdmin(
    @Param("id", ParseIntPipe) id: number,
  ): Promise<ProjectWithStepsDto> {
    return new ProjectWithStepsDto(
      await this.projectsService.findOneWithSteps(id),
    );
  }

  @Post()
  @ApiOkResponse({ type: ProjectDto })
  async createAdmin(@Body() body: ProjectNameDto): Promise<ProjectDto> {
    return new ProjectDto(await this.projectsService.create(body.name));
  }

  @Patch(":id")
  @ApiOkResponse({ type: ProjectDto })
  async renameAdmin(
    @Param("id", ParseIntPipe) id: number,
    @Body() body: ProjectNameDto,
  ): Promise<ProjectDto> {
    return new ProjectDto(
      await this.projectsService.rename({ id, name: body.name }),
    );
  }

  @Delete(":id")
  @ApiOkResponse()
  removeAdmin(@Param("id", ParseIntPipe) id: number): Promise<void> {
    return this.projectsService.remove(id);
  }

  @Put("actions/:actionId")
  @ApiOkResponse()
  assignActionAdmin(
    @Param("actionId", ParseIntPipe) actionId: number,
    @Body() body: AssignProjectDto,
  ): Promise<void> {
    return this.projectsService.assign({
      actionId,
      projectId: body.projectId,
    });
  }
}
