import { memberActionPhase } from "@alliance/common/actionEvent";
import { emptyTaskFormSchema } from "@alliance/common/forms/empty-task-form-schema";
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { assertLive, softDeleteCascade } from "src/datasources/soft-delete";
import { ReminderGroupService } from "src/notifs/reminder-group.service";
import { SnapshotHistoryOwner } from "src/tasks/entities/formsnapshot.entity";
import { FormSnapshotService } from "src/tasks/formsnapshot.service";
import { isUniqueViolation } from "src/utils/db-errors";
import { DataSource, Repository } from "typeorm";
import { ActionParticipantsService } from "./action-participants.service";
import { ActionsService } from "./actions.service";
import { CohortDecisionStaffService } from "./cohort-decision-staff.service";
import type {
  CreateProjectActionDto,
  RescheduleReleaseDto,
  ScheduleReleaseDto,
} from "./dto/project-action.dto";
import { ActionEvent, ActionStatus } from "./entities/action-event.entity";
import { ActionSuite } from "./entities/action-suite.entity";
import {
  Action,
  parseAction,
  type ParsedAction,
  VisibilityMode,
} from "./entities/action.entity";
import { Project } from "./entities/project.entity";
import { insertForm } from "./form-slug";
import { GeneralUpdatesService } from "./general-updates.service";
import { assertPrerequisitesValid } from "./prerequisite-validation";
import { previousProjectStep } from "./project-steps";
import { sharesSuite } from "./sole-action-suite";

const ALREADY_SCHEDULED = "This action is already scheduled";

function assertReleaseDates(params: {
  launch: Date;
  deadline: Date | null;
  launchMoved: boolean;
  deadlineMoved: boolean;
}): void {
  const { launch, deadline, launchMoved, deadlineMoved } = params;
  const now = new Date();
  if (launchMoved && launch <= now) {
    throw new BadRequestException("The launch must be in the future");
  }
  if (deadlineMoved && deadline && deadline <= now) {
    throw new BadRequestException("The deadline must be in the future");
  }
  if (deadline && deadline <= launch) {
    throw new BadRequestException("The deadline must be after the launch");
  }
}

