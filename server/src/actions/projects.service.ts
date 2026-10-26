import {
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { throwIfSlugTaken } from "src/datasources/slug-column";
import { assertLive, softDeleteCascade } from "src/datasources/soft-delete";
import { isUniqueViolation } from "src/utils/db-errors";
import { type EntityManager, Repository } from "typeorm";
import type { ActionCategory } from "./action-category";
import { Action } from "./entities/action.entity";
import { Project, PROJECT_SLUG_INDEX } from "./entities/project.entity";

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

  async findOneBySlug(slug: string): Promise<Project> {
    const project = await this.projectRepository.findOneBy({ slug });
    if (!project) throw new NotFoundException(`Project "${slug}" not found`);
    return project;
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

  async create(params: { name: string; slug?: string }): Promise<Project> {
    return this.saveName(this.projectRepository.create(params));
  }

  async update(params: {
    id: number;
    name?: string;
    category?: ActionCategory[];
    slug?: string;
  }): Promise<Project> {
    return this.projectRepository.manager.transaction(async (em) => {
      const project = await em.findOne(Project, {
        where: { id: params.id },
        lock: { mode: "for_no_key_update" },
      });
      if (!project) {
        throw new NotFoundException(`Project ${params.id} not found`);
      }
      if (params.name !== undefined) project.name = params.name;
      if (params.category !== undefined) project.category = params.category;
      if (params.slug !== undefined) project.slug = params.slug;
      return this.saveName(project, em);
    });
  }

  async remove(id: number): Promise<void> {
    await this.projectRepository.manager.transaction(async (em) => {
      const project = await em.findOneBy(Project, { id });
      if (!project) throw new NotFoundException(`Project ${id} not found`);
      await em.update(Action, { project: { id } }, { project: null });
      await softDeleteCascade(em, { target: Project, ids: [project.id] });
    });
  }

  async assign(params: {
    actionId: number;
    projectId: number | null;
  }): Promise<void> {
    const { actionId, projectId } = params;
    await this.actionRepository.manager.transaction(async (em) => {
      // Locked so a deletion of either cannot commit before the assignment.
      const actionExists = await em.exists(Action, {
        where: { id: actionId },
        lock: { mode: "for_no_key_update" },
      });
      if (!actionExists) {
        throw new NotFoundException(`Action ${actionId} not found`);
      }
      if (projectId !== null) {
        await assertLive(em, {
          rows: [{ target: Project, id: projectId }],
          gone: () => new NotFoundException(`Project ${projectId} not found`),
        });
      }
      await em.update(Action, actionId, {
        project: projectId === null ? null : { id: projectId },
      });
    });
  }

  private async saveName(
    project: Project,
    em: EntityManager = this.projectRepository.manager,
  ): Promise<Project> {
    try {
      return await em.save(project);
    } catch (error) {
      throwIfSlugTaken({
        error,
        indexName: PROJECT_SLUG_INDEX,
        slug: project.slug,
      });
      if (isUniqueViolation(error)) {
        throw new ConflictException(
          `A project named "${project.name}" already exists`,
        );
      }
      throw error;
    }
  }
}
