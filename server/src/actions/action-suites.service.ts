import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { assertLive, softDeleteCascade } from "src/datasources/soft-delete";
import { type Repository } from "typeorm";
import { ActionParticipantsService } from "./action-participants.service";
import { ActionsService } from "./actions.service";
import { CohortDecisionStaffService } from "./cohort-decision-staff.service";
import {
  CreateActionEventDto,
  UpdateActionEventDto,
} from "./dto/action-event.dto";
import { CreateActionSuiteDto } from "./dto/action-suite.dto";
import {
  ActionEvent,
  loadedActionEventAction,
} from "./entities/action-event.entity";
import {
  ActionSuite,
  loadedActionSuiteActions,
  parseActionSuite,
  type ParsedActionSuite,
} from "./entities/action-suite.entity";
import { Action, loadedActionEvents } from "./entities/action.entity";
import { GeneralUpdatesService } from "./general-updates.service";
import { assertPrerequisitesValid } from "./prerequisite-validation";

@Injectable()
export class ActionSuitesService {
  constructor(
    @InjectRepository(ActionEvent)
    private readonly actionEventRepository: Repository<ActionEvent>,
    @InjectRepository(ActionSuite)
    private readonly actionSuiteRepository: Repository<ActionSuite>,
    private readonly actionsService: ActionsService,
    private readonly participants: ActionParticipantsService,
    private readonly cohortDecisionStaffService: CohortDecisionStaffService,
    private readonly generalUpdates: GeneralUpdatesService,
  ) {}

  async addEvent(params: {
    actionId: number;
    event: CreateActionEventDto;
    userId?: number;
    acknowledgeDeadlineShortening: boolean;
  }): Promise<ActionEvent> {
    const { actionId, event, userId, acknowledgeDeadlineShortening } = params;
    const action = await this.actionsService.findOneOrFail({
      id: actionId,
      userId,
    });
    const [savedEvent] = await this.addEventToActions({
      actions: [action],
      event,
      acknowledgeDeadlineShortening,
    });
    return savedEvent;
  }

  private async addEventToActions(params: {
    actions: Action[];
    event: CreateActionEventDto;
    overrides?: Partial<ActionEvent>;
    suiteIds?: number[];
    acknowledgeDeadlineShortening: boolean;
  }): Promise<ActionEvent[]> {
    const { actions, event, overrides, suiteIds } = params;
    let saved: ActionEvent[];
    try {
      saved = await this.cohortDecisionStaffService.guardDeadlineShortening({
        actionIds: actions.map((action) => action.id),
        acknowledged: params.acknowledgeDeadlineShortening,
        change: async (manager) => {
          await assertLive(manager, {
            rows: actions.map((action) => ({ target: Action, id: action.id })),
            gone: () => new NotFoundException("Action not found"),
          });
          const events: ActionEvent[] = [];
          for (const action of actions) {
            const newEvent = manager.create(ActionEvent, {
              ...event,
              ...overrides,
              action,
            });
            events.push(await manager.save(newEvent));
          }
          await assertPrerequisitesValid({
            em: manager,
            actionIds: actions.map((action) => action.id),
          });
          return events;
        },
      });
    } catch (err) {
      if (
        err?.code === "23505" &&
        err?.constraint === "UQ_action_event_one_member_action"
      ) {
        throw new BadRequestException(
          "An action can only have one member_action event",
        );
      }
      throw err;
    }

    for (const action of actions) {
      await this.participants.reloadUsersJoinedForAction(action.id);
    }

    await this.generalUpdates.syncGeneralUpdateDatesForSuites(
      suiteIds ?? [
        ...new Set(
          actions.map((a) => a.suite?.id).filter((id) => id !== undefined),
        ),
      ],
    );

    return saved;
  }

  async findSuites(): Promise<ActionSuite[]> {
    return this.actionSuiteRepository.find();
  }

  async findSuite(id: number): Promise<ParsedActionSuite> {
    const suite = await this.actionSuiteRepository.findOneOrFail({
      where: { id },
      relations: {
        actions: { events: true, activities: true, reviewers: true },
        reminderGroups: { memberActionEvent: true, deadlineEvent: true },
        generalUpdates: { schemaSnapshot: true },
      },
      relationLoadStrategy: "query",
    });
    return parseActionSuite(suite);
  }

