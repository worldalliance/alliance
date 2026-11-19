import {
  KORA_AGE_BAND_LABELS,
  KORA_CHILD_AGE_BAND_LABELS,
  KORA_CHILD_AI_USE_LABELS,
  KORA_EDUCATION_LABELS,
  KORA_ENGLISH_LABELS,
  KORA_GENDER_LABELS,
  KORA_HOUSEHOLD_INCOME_LABELS,
  KORA_UNITED_STATES,
  KORA_US_REGION_LABELS,
} from "@alliance/common/kora-demographics";
import { PHONE_COUNTRIES } from "@alliance/common/phone-countries";
import type {
  KoraAgeBand,
  KoraChildAgeBand,
  KoraChildAiUse,
  KoraDemographicsDto,
  KoraEducation,
  KoraEnglish,
  KoraGender,
  KoraHouseholdIncome,
  KoraUsRegion,
} from "@alliance/shared/client";
import { useId, type ReactNode } from "react";
import { PROJECT_FIELD } from "../fieldStyles";
import { ONBOARDING_COPY } from "./copy";

export const EMPTY_DEMOGRAPHICS: KoraDemographicsDto = {
  ageBand: null,
  gender: null,
  country: null,
  usRegion: null,
  isParent: null,
  childrenAgeBands: [],
  childAiUse: null,
  worksWithChildrenOrHealth: null,
  education: null,
  householdIncome: null,
  english: null,
};

type Option<T> = { value: T; label: string };

// `Object.keys` widens the keys to `string`; the parameter type is what keeps
// the restated key honest.
const optionsOf = <T extends string>(labels: Record<T, string>): Option<T>[] =>
  (Object.keys(labels) as T[]).map((value) => ({
    value,
    label: labels[value],
  }));

const OPTION =
  "flex cursor-pointer items-center gap-3 rounded border border-zinc-300 bg-white px-4 py-3 text-left hover:border-zinc-500 has-checked:border-[var(--site-primary)] has-checked:bg-zinc-50";

function Question({ label, children }: { label: string; children: ReactNode }) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="pb-2 font-medium">{label}</legend>
      {children}
    </fieldset>
  );
}

function Choice<T extends string>({
  label,
  name,
  options,
  value,
  onChange,
}: {
  label: string;
  name: string;
  options: Option<T>[];
  value: T | null;
  onChange: (value: T | null) => void;
}) {
  return (
    <Question label={label}>
      <div className="grid gap-2 sm:grid-cols-2">
        {options.map((option) => (
          <label key={option.value} className={OPTION}>
            <input
              type="radio"
              name={name}
              checked={value === option.value}
              onChange={() => onChange(option.value)}
            />
            <span>{option.label}</span>
          </label>
        ))}
      </div>
      {value !== null && (
        <button
          type="button"
          className="self-start text-sm font-medium text-zinc-600 underline underline-offset-2"
          onClick={() => onChange(null)}
        >
          {ONBOARDING_COPY.clear}
        </button>
      )}
    </Question>
  );
}

const YES_NO: Option<"yes" | "no">[] = [
  { value: "yes", label: ONBOARDING_COPY.yes },
  { value: "no", label: ONBOARDING_COPY.no },
];

function YesNo({
  label,
  name,
  value,
  onChange,
}: {
  label: string;
  name: string;
  value: boolean | null;
  onChange: (value: boolean | null) => void;
}) {
  return (
    <Choice
      label={label}
      name={name}
      options={YES_NO}
      value={value === null ? null : value ? "yes" : "no"}
      onChange={(answer) => onChange(answer === null ? null : answer === "yes")}
    />
  );
}

