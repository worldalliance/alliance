import { KoraProjectStatus, KoraReviewPhase } from "@alliance/common/kora";
import {
  KoraAgeBand,
  KoraChildAgeBand,
  KoraChildAiUse,
  KoraGender,
  KoraHouseholdIncome,
  KoraUsRegion,
} from "@alliance/common/kora-demographics";
import { KoraBatch } from "src/kora/entities/kora-batch.entity";
import { KoraReviewer } from "src/kora/entities/kora-reviewer.entity";
import { closeTestApp } from "./e2e-test-utils";
import {
  koraHarness,
  ORIGIN,
  setKoraProjectStatus,
  type KoraHarness,
} from "./kora-fixtures";
import { koraReviewClient } from "./kora-review-fixtures";
import { forgetRateEvents } from "./otp-fixtures";

describe("Kora sign-up screens (e2e)", () => {
  let h: KoraHarness;

  const { more, onboard, onboarding, participant, state, upload } =
    koraReviewClient(() => h);

  beforeAll(async () => {
    h = await koraHarness();
  }, 50000);

  beforeEach(async () => {
    await forgetRateEvents(h.ctx);
    await h.ctx.dataSource.getRepository(KoraReviewer).deleteAll();
    await h.ctx.dataSource.getRepository(KoraBatch).deleteAll();
    await setKoraProjectStatus(h.ctx, KoraProjectStatus.Active);
  });

  afterAll(async () => {
    await closeTestApp(h.ctx.app);
  });

  it("serves no session until the reviewer has consented and passed the screens", async () => {
    await upload(4);
    const browser = await participant({ signedUpOnly: true });

    const before = await state(browser);
    expect(before.phase).toBe(KoraReviewPhase.Onboarding);
    expect(before.session).toBeUndefined();
    expect(before.onboarding).toEqual({
      demographics: null,
      consentAt: null,
      onboardedAt: null,
    });
    expect((await more(browser)).phase).toBe(KoraReviewPhase.Onboarding);

    await onboarding(browser, { consented: true });
    expect((await state(browser)).phase).toBe(KoraReviewPhase.Onboarding);

    await onboarding(browser, { onboarded: true });
    const after = await state(browser);
    expect(after.phase).toBe(KoraReviewPhase.Reviewing);
    expect(after.session?.items).toHaveLength(1);
  });

  it("keeps a skipped question apart from one answered 'prefer not to say'", async () => {
    const browser = await participant({ signedUpOnly: true });
    const saved = await onboarding(browser, {
      demographics: {
        ageBand: null,
        gender: KoraGender.PreferNotToSay,
        country: "FR",
        usRegion: null,
        isParent: false,
        childrenAgeBands: [],
        childAiUse: null,
        worksWithChildrenOrHealth: true,
        education: null,
        householdIncome: KoraHouseholdIncome.PreferNotToSay,
        english: null,
      },
    });
    expect(saved.demographics).toMatchObject({
      ageBand: null,
      gender: KoraGender.PreferNotToSay,
      householdIncome: KoraHouseholdIncome.PreferNotToSay,
    });
    expect((await state(browser)).onboarding.demographics).toMatchObject({
      country: "FR",
      worksWithChildrenOrHealth: true,
    });
  });

  it("drops the answers that no longer follow: a region without the US, children without a parent", async () => {
    const browser = await participant({ signedUpOnly: true });
    const saved = await onboarding(browser, {
      demographics: {
        ageBand: KoraAgeBand.Band30To39,
        gender: null,
        country: "CA",
        usRegion: KoraUsRegion.West,
        isParent: false,
        childrenAgeBands: [KoraChildAgeBand.Band7To9],
        childAiUse: KoraChildAiUse.Often,
        worksWithChildrenOrHealth: null,
        education: null,
        householdIncome: null,
        english: null,
      },
    });
    expect(saved.demographics).toMatchObject({
      ageBand: KoraAgeBand.Band30To39,
      usRegion: null,
      childrenAgeBands: [],
      childAiUse: null,
    });
  });

  it("takes consent once and never takes it back", async () => {
    const browser = await participant({ signedUpOnly: true });
    const first = await onboarding(browser, { consented: true });
    expect(first.consentAt).not.toBeNull();

    await browser
      .patch("/kora/review/onboarding")
      .set("Origin", ORIGIN)
      .send({ consented: false })
      .expect(400);

    const again = await onboard(browser);
    expect(again.consentAt).toBe(first.consentAt);
  });
});
