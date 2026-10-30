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
} from "@alliance/common/forms/visible-if-formula";
import { Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { UserVisibilityContextService } from "src/user/user-visibility-context.service";
import { type Repository } from "typeorm";
import { CustomValidatorService } from "./customvalidator.service";
import { FormResponse } from "./entities/formresponse.entity";

export type MemberVisibilityExtras = Omit<ConditionExtras, "deviceType"> & {
  visibilityValidatorResults: Record<number, boolean>;
};

export type VisibilityProfile = { results: boolean[]; userIds: number[] };

const PROFILE_CONCURRENCY = 10;

@Injectable()
export class MemberVisibilityService {
  private readonly logger = new Logger(MemberVisibilityService.name);
  constructor(
    private readonly customValidatorService: CustomValidatorService,
    @InjectRepository(FormResponse)
    private formResponseRepository: Repository<FormResponse>,
    private readonly userVisibilityContextService: UserVisibilityContextService,
  ) {}

  async memberExtras(params: {
    schema: FormSchema;
    userId: number;
  }): Promise<MemberVisibilityExtras> {
    const { schema, userId } = params;
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

    const validatorResults: Record<number, boolean> = Object.fromEntries(
      await Promise.all(
        Array.from(validatorIds).map(async (validatorId) => {
          try {
            const result = await this.customValidatorService.runValidator(
              validatorId,
              userId,
            );
            return [validatorId, result.isValid] as const;
          } catch (error) {
            this.logger.error(
              `Failed to evaluate visibility validator ${validatorId}: ${String(error)}`,
            );
            return [validatorId, false] as const;
          }
        }),
      ),
    );

    const previousAnswerData: Record<number, Record<string, unknown>> = {};
    const entries = await Promise.all(
      collectSourceFormIds(schema).map(async (formId) => {
        try {
          const response = await this.formResponseRepository.findOne({
            where: { formId, user: { id: userId } },
            order: { createdAt: "DESC" },
          });
          if (response?.answers) {
            return [formId, response.answers] as const;
          }
        } catch {
          // form response not found
        }
        return null;
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
   * `memberConditions`, in that order, largest group first.
   */
  async profiles(params: {
    schema: FormSchema;
    userIds: number[];
  }): Promise<VisibilityProfile[]> {
    const { schema } = params;
    const userIds = [...new Set(params.userIds)];
    const conditions = memberConditions(schema);
    const groups = new Map<string, VisibilityProfile>();
    for (let start = 0; start < userIds.length; start += PROFILE_CONCURRENCY) {
      const batch = userIds.slice(start, start + PROFILE_CONCURRENCY);
      const verdicts = await Promise.all(
        batch.map(async (userId) => {
          const extras: ConditionExtras = {
            ...(await this.memberExtras({ schema, userId })),
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
    return [...groups.values()].sort(
      (a, b) => b.userIds.length - a.userIds.length,
    );
  }
}