@Injectable()
export class ProjectActionsService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly actionsService: ActionsService,
    private readonly participants: ActionParticipantsService,
    private readonly generalUpdates: GeneralUpdatesService,
    private readonly reminderGroupService: ReminderGroupService,
    private readonly formSnapshotService: FormSnapshotService,
    private readonly cohortDecisionStaff: CohortDecisionStaffService,
    @InjectRepository(Project)
    private readonly projectRepository: Repository<Project>,
    @InjectRepository(Action)
    private readonly actionRepository: Repository<Action>,
  ) {}

  async create(params: {
    projectId: number;
    body: CreateProjectActionDto;
  }): Promise<ParsedAction> {
    const { projectId, body } = params;
    const project = await this.projectRepository.findOne({
      where: { id: projectId },
      relations: { actions: { events: true } },
    });
    if (!project) throw new NotFoundException(`Project ${projectId} not found`);
    const previous = previousProjectStep(project.actions ?? []);
    const cohortExpression = previous
      ? parseAction(previous).cohortExpression
      : { type: "Staff" as const };
    const snapshot = await this.formSnapshotService.findOrCreate(
      emptyTaskFormSchema(),
    );

    const action = await this.dataSource.transaction(async (em) => {
      await assertLive(em, {
        rows: [{ target: Project, id: projectId }],
        gone: () => new NotFoundException(`Project ${projectId} not found`),
      });
      const suite = await em.save(em.create(ActionSuite, { name: body.name }));
      const form = await insertForm(em, {
        form: {
          title: `${body.name} form`,
          formSnapshotId: snapshot.id,
          formSnapshot: snapshot,
        },
        placement: null,
      });
      await this.formSnapshotService.recordHistorical({
        owner: SnapshotHistoryOwner.Form,
        ownerId: form.id,
        snapshotId: snapshot.id,
        em,
      });
      const inserted = await this.actionsService.insertAction(em, {
        name: body.name,
        shortDescription: body.shortDescription,
        body: "",
        category: project.category,
        image: "",
        visibilityMode: VisibilityMode.Public,
        isContractSigningAction: false,
        onboarding: false,
        optional: false,
        preventCompletion: false,
        publicOnly: false,
        shouldCompleteAfterDeadline: false,
        isForumParticipationAction: false,
        suiteId: suite.id,
        taskFormId: form.id,
        cohortExpression,
      });
      await em.update(Action, inserted.id, { project: { id: projectId } });
      return inserted;
    });
    await this.actionsService.afterActionInserted(action);
    return this.actionsService.findOneOrFail({
      id: action.id,
      serverSide: true,
      includeUnpublishedUpdates: true,
    });
  }

  async scheduleRelease(params: {
    actionId: number;
    body: ScheduleReleaseDto;
  }): Promise<ParsedAction> {
    const { actionId, body } = params;
    const action = await this.findWithSuite(actionId);
    const suite = this.ownSuiteOrThrow(action);
    if (memberActionPhase(action.events ?? []).event) {
      throw new BadRequestException(ALREADY_SCHEDULED);
    }
    if (body.launch.newStatus !== ActionStatus.MemberAction) {
      throw new BadRequestException("The launch must start member action");
    }
    assertReleaseDates({
      launch: body.launch.date,
      deadline: body.deadline?.date ?? null,
      launchMoved: true,
      deadlineMoved: true,
    });

    await this.dataSource
      .transaction(async (em) => {
        await assertLive(em, {
          rows: [{ target: Action, id: actionId }],
          gone: () => new NotFoundException("Action not found"),
        });
        const saveEvent = (event: ScheduleReleaseDto["launch"]) =>
          em.save(
            em.create(ActionEvent, { ...event, action, suiteManaged: true }),
          );
        const launch = await saveEvent(body.launch);
        if (body.deadline) await saveEvent(body.deadline);
        await assertPrerequisitesValid({ em, actionIds: [actionId] });
        for (const reminder of body.reminders) {
          await this.reminderGroupService.createReminderGroup(
            launch.id,
            { ...reminder, suiteId: suite.id },
            em,
          );
        }
      })
      .catch((error: unknown) => {
        if (isUniqueViolation(error, "UQ_action_event_one_member_action")) {
          throw new BadRequestException(ALREADY_SCHEDULED);
        }
        throw error;
      });
    return this.afterEventsChanged({ actionId, suiteId: suite.id });
  }

  async rescheduleRelease(params: {
    actionId: number;
    body: RescheduleReleaseDto;
    acknowledgeDeadlineShortening: boolean;
  }): Promise<ParsedAction> {
    const { actionId, body } = params;
    const action = await this.findWithSuite(actionId);
    const suite = this.ownSuiteOrThrow(action);
    const { event, deadlineEvent } = memberActionPhase(action.events ?? []);
    if (!event) throw new BadRequestException("This action isn't scheduled");
    const now = new Date();
    const launchMoved =
      body.launch !== undefined &&
      body.launch.getTime() !== event.date.getTime();
    if (launchMoved && event.date <= now) {
      throw new BadRequestException("The launch is locked once it has passed");
    }
    if (body.deadline !== undefined) {
      if (!deadlineEvent) {
        throw new BadRequestException("This release has no deadline");
      }
      if (deadlineEvent.date <= now) {
        throw new BadRequestException("The deadline has already passed");
      }
    }
    assertReleaseDates({
      launch: body.launch ?? event.date,
      deadline: body.deadline ?? deadlineEvent?.date ?? null,
      launchMoved,
      deadlineMoved: body.deadline !== undefined,
    });

    await this.cohortDecisionStaff.guardDeadlineShortening({
      actionIds: [actionId],
      acknowledged: params.acknowledgeDeadlineShortening,
      change: async (em) => {
        await assertLive(em, {
          rows: [{ target: Action, id: actionId }],
          gone: () => new NotFoundException("Action not found"),
        });
        if (launchMoved) {
          await em.update(ActionEvent, event.id, { date: body.launch });
        }
        if (body.deadline !== undefined && deadlineEvent) {
          await em.update(ActionEvent, deadlineEvent.id, {
            date: body.deadline,
          });
        }
        await assertPrerequisitesValid({ em, actionIds: [actionId] });
      },
    });
    return this.afterEventsChanged({ actionId, suiteId: suite.id });
  }

  async unscheduleRelease(actionId: number): Promise<ParsedAction> {
    const action = await this.findWithSuite(actionId);
    const suite = this.ownSuiteOrThrow(action);
    const { event, deadlineEvent } = memberActionPhase(action.events ?? []);
    if (!event) throw new BadRequestException("This action isn't scheduled");
    if (event.date <= new Date()) {
      throw new BadRequestException("This action has already launched");
    }

    await this.dataSource.transaction(async (em) => {
      await softDeleteCascade(em, {
        target: ActionEvent,
        ids: [event.id, ...(deadlineEvent ? [deadlineEvent.id] : [])],
      });
      await assertPrerequisitesValid({ em, actionIds: [actionId] });
    });
    return this.afterEventsChanged({ actionId, suiteId: suite.id });
  }

  private async findWithSuite(actionId: number): Promise<Action> {
    const action = await this.actionRepository.findOne({
      where: { id: actionId },
      relations: { events: true, suite: { actions: true } },
    });
    if (!action) throw new NotFoundException("Action not found");
    return action;
  }

  private ownSuiteOrThrow(action: Action): ActionSuite {
    if (!action.suite) {
      throw new BadRequestException("This action has no suite");
    }
    if (sharesSuite(action.suite, action.id)) {
      throw new BadRequestException(
        "This action shares its suite with other actions; schedule it from the suite page",
      );
    }
    return action.suite;
  }

  private async afterEventsChanged(params: {
    actionId: number;
    suiteId: number;
  }): Promise<ParsedAction> {
    const { actionId, suiteId } = params;
    await this.participants.reloadUsersJoinedForAction(actionId);
    await this.generalUpdates.syncGeneralUpdateDatesForSuites([suiteId]);
    return this.actionsService.findOneOrFail({
      id: actionId,
      serverSide: true,
      includeUnpublishedUpdates: true,
    });
  }
}
