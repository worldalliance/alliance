import {
  collectSourceFormIds,
  forEachCondition,
  memberConditions,
} from "@alliance/common/forms/form-conditions";
import type { FormSchema } from "@alliance/common/forms/form-schema";
import {
  type ConditionExtras,
  evaluateCondition,
} from "@alliance/common/forms/visibility";
import {
  type AccountDerivedConditionKind,
  isAccountDerivedConditionKind,
  isDraftValidatorId,
} from "@alliance/common/forms/visible-if-formula";
import { R, type Result } from "@alliance/common/result";
import { Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { User } from "src/user/entities/user.entity";
import { UserVisibilityContextService } from "src/user/user-visibility-context.service";
import { In, type Repository } from "typeorm";
import { CustomValidatorService } from "./customvalidator.service";
import type { CustomValidator } from "./entities/customvalidator.entity";
import { FormResponse } from "./entities/formresponse.entity";
import type { VisibilityProfile } from "./member-visibility.dto";

export type MemberVisibilityExtras = Omit<ConditionExtras, "deviceType"> & {
  visibilityValidatorResults: Record<number, boolean>;
};

const PROFILE_CONCURRENCY = 10;

function conditionInputs(schema: FormSchema) {
  const validatorIds = new Set<number>();
  const accountConditionKinds = new Set<AccountDerivedConditionKind>();
  forEachCondition(schema, (condition) => {
    if (condition.kind === "validator") {
      validatorIds.add(condition.validatorId);
    }
    if (isAccountDerivedConditionKind(condition.kind)) {
      accountConditionKinds.add(condition.kind);
    }
  });
  return { validatorIds, accountConditionKinds };
}

@Injectable()
export class MemberVisibilityService {
  private readonly logger = new Logger(MemberVisibilityService.name);
  constructor(
    private readonly customValidatorService: CustomValidatorService,
    @InjectRepository(FormResponse)
    private formResponseRepository: Repository<FormResponse>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private readonly userVisibilityContextService: UserVisibilityContextService,
  ) {}

  async memberExtras(params: {
    schema: FormSchema;
    userId: number;
    /** Validators already logged as failing, so a batch logs each once. */
    loggedFailures?: Set<number>;
    /** Fail a builder's unsaved validator, whose id is a negative placeholder,
     * without looking it up. Elsewhere one is looked up, logged as missing,
     * and fails, since a stored schema shouldn't hold one. */
    skipUnsavedValidators?: boolean;
    /** The schema's validators, loaded once for a batch of members. */
    validators?: ReadonlyMap<number, CustomValidator>;
  }): Promise<MemberVisibilityExtras> {
    const {
      schema,
      userId,
      loggedFailures = new Set<number>(),
      skipUnsavedValidators = false,
    } = params;
    const { validatorIds, accountConditionKinds } = conditionInputs(schema);
    const runIds = [...validatorIds].filter(
      (validatorId) =>
        !(skipUnsavedValidators && isDraftValidatorId(validatorId)),
    );
    const validators =
      params.validators ??
      (await this.customValidatorService.findValidators(runIds));
    let user: Promise<User> | undefined;

    const validatorResults: Record<number, boolean> = Object.fromEntries(
      await Promise.all(
        Array.from(validatorIds).map(async (validatorId) => {
          if (skipUnsavedValidators && isDraftValidatorId(validatorId)) {
            return [validatorId, false] as const;
          }
          try {
            const validator = validators.get(validatorId);
            if (!validator) {
              throw new Error(`No custom validator has id ${validatorId}`);
            }
            user ??= this.customValidatorService.validatedUser(userId);
            const result = await this.customValidatorService.checkValidator({
              validator,
              user: await user,
            });
            return [validatorId, result.isValid] as const;
          } catch (error) {
            if (!loggedFailures.has(validatorId)) {
              loggedFailures.add(validatorId);
              this.logger.error(
                `Failed to evaluate visibility validator ${validatorId}: ${String(error)}`,
              );
            }
            return [validatorId, false] as const;
          }
        }),
      ),
    );

    const previousAnswerData: Record<number, Record<string, unknown>> = {};
    const entries = await Promise.all(
      collectSourceFormIds(schema).map(async (formId) => {
        const response = await this.formResponseRepository.findOne({
          where: { formId, user: { id: userId } },
          order: { createdAt: "DESC" },
        });
        return response?.answers ? ([formId, response.answers] as const) : null;
      }),
    );
    for (const entry of entries) {
      if (entry) previousAnswerData[entry[0]] = entry[1];
    }
    // Fetches only the values this schema's conditions actually read.
    const visibilityContext =
      await this.userVisibilityContextService.getVisibilityContext(
        userId,
        accountConditionKinds,
      );

    return {
      visibilityValidatorResults: validatorResults,
      previousAnswerData:
        Object.keys(previousAnswerData).length > 0
          ? previousAnswerData
          : undefined,
      userHasCity: visibilityContext.userHasCity,
      userPropertyHasValue: visibilityContext.userPropertyHasValue,
      firstContractSignedAt:
        visibilityContext.firstContractSignedAt?.toISOString() ?? null,
      completedActionCount: visibilityContext.completedActionCount,
    };
  }

  /**
   * `userIds` grouped by the verdict of each of the schema's
   * `memberConditions`, in that order, largest group first. Fails with the
   * ids that match no user.
   */
  async profiles(params: {
    schema: FormSchema;
    userIds: number[];
  }): Promise<Result<VisibilityProfile[], { unknownUserIds: number[] }>> {
    const { schema } = params;
    const userIds = [...new Set(params.userIds)];
    const known = new Set(
      (
        await this.userRepository.find({
          select: { id: true },
          where: { id: In(userIds) },
        })
      ).map((user) => user.id),
    );
    const unknownUserIds = userIds.filter((userId) => !known.has(userId));
    if (unknownUserIds.length > 0) return R.failure({ unknownUserIds });
    const conditions = memberConditions(schema);
    const savedValidatorIds = [...conditionInputs(schema).validatorIds].filter(
      (validatorId) => !isDraftValidatorId(validatorId),
    );
    const validators =
      await this.customValidatorService.findValidators(savedValidatorIds);
    const groups = new Map<string, VisibilityProfile>();
    const loggedFailures = new Set<number>();
    for (let start = 0; start < userIds.length; start += PROFILE_CONCURRENCY) {
      const batch = userIds.slice(start, start + PROFILE_CONCURRENCY);
      const verdicts = await Promise.all(
        batch.map(async (userId) => {
          const extras: ConditionExtras = {
            ...(await this.memberExtras({
              schema,
              userId,
              loggedFailures,
              skipUnsavedValidators: true,
              validators,
            })),
            deviceType: "desktop",
          };
          return conditions.map((condition) =>
            evaluateCondition(condition, {}, extras),
          );
        }),
      );
      batch.forEach((userId, index) => {
        const results = verdicts[index];
        const key = results.join(",");
        const group = groups.get(key) ?? { results, userIds: [] };
        group.userIds.push(userId);
        groups.set(key, group);
      });
    }
    return R.success(
      [...groups.values()].sort((a, b) => b.userIds.length - a.userIds.length),
    );
  }
}
