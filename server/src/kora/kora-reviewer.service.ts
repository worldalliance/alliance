import { KORA_UNITED_STATES } from "@alliance/common/kora-demographics";
import { Injectable } from "@nestjs/common";
import { DataSource } from "typeorm";
import {
  type KoraDemographics,
  KoraReviewer,
  type ParsedKoraReviewer,
  parseKoraReviewer,
} from "./entities/kora-reviewer.entity";

export type KoraIdentity = { participantId: string } | { userId: number };

export type KoraPreferences = {
  optOutRisks: string[];
  extendedOptIn: boolean;
};

/**
 * Annex D's invariants, held by the data rather than by the form: a region
 * belongs to the United States, and children's answers to a parent.
 */
const answersThatFollow = (given: KoraDemographics): KoraDemographics => ({
  ...given,
  usRegion: given.country === KORA_UNITED_STATES ? given.usRegion : null,
  childrenAgeBands: given.isParent ? given.childrenAgeBands : [],
  childAiUse: given.isParent ? given.childAiUse : null,
});

export type KoraOnboarding = {
  demographics: KoraDemographics | null;
  consentAt: Date | null;
  onboardedAt: Date | null;
};

@Injectable()
export class KoraReviewerService {
  constructor(private readonly dataSource: DataSource) {}

  /** The reviewer behind an identity, created on first sight. */
  async reviewerFor(identity: KoraIdentity): Promise<ParsedKoraReviewer> {
    const manager = this.dataSource.manager;
    await manager
      .createQueryBuilder()
      .insert()
      .into(KoraReviewer)
      // A copy, because the insert writes the generated columns back into it.
      .values({ ...identity })
      .orIgnore()
      .execute();
    return parseKoraReviewer(
      await manager.findOneByOrFail(KoraReviewer, identity),
    );
  }

  async preferences(params: {
    identity: KoraIdentity;
    optOutRisks?: string[];
    extendedOptIn?: boolean;
  }): Promise<KoraPreferences> {
    const reviewer = await this.reviewerFor(params.identity);
    await this.dataSource.manager.update(
      KoraReviewer,
      { id: reviewer.id },
      {
        ...(params.optOutRisks !== undefined && {
          optOutCategories: params.optOutRisks,
        }),
        ...(params.extendedOptIn !== undefined && {
          extendedOptIn: params.extendedOptIn,
        }),
      },
    );
    const saved = await this.reviewerFor(params.identity);
    return {
      optOutRisks: saved.optOutCategories,
      extendedOptIn: saved.extendedOptIn,
    };
  }

  /**
   * The sign-up screens, each saved as the reviewer passes it so leaving part
   * way resumes where they left. Consent is only ever granted, never withdrawn
   * here: withdrawal deletes the account (spec 6.0 Annex A3).
   */
  async onboarding(params: {
    identity: KoraIdentity;
    demographics?: KoraDemographics;
    consented?: true;
    onboarded?: true;
  }): Promise<KoraOnboarding> {
    const reviewer = await this.reviewerFor(params.identity);
    const now = new Date();
    await this.dataSource.manager.update(
      KoraReviewer,
      { id: reviewer.id },
      {
        ...(params.demographics !== undefined && {
          demographics: answersThatFollow(params.demographics),
        }),
        ...(params.consented && !reviewer.consentAt && { consentAt: now }),
        ...(params.onboarded && !reviewer.onboardedAt && { onboardedAt: now }),
      },
    );
    const saved = await this.reviewerFor(params.identity);
    return {
      demographics: saved.demographics,
      consentAt: saved.consentAt,
      onboardedAt: saved.onboardedAt,
    };
  }
}
