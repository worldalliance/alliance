import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { throwIfSlugTaken } from "src/datasources/slug-column";
import {
  softDeleteWhere,
  updateLive,
  writeUnderLive,
} from "src/datasources/soft-delete";
import { Form } from "src/tasks/entities/form.entity";
import { User } from "src/user/entities/user.entity";
import { DeepPartial, type EntityManager, type Repository } from "typeorm";
import { UserService } from "../user/user.service";
import { ActionFormLinksService } from "./action-form-links.service";
import { dropEchoedImages, rewriteRenderedImages } from "./action-image-input";
import { replaceReviewers } from "./action-reviewers";
import { ActionsService } from "./actions.service";
import { CohortDecisionStaffService } from "./cohort-decision-staff.service";
import {
  assertNotInACohort,
  parseCohortExpressionForSaveOrThrow,
} from "./cohort-reference-validation";
import { ActionReviewerDto } from "./dto/action-reviewer.dto";
import { CreateActionDto, UpdateActionDto } from "./dto/action.dto";
import { ActionReviewer } from "./entities/action-reviewer.entity";
import { ActionSuite } from "./entities/action-suite.entity";
import {
  Action,
  ACTION_SLUG_INDEX,
  parseAction,
  type ParsedAction,
} from "./entities/action.entity";
import { FormSlugSequence, slugFormForAction } from "./form-slug";
import { GeneralUpdatesService } from "./general-updates.service";
import {
  assertNotAPrerequisite,
  assertPrerequisitesValid,
} from "./prerequisite-validation";
import { shiftPrioritiesAfterInsertion } from "./priority-order";
import { renameSoleActionSuite } from "./sole-action-suite";
import { SuiteSplitsService } from "./suite-splits.service";

const ACTION_PARENT_GONE = "That suite, author or form is gone";

@Injectable()
export class ActionMutationsService {
  private readonly logger = new Logger(ActionMutationsService.name);

  constructor(
    @InjectRepository(Action)
    private readonly actionRepository: Repository<Action>,
    @InjectRepository(ActionReviewer)
    private readonly actionReviewerRepository: Repository<ActionReviewer>,
    private readonly userService: UserService,
    private readonly actionsService: ActionsService,
    private readonly cohortDecisionStaffService: CohortDecisionStaffService,
    private readonly generalUpdates: GeneralUpdatesService,
    private readonly formLinks: ActionFormLinksService,
    private readonly suiteSplits: SuiteSplitsService,
  ) {}

  /** Reviewers are ordered by the position the admin sent them in. */
  private reviewerRows(reviewers: ActionReviewerDto[]): ActionReviewer[] {
    return reviewers.map((reviewer, position) =>
      this.actionReviewerRepository.create({
        name: reviewer.name,
        url: reviewer.url ?? null,
        icon: reviewer.icon ?? null,
        position,
      }),
    );
  }

  async create(createActionDto: CreateActionDto): Promise<ParsedAction> {
    const saved = await this.insertAction(
      this.actionRepository.manager,
      createActionDto,
    );
    await this.afterActionInserted(saved);
    return parseAction(Object.assign(saved, { splitArms: [] }));
  }

  /** Joins `em`'s transaction when one is active; then call `afterActionInserted`. */
  async insertAction(
    em: EntityManager,
    createActionDto: CreateActionDto,
  ): Promise<Action> {
    const { suiteId, authorIds, reviewers, ...rest } = createActionDto;
    rewriteRenderedImages(rest, this.logger);
    if (rest.cohortExpression != null) {
      rest.cohortExpression = await parseCohortExpressionForSaveOrThrow({
        em: this.actionRepository.manager,
        value: rest.cohortExpression,
      });
    }
    if (rest.taskFormId != null) {
      await this.formLinks.assertFormIdNotUsedAsVariant(rest.taskFormId);
    }
    const action = this.actionRepository.create(rest);
    action.reviewers = this.reviewerRows(reviewers ?? []);
    action.followUpForms = [];
    action.events = [];

    if (suiteId) {
      const suite = await em.findOneOrFail(ActionSuite, {
        where: { id: suiteId },
      });
      action.suite = suite;
    }

    if (authorIds !== undefined) {
      action.authors = authorIds.length
        ? await this.userService.findByIds(authorIds)
        : [];
    }

    return writeUnderLive(em, {
      parents: [
        ...(action.suite ? [{ target: ActionSuite, id: action.suite.id }] : []),
        ...(action.authors ?? []).map(({ id }) => ({ target: User, id })),
        ...(rest.taskFormId == null
          ? []
          : [{ target: Form, id: rest.taskFormId }]),
      ],
      notFound: ACTION_PARENT_GONE,
      write: async (em) => {
        const inserted = await em.save(Action, action);
        await assertPrerequisitesValid({ em, actionIds: [inserted.id] });
        if (rest.taskFormId != null) {
          await slugFormForAction(em, {
            formId: rest.taskFormId,
            actionId: inserted.id,
            sequence: FormSlugSequence.Main,
          });
        }
        return inserted;
      },
    }).catch((error: unknown) => {
      throwIfSlugTaken({
        error,
        indexName: ACTION_SLUG_INDEX,
        slug: rest.slug,
      });
      throw error;
    });
  }