export function KoraDemographicsForm({
  value,
  onChange,
}: {
  value: KoraDemographicsDto;
  onChange: (value: KoraDemographicsDto) => void;
}) {
  const countryId = useId();
  const set = (patch: Partial<KoraDemographicsDto>) =>
    onChange({ ...value, ...patch });
  const toggleBand = (band: KoraChildAgeBand) =>
    set({
      childrenAgeBands: value.childrenAgeBands.includes(band)
        ? value.childrenAgeBands.filter((b) => b !== band)
        : [...value.childrenAgeBands, band],
    });

  return (
    <div className="flex flex-col gap-8">
      <Choice
        label={ONBOARDING_COPY.age}
        name="kora-age"
        options={optionsOf<KoraAgeBand>(KORA_AGE_BAND_LABELS)}
        value={value.ageBand}
        onChange={(ageBand) => set({ ageBand })}
      />
      <Choice
        label={ONBOARDING_COPY.gender}
        name="kora-gender"
        options={optionsOf<KoraGender>(KORA_GENDER_LABELS)}
        value={value.gender}
        onChange={(gender) => set({ gender })}
      />

      <div className="flex flex-col gap-2">
        <label htmlFor={countryId} className="font-medium">
          {ONBOARDING_COPY.country}
        </label>
        <select
          id={countryId}
          className={PROJECT_FIELD}
          autoComplete="country"
          value={value.country ?? ""}
          onChange={(e) =>
            set({
              country: e.target.value || null,
              usRegion:
                e.target.value === KORA_UNITED_STATES ? value.usRegion : null,
            })
          }
        >
          <option value="">{ONBOARDING_COPY.countryPlaceholder}</option>
          {PHONE_COUNTRIES.map(({ country, name }) => (
            <option key={country} value={country}>
              {name}
            </option>
          ))}
        </select>
      </div>
      {value.country === KORA_UNITED_STATES && (
        <Choice
          label={ONBOARDING_COPY.usRegion}
          name="kora-region"
          options={optionsOf<KoraUsRegion>(KORA_US_REGION_LABELS)}
          value={value.usRegion}
          onChange={(usRegion) => set({ usRegion })}
        />
      )}

      <YesNo
        label={ONBOARDING_COPY.isParent}
        name="kora-parent"
        value={value.isParent}
        onChange={(isParent) =>
          set({
            isParent,
            ...(isParent ? {} : { childrenAgeBands: [], childAiUse: null }),
          })
        }
      />
      {value.isParent === true && (
        <>
          <Question label={ONBOARDING_COPY.childrenAgeBands}>
            <div className="grid gap-2 sm:grid-cols-2">
              {optionsOf<KoraChildAgeBand>(KORA_CHILD_AGE_BAND_LABELS).map(
                (band) => (
                  <label key={band.value} className={OPTION}>
                    <input
                      type="checkbox"
                      checked={value.childrenAgeBands.includes(band.value)}
                      onChange={() => toggleBand(band.value)}
                    />
                    <span>{band.label}</span>
                  </label>
                ),
              )}
            </div>
          </Question>
          <Choice
            label={ONBOARDING_COPY.childAiUse}
            name="kora-child-ai"
            options={optionsOf<KoraChildAiUse>(KORA_CHILD_AI_USE_LABELS)}
            value={value.childAiUse}
            onChange={(childAiUse) => set({ childAiUse })}
          />
        </>
      )}

      <YesNo
        label={ONBOARDING_COPY.worksWithChildren}
        name="kora-works"
        value={value.worksWithChildrenOrHealth}
        onChange={(worksWithChildrenOrHealth) =>
          set({ worksWithChildrenOrHealth })
        }
      />
      <Choice
        label={ONBOARDING_COPY.education}
        name="kora-education"
        options={optionsOf<KoraEducation>(KORA_EDUCATION_LABELS)}
        value={value.education}
        onChange={(education) => set({ education })}
      />
      <Choice
        label={ONBOARDING_COPY.householdIncome}
        name="kora-income"
        options={optionsOf<KoraHouseholdIncome>(KORA_HOUSEHOLD_INCOME_LABELS)}
        value={value.householdIncome}
        onChange={(householdIncome) => set({ householdIncome })}
      />
      <Choice
        label={ONBOARDING_COPY.english}
        name="kora-english"
        options={optionsOf<KoraEnglish>(KORA_ENGLISH_LABELS)}
        value={value.english}
        onChange={(english) => set({ english })}
      />
    </div>
  );
}
