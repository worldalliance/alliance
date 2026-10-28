import { Assert } from "@alliance/common/types";
import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { writeUnderLive } from "src/datasources/soft-delete";
import { ReminderGroupService } from "src/notifs/reminder-group.service";
import { Form } from "src/tasks/entities/form.entity";
import { User } from "src/user/entities/user.entity";
import type { IsRelation, Relations } from "src/utils/Repository";
import { type Repository } from "typeorm";
import { parseCohortExpressionForSaveOrThrow } from "./cohort-reference-validation";
import { ExportActionDto } from "./dto/action.dto";
import { ActionEvent } from "./entities/action-event.entity";
import { ActionReviewer } from "./entities/action-reviewer.entity";
import { ActionSuite } from "./entities/action-suite.entity";
import {
  Action,
  CustomActionStat,
  parseAction,
  type ParsedAction,
} from "./entities/action.entity";
import { GeneralUpdatesService } from "./general-updates.service";

@Injectable()
export class ActionImportExportService {
  constructor(
    @InjectRepository(Action)
    private readonly actionRepository: Repository<Action>,
    @InjectRepository(Form)
    private readonly formRepository: Repository<Form>,
    private readonly reminderGroupService: ReminderGroupService,
    private readonly generalUpdates: GeneralUpdatesService,
  ) {}

  async exportAction(
    id: number,
    events?: boolean,
    reminders?: boolean,
    taskForm?: boolean,
    suite?: boolean,
  ): Promise<ExportActionDto> {
    const relations: Relations<Action> = {
      authors: true,
      events: events || undefined,
      suite: suite || undefined,
      reviewers: true,
    };

    const action = await this.actionRepository.findOneOrFail({
      where: { id },
      relations,
    });

    const taskFormEntity = taskForm
      ? await this.formRepository.findOneOrFail({
          where: { id: action.taskFormId },
          relations: { formSnapshot: true },
        })
      : undefined;

    const reminderGroups = reminders
      ? await this.reminderGroupService.getReminderGroupsForEvent(action.id)
      : undefined;

    return new ExportActionDto(action, {
      taskForm: taskFormEntity,
      reminderGroups,
    });
  }

  async importAction(json: string): Promise<ParsedAction> {
    const importaction = JSON.parse(json) as ExportActionDto;

    const {
      taskForm,
      reminderGroups: _reminderGroups,
      suite,
      events,
      activities: _activities,
      authors,
      updates: _updates,
      followUpForms: _followUpForms,
      reviewers,
      project: _project,
      // Action ids name different actions in another environment.
      prerequisiteActionIds: _prerequisiteActionIds,
      ...actionCols
    } = importaction;

    // typecheck to ensure that we don't override any relations in prod
    type _actionCols_relations = {
      [K in keyof typeof actionCols as K extends keyof Action
        ? K
        : never]: IsRelation<(typeof actionCols)[K]> extends true
        ? K
        : undefined;
    }[keyof typeof actionCols];
    type _ensure_ImportActionDto_noRelations = Assert<
      _actionCols_relations extends undefined ? true : false
    >;

    const cohortExpression =
      actionCols.cohortExpression == null
        ? undefined
        : await parseCohortExpressionForSaveOrThrow({
            em: this.actionRepository.manager,
            value: actionCols.cohortExpression,
          });

    let suiteIdToSync: number | undefined;
    const result = await this.actionRepository.manager.transaction(
      async (em) => {
        const actionRepo = em.getRepository(Action);
        const suiteRepo = em.getRepository(ActionSuite);
        const formRepo = em.getRepository(Form);
        const eventRepo = em.getRepository(ActionEvent);

        const inserted = await actionRepo.insert({
          ...actionCols,
          // Exports taken before the column was NOT NULL can carry null.
          customStatType: actionCols.customStatType ?? CustomActionStat.NONE,
          // Exports taken before blank thumbnails were cleared can carry one.
          squareThumbnailImage: actionCols.squareThumbnailImage?.trim() || null,
          cohortExpression,
          id: undefined,
        });

        const actionId = inserted.identifiers[0].id as number;

        if (reviewers?.length) {
          await em.getRepository(ActionReviewer).insert(
            [...reviewers]
              .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
              .map((reviewer, position) => ({
                name: reviewer.name,
                url: reviewer.url ?? null,
                icon: reviewer.icon ?? null,
                position,
                actionId,
              })),
          );
        }

        if (suite) {
          let foundSuite = await suiteRepo.findOne({
            where: { name: suite.name },
            lock: { mode: "for_key_share" },
          });
          if (!foundSuite) {
            foundSuite = await suiteRepo.save(
              suiteRepo.create({ name: suite.name }),
            );
          }
          await actionRepo.update(actionId, { suite: { id: foundSuite.id } });
          suiteIdToSync = foundSuite.id;
        }

        if (authors?.length) {
          await writeUnderLive(em, {
            parents: authors.map((a) => ({ target: User, id: a.id })),
            notFound: "That author is gone",
            write: () =>
              actionRepo
                .createQueryBuilder()
                .relation(Action, "authors")
                .of(actionId)
                .add(authors.map((a) => ({ id: a.id }))),
          });
        }

        if (taskForm) {
          const newTaskForm = await formRepo.save(
            formRepo.create({ ...taskForm, id: undefined }),
          );
          await actionRepo.update(actionId, { taskFormId: newTaskForm.id });
        }

        if (events?.length) {
          await eventRepo.insert(
            events.map((e) => ({
              ...e,
              updates: undefined,
              id: undefined,
              action: { id: actionId },
            })),
          );
        }

        return actionRepo.findOneOrFail({
          where: { id: actionId },
          relations: { reviewers: true, events: true, followUpForms: true },
        });
      },
    );
    await this.generalUpdates.syncGeneralUpdateDatesForSuites([suiteIdToSync]);
    return parseAction(result);
  }
}
