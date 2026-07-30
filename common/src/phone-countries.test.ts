import { readFileSync } from "node:fs";
import { asCountryCode, type CountryCode, toE164 } from "./phone";
import {
  countryFlagEmoji,
  filterPhoneCountries,
  PHONE_COUNTRIES,
  phoneCountryInfo,
} from "./phone-countries";
import { R } from "./result";

describe("PHONE_COUNTRIES", () => {
  it("covers every country the parser knows, sorted by name", () => {
    expect(PHONE_COUNTRIES.length).toBeGreaterThan(200);
    const names = PHONE_COUNTRIES.map((c) => c.name);
    expect([...names].sort((a, b) => a.localeCompare(b))).toEqual(names);
  });

  it("carries the dial code and flag each option needs to render", () => {
    const gb = PHONE_COUNTRIES.find((c) => c.country === "GB");
    expect(gb).toEqual({
      country: "GB",
      callingCode: "44",
      name: "United Kingdom",
      flag: "🇬🇧",
    });
  });

  it("agrees with the parser about every dial code", () => {
    for (const { country, callingCode } of PHONE_COUNTRIES) {
      const parsed = R.toNullable(toE164(`123456789`, country));
      if (parsed) {
        expect(parsed.startsWith(`+${callingCode}`)).toBe(true);
      }
    }
  });

  it("names every country the parser knows", () => {
    const unnamed = PHONE_COUNTRIES.filter(
      (entry) => !entry.name || entry.name === entry.country,
    );

    expect(unnamed).toEqual([]);
  });

  it("builds without Intl.DisplayNames, which Hermes does not have", () => {
    const source = readFileSync(
      new URL("./phone-countries.ts", import.meta.url),
      "utf8",
    );

    expect(source).not.toContain("new Intl.DisplayNames");
  });

  it("agrees with the table-free asCountryCode about what is valid", () => {
    for (const { country } of PHONE_COUNTRIES) {
      expect(asCountryCode(country)).toBe(country);
    }
  });
});

describe("countryFlagEmoji", () => {
  it("maps an ISO code into the regional indicator block", () => {
    expect(countryFlagEmoji("GB")).toBe("🇬🇧");
    expect(countryFlagEmoji("us")).toBe("🇺🇸");
  });
});

describe("phoneCountryInfo", () => {
  it("returns the table entry for a country the picker lists", () => {
    expect(phoneCountryInfo("GB")).toBe(
      PHONE_COUNTRIES.find((entry) => entry.country === "GB"),
    );
  });

  it("labels a country it has no name for instead of throwing", () => {
    // The signature says this cannot happen; a libphonenumber-js bump that
    // adds a territory is how it would. The cast reaches the branch that keeps
    // that skew a cosmetic defect rather than a blank page.
    const unnamed = "ZZ" as CountryCode;

    expect(phoneCountryInfo(unnamed)).toEqual({
      country: "ZZ",
      callingCode: "",
      name: "ZZ",
      flag: "🇿🇿",
    });
  });
});

describe("filterPhoneCountries", () => {
  const codes = (query: string) =>
    filterPhoneCountries(query).map((entry) => entry.country);

  it("finds a country by the three things people type", () => {
    expect(codes("united kingdom")).toContain("GB");
    expect(codes("GB")).toEqual(["GB"]);
    expect(codes("44")).toContain("GB");
  });

  it("matches dial codes by prefix, not substring", () => {
    const plusOne = codes("1");
    expect(plusOne).toContain("US");
    expect(plusOne).not.toContain("PT");
    expect(plusOne).not.toContain("IN");
  });

  it("returns everything for an empty query", () => {
    expect(filterPhoneCountries("   ")).toBe(PHONE_COUNTRIES);
  });

  it("returns nothing rather than everything for a miss", () => {
    expect(codes("zzzzz")).toEqual([]);
  });
});

describe("the module boundary", () => {
  it("keeps the picker table out of ./phone", () => {
    const source = readFileSync(new URL("./phone.ts", import.meta.url), "utf8");

    expect(source).not.toContain("country-names");
    expect(source).not.toContain("getCountries");
  });
});
