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
  AdminProjectDto,
  AssignProjectDto,
  CreateProjectDto,
  ProjectWithStepsDto,
  UpdateProjectDto,
} from "./dto/project.dto";
import { ProjectsService } from "./projects.service";

@Controller("projects")
@UseGuards(AdminGuard)
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Get()
  @ApiOkResponse({ type: AdminProjectDto, isArray: true })
  async findAllAdmin(): Promise<AdminProjectDto[]> {
    const projects = await this.projectsService.findAll();
    return projects.map((project) => new AdminProjectDto(project));
  }

  @Get("by-slug/:slug")
  @ApiOkResponse({ type: AdminProjectDto })
  async findOneBySlugAdmin(
    @Param("slug") slug: string,
  ): Promise<AdminProjectDto> {
    return new AdminProjectDto(await this.projectsService.findOneBySlug(slug));
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
  @ApiOkResponse({ type: AdminProjectDto })
  async createAdmin(@Body() body: CreateProjectDto): Promise<AdminProjectDto> {
    return new AdminProjectDto(
      await this.projectsService.create({ name: body.name, slug: body.slug }),
    );
  }

  @Patch(":id")
  @ApiOkResponse({ type: AdminProjectDto })
  async updateAdmin(
    @Param("id", ParseIntPipe) id: number,
    @Body() body: UpdateProjectDto,
  ): Promise<AdminProjectDto> {
    return new AdminProjectDto(
      await this.projectsService.update({
        id,
        name: body.name,
        category: body.category,
        slug: body.slug,
      }),
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
