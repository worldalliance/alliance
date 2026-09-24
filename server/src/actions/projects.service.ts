import {
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { isUniqueViolation } from "src/utils/db-errors";
import { Repository } from "typeorm";
import { Action } from "./entities/action.entity";
import { Project } from "./entities/project.entity";

export type ProjectStep = { action: Action; memberActionAt: Date | null };
export type ProjectWithSteps = { project: Project; steps: ProjectStep[] };

@Injectable()
export class ProjectsService {
  constructor(
    @InjectRepository(Project)
    private readonly projectRepository: Repository<Project>,
    @InjectRepository(Action)
    private readonly actionRepository: Repository<Action>,
  ) {}

  findAll(): Promise<Project[]> {
    return this.projectRepository.find({ order: { name: "ASC" } });
  }

  async findOneWithSteps(id: number): Promise<ProjectWithSteps> {
    const project = await this.projectRepository.findOne({
      where: { id },
      relations: { actions: { events: true } },
    });
    if (!project) throw new NotFoundException(`Project ${id} not found`);

    const steps = (project.actions ?? [])
      .map((action) => ({
        action,
        memberActionAt: action.memberActionPhase.event?.date ?? null,
      }))
      .sort(
        (a, b) =>
          (a.memberActionAt?.getTime() ?? Infinity) -
            (b.memberActionAt?.getTime() ?? Infinity) ||
          a.action.id - b.action.id,
      );
    return { project, steps };
  }

  async create(name: string): Promise<Project> {
    return this.saveName(this.projectRepository.create({ name }));
  }

  async rename(params: { id: number; name: string }): Promise<Project> {
    const project = await this.projectRepository.findOneBy({ id: params.id });
    if (!project) throw new NotFoundException(`Project ${params.id} not found`);
    project.name = params.name;
    return this.saveName(project);
  }

  async remove(id: number): Promise<void> {
    await this.projectRepository.manager.transaction(async (em) => {
      const project = await em.findOneBy(Project, { id });
      if (!project) throw new NotFoundException(`Project ${id} not found`);
      await em.update(Action, { project: { id } }, { project: null });
      await em.delete(Project, { id });
    });
  }

  async assign(params: {
    actionId: number;
    projectId: number | null;
  }): Promise<void> {
    const { actionId, projectId } = params;
    const [actionExists, projectExists] = await Promise.all([
      this.actionRepository.existsBy({ id: actionId }),
      projectId === null || this.projectRepository.existsBy({ id: projectId }),
    ]);
    if (!actionExists) {
      throw new NotFoundException(`Action ${actionId} not found`);
    }
    if (!projectExists) {
      throw new NotFoundException(`Project ${projectId} not found`);
    }
    await this.actionRepository.update(actionId, {
      project: projectId === null ? null : { id: projectId },
    });
  }

  private async saveName(project: Project): Promise<Project> {
    try {
      return await this.projectRepository.save(project);
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException(
          `A project named "${project.name}" already exists`,
        );
      }
      throw error;
    }
  }
}
