/**
 * KORA's v6 sign-up questionnaire (spec 6.0 "Demographics"). Every question is
 * optional; only gender and household income offer "prefer not to say", which
 * Annex D exports as that literal where the rest export an empty cell.
 */

export enum KoraAgeBand {
  Band18To29 = "18to29",
  Band30To39 = "30to39",
  Band40To49 = "40to49",
  Band50To59 = "50to59",
  Band60Plus = "60plus",
}

export enum KoraGender {
  Woman = "woman",
  Man = "man",
  Other = "other",
  PreferNotToSay = "prefer_not_to_say",
}

/** Asked only of reviewers who gave the United States as their country. */
export enum KoraUsRegion {
  Northeast = "northeast",
  Midwest = "midwest",
  South = "south",
  West = "west",
}

export enum KoraChildAgeBand {
  Under7 = "under7",
  Band7To9 = "7to9",
  Band10To12 = "10to12",
  Band13To17 = "13to17",
}

export enum KoraChildAiUse {
  Never = "never",
  Sometimes = "sometimes",
  Often = "often",
  DontKnow = "dont_know",
}

export enum KoraEducation {
  HighSchoolOrLess = "high_school_or_less",
  SomeCollege = "some_college",
  Bachelors = "bachelors",
  Graduate = "graduate",
}

export enum KoraHouseholdIncome {
  Under50k = "under_50k",
  From50kTo100k = "50k_to_100k",
  From100kTo150k = "100k_to_150k",
  Over150k = "over_150k",
  PreferNotToSay = "prefer_not_to_say",
}

/** The Alliance's addition: self-declared, and not an admission gate. */
export enum KoraEnglish {
  NativeOrBilingual = "native_or_bilingual",
  Fluent = "fluent",
  Comfortable = "comfortable",
  Basic = "basic",
}

export const KORA_UNITED_STATES = "US";

export const KORA_AGE_BAND_LABELS: Record<KoraAgeBand, string> = {
  [KoraAgeBand.Band18To29]: "18 to 29",
  [KoraAgeBand.Band30To39]: "30 to 39",
  [KoraAgeBand.Band40To49]: "40 to 49",
  [KoraAgeBand.Band50To59]: "50 to 59",
  [KoraAgeBand.Band60Plus]: "60 or over",
};

export const KORA_GENDER_LABELS: Record<KoraGender, string> = {
  [KoraGender.Woman]: "Woman",
  [KoraGender.Man]: "Man",
  [KoraGender.Other]: "Other",
  [KoraGender.PreferNotToSay]: "Prefer not to say",
};

export const KORA_US_REGION_LABELS: Record<KoraUsRegion, string> = {
  [KoraUsRegion.Northeast]: "Northeast",
  [KoraUsRegion.Midwest]: "Midwest",
  [KoraUsRegion.South]: "South",
  [KoraUsRegion.West]: "West",
};

export const KORA_CHILD_AGE_BAND_LABELS: Record<KoraChildAgeBand, string> = {
  [KoraChildAgeBand.Under7]: "Under 7",
  [KoraChildAgeBand.Band7To9]: "7 to 9",
  [KoraChildAgeBand.Band10To12]: "10 to 12",
  [KoraChildAgeBand.Band13To17]: "13 to 17",
};

export const KORA_CHILD_AI_USE_LABELS: Record<KoraChildAiUse, string> = {
  [KoraChildAiUse.Never]: "Never",
  [KoraChildAiUse.Sometimes]: "Sometimes",
  [KoraChildAiUse.Often]: "Often",
  [KoraChildAiUse.DontKnow]: "Don't know",
};

export const KORA_EDUCATION_LABELS: Record<KoraEducation, string> = {
  [KoraEducation.HighSchoolOrLess]: "High school or less",
  [KoraEducation.SomeCollege]: "Some college",
  [KoraEducation.Bachelors]: "Bachelor's degree",
  [KoraEducation.Graduate]: "Graduate degree",
};

export const KORA_HOUSEHOLD_INCOME_LABELS: Record<KoraHouseholdIncome, string> =
  {
    [KoraHouseholdIncome.Under50k]: "Under $50,000",
    [KoraHouseholdIncome.From50kTo100k]: "$50,000 to $100,000",
    [KoraHouseholdIncome.From100kTo150k]: "$100,000 to $150,000",
    [KoraHouseholdIncome.Over150k]: "Over $150,000",
    [KoraHouseholdIncome.PreferNotToSay]: "Prefer not to say",
  };

export const KORA_ENGLISH_LABELS: Record<KoraEnglish, string> = {
  [KoraEnglish.NativeOrBilingual]: "Native or bilingual",
  [KoraEnglish.Fluent]: "Fluent",
  [KoraEnglish.Comfortable]: "Comfortable",
  [KoraEnglish.Basic]: "Basic",
};