  async createSuite(
    createActionSuiteDto: CreateActionSuiteDto,
  ): Promise<ActionSuite> {
    const suite = this.actionSuiteRepository.create(createActionSuiteDto);
    const saved = await this.actionSuiteRepository.save(suite);
    await this.generalUpdates.syncGeneralUpdateDatesForSuites([suite.id]);
    return saved;
  }

  async batchUpdateSuiteEvents(params: {
    suiteId: number;
    eventId: number;
    body: UpdateActionEventDto;
    acknowledgeDeadlineShortening: boolean;
  }) {
    const { suiteId, eventId, body } = params;
    const event = await this.actionEventRepository.findOneOrFail({
      where: { id: eventId },
      relations: { action: { events: true } },
    });
    const suite = await this.actionSuiteRepository.findOneOrFail({
      where: { id: suiteId },
      relations: { actions: { events: true } },
    });
    const eventAction = loadedActionEventAction(event);
    const eventIdx = loadedActionEvents(eventAction)
      .sort((a, b) => a.date.getTime() - b.date.getTime())
      .findIndex((event) => event.id === eventId);
    const eventsToUpdate = new Set<number>([eventId]);

    const suiteActions = loadedActionSuiteActions(suite);
    for (const action of suiteActions) {
      const events = loadedActionEvents(action);
      if (events.length <= eventIdx) {
        throw new BadRequestException(
          "Events do not have equivalent events to edit",
        );
      }
      const possibleEvent = events.sort(
        (a, b) => a.date.getTime() - b.date.getTime(),
      )[eventIdx];
      if (
        possibleEvent.newStatus === event.newStatus &&
        possibleEvent.suiteManaged
      ) {
        eventsToUpdate.add(possibleEvent.id);
      }
    }

    const actionIds = [
      eventAction.id,
      ...suiteActions.map((action) => action.id),
    ];
    await this.cohortDecisionStaffService.guardDeadlineShortening({
      actionIds,
      acknowledged: params.acknowledgeDeadlineShortening,
      change: async (em) => {
        for (const id of eventsToUpdate) {
          await em.update(ActionEvent, id, body);
        }
        await assertPrerequisitesValid({ em, actionIds });
      },
    });
    await this.generalUpdates.syncGeneralUpdateDatesForSuites([suiteId]);
    return this.findSuite(suiteId);
  }

  async addSuiteEvent(params: {
    suiteId: number;
    event: CreateActionEventDto;
    acknowledgeDeadlineShortening: boolean;
  }) {
    const { suiteId, event, acknowledgeDeadlineShortening } = params;
    const suite = await this.actionSuiteRepository.findOneOrFail({
      where: { id: suiteId },
      relations: { actions: true },
    });

    await this.addEventToActions({
      actions: loadedActionSuiteActions(suite),
      event,
      overrides: { suiteManaged: true },
      suiteIds: [suiteId],
      acknowledgeDeadlineShortening,
    });
    return this.findSuite(suiteId);
  }

  async deleteSuiteEvent(suiteId: number, eventId: number) {
    const event = await this.actionEventRepository.findOneOrFail({
      where: { id: eventId },
      relations: { action: { events: true } },
    });
    const suite = await this.actionSuiteRepository.findOneOrFail({
      where: { id: suiteId },
      relations: { actions: { events: true } },
    });
    const eventIdx = loadedActionEvents(loadedActionEventAction(event))
      .sort((a, b) => a.date.getTime() - b.date.getTime())
      .findIndex((event) => event.id === eventId);

    const suiteActions = loadedActionSuiteActions(suite);
    await this.actionEventRepository.manager.transaction(async (em) => {
      for (const action of suiteActions) {
        const events = loadedActionEvents(action);
        if (events.length <= eventIdx) {
          throw new BadRequestException(
            "Events do not have equivalent events to delete",
          );
        }
        const possibleEvent = events.sort(
          (a, b) => a.date.getTime() - b.date.getTime(),
        )[eventIdx];
        if (
          possibleEvent.newStatus === event.newStatus &&
          possibleEvent.suiteManaged
        ) {
          console.log("deleting event", possibleEvent.id);
          await softDeleteCascade(em, {
            target: ActionEvent,
            ids: [possibleEvent.id],
          });
        }
      }
      await assertPrerequisitesValid({
        em,
        actionIds: suiteActions.map((action) => action.id),
      });
    });
    await this.generalUpdates.syncGeneralUpdateDatesForSuites([suiteId]);
    return this.findSuite(suiteId);
  }
}