  async afterActionInserted(saved: Action): Promise<void> {
    await shiftPrioritiesAfterInsertion(this.actionRepository.manager);
    await this.generalUpdates.syncGeneralUpdateDatesForSuites([
      saved.suite?.id,
    ]);
  }

  async update(
    id: number,
    updateActionDto: UpdateActionDto,
    userId: number,
  ): Promise<ParsedAction> {
    const action: DeepPartial<Action> | null =
      await this.actionRepository.findOne({
        where: { id },
        relations: {
          authors: true,
          suite: true,
        },
      });

    if (!action) {
      throw new NotFoundException("Action not found");
    }
    const oldSuiteId = action.suite?.id;

    const { suiteId, authorIds, reviewers, ...rest } = updateActionDto;
    dropEchoedImages({ next: rest, stored: action, logger: this.logger });
    if (rest.cohortExpression != null) {
      rest.cohortExpression = await parseCohortExpressionForSaveOrThrow({
        em: this.actionRepository.manager,
        value: rest.cohortExpression,
        stored: action.cohortExpression,
      });
    }

    if (
      rest.optional === false &&
      action.optional === true &&
      (await this.cohortDecisionStaffService.hasDecisions(id))
    ) {
      throw new BadRequestException(
        "Optional can't change to mandatory once members have cohort decisions for this action.",
      );
    }

    await this.suiteSplits.assertArmEditAllowed(id, {
      stored: { ...action, suiteId: oldSuiteId },
      next: { ...rest, suiteId },
    });

    if (rest.taskFormId != null && rest.taskFormId !== action.taskFormId) {
      await this.formLinks.assertFormIdNotUsedAsVariant(rest.taskFormId);
    }

    action.suite = {
      id: suiteId ?? undefined,
    };

    if (authorIds !== undefined) {
      action.authors = authorIds.length
        ? await this.userService.findByIds(authorIds)
        : [];
    }

    const previousTaskFormId = action.taskFormId;
    const newName = rest.name === action.name ? undefined : rest.name;
    Object.assign(action, rest);

    // Replacing reviewers soft-deletes the dropped ones before the save;
    // without one transaction a failed save still drops them.
    await writeUnderLive(this.actionRepository.manager, {
      parents: [
        ...(suiteId == null ? [] : [{ target: ActionSuite, id: suiteId }]),
        ...(action.authors ?? []).flatMap((author) =>
          author.id === undefined ? [] : [{ target: User, id: author.id }],
        ),
        ...(rest.taskFormId == null || rest.taskFormId === previousTaskFormId
          ? []
          : [{ target: Form, id: rest.taskFormId }]),
      ],
      notFound: ACTION_PARENT_GONE,
      saved: {
        target: Action,
        id,
        notFound: "Action not found",
      },
      write: async (em) => {
        if (reviewers !== undefined) {
          action.reviewers = await replaceReviewers({
            em,
            actionId: id,
            rows: this.reviewerRows(reviewers),
          });
        }
        await em.save(Action, action);
        if (newName !== undefined && suiteId != null) {
          await renameSoleActionSuite(em, {
            suiteId,
            actionId: id,
            name: newName,
          });
        }
        if (rest.prerequisiteActionIds !== undefined) {
          await assertPrerequisitesValid({ em, actionIds: [id] });
        }
        if (rest.taskFormId != null && rest.taskFormId !== previousTaskFormId) {
          await slugFormForAction(em, {
            formId: rest.taskFormId,
            actionId: id,
            sequence: FormSlugSequence.Main,
          });
        }
      },
    }).catch((error: unknown) => {
      throwIfSlugTaken({
        error,
        indexName: ACTION_SLUG_INDEX,
        slug: rest.slug,
      });
      throw error;
    });
    const newSuiteId = action.suite?.id;
    await this.generalUpdates.syncGeneralUpdateDatesForSuites([
      oldSuiteId,
      newSuiteId,
    ]);

    return this.actionsService.findOneOrFail({ id, userId });
  }

  async remove(id: number) {
    const action = await this.actionRepository.findOne({
      where: { id },
      relations: { suite: true },
    });
    await this.suiteSplits.assertNotAnArm(id);
    await this.actionRepository.manager.transaction(async (em) => {
      await softDeleteWhere(em, { target: Action, where: { id } });
      await assertNotAPrerequisite({ em, actionId: id });
      await assertNotInACohort({ em, actionId: id });
    });
    await this.generalUpdates.syncGeneralUpdateDatesForSuites([
      action?.suite?.id,
    ]);
  }

  archive(id: number): Promise<ParsedAction> {
    return this.setArchived({ id, archived: true });
  }

  unarchive(id: number): Promise<ParsedAction> {
    return this.setArchived({ id, archived: false });
  }

  // updateLive() rather than save(): saving the loaded action would also diff
  // its relations, unlinking any follow-up form added since the load.
  private async setArchived(params: {
    id: number;
    archived: boolean;
  }): Promise<ParsedAction> {
    const { id, archived } = params;
    await updateLive(this.actionRepository.manager, {
      target: Action,
      id,
      changes: { archived },
      notFound: "Action not found",
    });
    return parseAction(
      await this.actionRepository.findOneOrFail({
        where: { id },
        relations: { reviewers: true, events: true, followUpForms: true },
      }),
    );
  }
}
