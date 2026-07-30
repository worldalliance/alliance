import {
  asCountryCode,
  formatPhoneNumberForDisplay,
  formatPhoneNumberNational,
  isCanonicalE164,
  normalizePhoneNumber,
  phoneNumberCountry,
  phoneNumberForEditing,
  phoneSearchDigits,
  stripPhoneNumberFormatting,
  toE164,
} from "./phone";
import { R } from "./result";

const e164 = (input: string) => R.toNullable(toE164(input));

describe("toE164", () => {
  it("normalizes however a US number is spelled", () => {
    for (const typed of [
      "(415) 555-2671",
      "415.555.2671",
      "415-555-2671",
      "4155552671",
      " +1 415 555 2671 ",
    ]) {
      expect(e164(typed)).toBe("+14155552671");
    }
  });

  it("keeps an international number in its own country", () => {
    expect(e164("+44 20 7946 0958")).toBe("+442079460958");
    expect(e164("+86 138 0013 8000")).toBe("+8613800138000");
  });

  it("drops an extension, which SMS cannot address anyway", () => {
    expect(e164("+1 415 555 2671 x22")).toBe("+14155552671");
  });

  it("separates empty from invalid, so callers can word them apart", () => {
    const empty = toE164("   ");
    const invalid = toE164("415555");

    expect(R.isFailure(empty) && empty.error).toBe("empty");
    expect(R.isFailure(invalid) && invalid.error).toBe("invalid");
  });

  it("rejects a number that is well-formed but cannot exist", () => {
    expect(e164("800-123-0000")).toBeNull();
    expect(e164("(800) 123-0000")).toBeNull();
    expect(e164("+86 138 0013 800")).toBeNull();
  });

  it("rejects the dev placeholders `MmsService` sends to", () => {
    expect(e164("15550100")).toBeNull();
    expect(e164("+15555550100")).toBeNull();
  });
});

describe("normalizePhoneNumber", () => {
  it("canonicalizes however a number was spelled", () => {
    for (const typed of ["(415) 555-2671", "415.555.2671", "4155552671"]) {
      expect(normalizePhoneNumber(typed)).toBe("+14155552671");
    }
  });

  it("reads a national number as the country it is given", () => {
    expect(normalizePhoneNumber("07578 497969", "GB")).toBe("+447578497969");
    expect(normalizePhoneNumber("5512345678", "MX")).toBe("+525512345678");
  });

  it("hands back anything it cannot parse, so nothing is destroyed", () => {
    for (const unparseable of ["555-12", "call me", "", "  "]) {
      expect(normalizePhoneNumber(unparseable)).toBe(unparseable);
    }
  });

  it("is idempotent, so repeated writes do not drift", () => {
    for (const value of ["(415) 555-2671", "555-12", "+447578497969"]) {
      const once = normalizePhoneNumber(value);
      expect(normalizePhoneNumber(once)).toBe(once);
    }
  });
});

describe("isCanonicalE164", () => {
  it("accepts exactly what normalizePhoneNumber produces", () => {
    for (const typed of [
      "(415) 555-2671",
      "415.555.2671",
      "+44 20 7946 0958",
    ]) {
      expect(isCanonicalE164(normalizePhoneNumber(typed))).toBe(true);
    }
  });

  it("rejects a number that is merely parseable, not canonical", () => {
    for (const typed of [
      "(415) 555-2671",
      "4155552671",
      " +14155552671 ",
      "+1 415 555 2671",
    ]) {
      expect(isCanonicalE164(typed)).toBe(false);
    }
  });

  it("rejects E.164-shaped strings that are not real numbers", () => {
    for (const wellFormed of ["+18001230000", "+861380013800"]) {
      expect(/^\+[1-9]\d{1,14}$/.test(wellFormed)).toBe(true);
      expect(isCanonicalE164(wellFormed)).toBe(false);
    }
  });

  it("rejects blank and unparseable input", () => {
    for (const value of ["", "  ", "555-12", "call me"]) {
      expect(isCanonicalE164(value)).toBe(false);
    }
  });
});

describe("asCountryCode", () => {
  it("accepts a code the parser knows, in any casing", () => {
    expect(asCountryCode("GB")).toBe("GB");
    expect(asCountryCode("gb")).toBe("GB");
    expect(asCountryCode("us")).toBe("US");
  });

  it("rejects anything the parser cannot use as a region", () => {
    for (const code of ["ZZ", "GBR", "", "  ", null, undefined]) {
      expect(asCountryCode(code)).toBeNull();
    }
  });
});

describe("phoneSearchDigits", () => {
  it("reduces a query and a stored number to the same shape", () => {
    expect(phoneSearchDigits("(415) 555-2671")).toBe("4155552671");
    expect(phoneSearchDigits("+14155552671")).toBe("14155552671");
    expect(phoneSearchDigits("4155")).toBe("4155");
  });

  it("is empty for a query with no digits in it", () => {
    expect(phoneSearchDigits("ada")).toBe("");
    expect(phoneSearchDigits(null)).toBe("");
    expect(phoneSearchDigits(undefined)).toBe("");
  });
});

describe("formatPhoneNumberForDisplay", () => {
  it("formats a US number nationally and any other internationally", () => {
    expect(formatPhoneNumberForDisplay("+14155552671")).toBe("(415) 555-2671");
    expect(formatPhoneNumberForDisplay("+442079460958")).toBe(
      "+44 20 7946 0958",
    );
  });

  it("returns a value it cannot parse unchanged, so legacy rows still render", () => {
    expect(formatPhoneNumberForDisplay("555-12")).toBe("555-12");
    expect(formatPhoneNumberForDisplay("+18001230000")).toBe("+18001230000");
  });
});

describe("toE164 with a country", () => {
  it("reads a national number as the country the member picked", () => {
    expect(R.toNullable(toE164("07578 497969", "GB"))).toBe("+447578497969");
    expect(R.toNullable(toE164("07 51 18 14 45", "FR"))).toBe("+33751181445");
    expect(R.toNullable(toE164("88151 90188", "IN"))).toBe("+918815190188");
    expect(R.toNullable(toE164("11 94310-8114", "BR"))).toBe("+5511943108114");
  });

  it("stops reading a foreign national number as a US one", () => {
    expect(R.toNullable(toE164("5512345678", "US"))).toBe("+15512345678");
    expect(R.toNullable(toE164("5512345678", "MX"))).toBe("+525512345678");
  });

  it("still lets an explicit country code win over the selection", () => {
    expect(R.toNullable(toE164("+447578497969", "US"))).toBe("+447578497969");
    expect(R.toNullable(toE164("+14155552671", "GB"))).toBe("+14155552671");
  });

  it("defaults to US so server callers are unaffected", () => {
    expect(R.toNullable(toE164("(415) 555-2671"))).toBe("+14155552671");
  });
});

describe("phoneNumberCountry", () => {
  it("recovers the country from a stored number, to seed the selector", () => {
    expect(phoneNumberCountry("+447578497969")).toBe("GB");
    expect(phoneNumberCountry("+33751181445")).toBe("FR");
    expect(phoneNumberCountry("+14155552671")).toBe("US");
  });

  it("is null when there is nothing to recover", () => {
    expect(phoneNumberCountry("0751181445")).toBeNull();
    expect(phoneNumberCountry(null)).toBeNull();
    expect(phoneNumberCountry("")).toBeNull();
  });
});

describe("phoneNumberCountry across the +1 countries", () => {
  it("names the real country for a national number typed under another +1 one", () => {
    expect(phoneNumberCountry("4155552671", "TT")).toBe("US");
    expect(phoneNumberCountry("4155552671", "CA")).toBe("US");
    expect(phoneNumberCountry("+14155552671", "TT")).toBe("US");
  });

  it("leaves a genuine number for the selected +1 country alone", () => {
    expect(phoneNumberCountry("8683771234", "TT")).toBe("TT");
    expect(phoneNumberCountry("4165551234", "CA")).toBe("CA");
    expect(phoneNumberCountry("8765551234", "JM")).toBe("JM");
    expect(phoneNumberCountry("4155552671", "US")).toBe("US");
  });

  it("says nothing about a number still being typed", () => {
    for (const partial of ["4", "41", "415", "41555", "+1", "+1415"]) {
      expect(phoneNumberCountry(partial, "TT")).toBeNull();
    }
  });

  it("still resolves a number from outside the selected country's zone", () => {
    expect(phoneNumberCountry("+447578497969", "TT")).toBe("GB");
    expect(phoneNumberCountry("+33751181445", "GB")).toBe("FR");
  });
});

describe("stripPhoneNumberFormatting", () => {
  it("takes out every separator a formatter puts in", () => {
    expect(stripPhoneNumberFormatting("(415) 555-2671")).toBe("4155552671");
    expect(stripPhoneNumberFormatting("07578 497969")).toBe("07578497969");
    expect(stripPhoneNumberFormatting("07 51 18 14 45")).toBe("0751181445");
    expect(stripPhoneNumberFormatting("+44 7578 497969")).toBe("+447578497969");
  });

  it("keeps a leading +, which is part of the number and not formatting", () => {
    expect(stripPhoneNumberFormatting("+14155552671")).toBe("+14155552671");
    expect(stripPhoneNumberFormatting(" +1 415 555 2671 ")).toBe(
      "+14155552671",
    );
  });

  it("round-trips through formatting without changing the number", () => {
    for (const [typed, country] of [
      ["4155552671", "US"],
      ["07578497969", "GB"],
      ["0751181445", "FR"],
    ] as const) {
      const grouped = formatPhoneNumberNational(typed, country);
      expect(stripPhoneNumberFormatting(grouped)).toBe(typed);
    }
  });

  it("leaves nothing behind for input with no digits", () => {
    expect(stripPhoneNumberFormatting("abc")).toBe("");
    expect(stripPhoneNumberFormatting("")).toBe("");
  });
});

describe("phoneNumberForEditing", () => {
  it("takes the separators out of a stored number", () => {
    expect(phoneNumberForEditing("+14155552671")).toBe("4155552671");
    expect(phoneNumberForEditing("(415) 555-2671")).toBe("4155552671");
  });

  it("keeps the national prefix the member would type", () => {
    expect(phoneNumberForEditing("+447578497969", "GB")).toBe("07578497969");
    expect(phoneNumberForEditing("+33751181445", "FR")).toBe("0751181445");
  });

  it("leaves a number it cannot parse exactly as it found it", () => {
    // Rewriting these would register as an edit and block every other save.
    for (const legacy of ["555-12", "call me", "1-800-FLOWERS", "  "]) {
      expect(phoneNumberForEditing(legacy)).toBe(legacy);
    }
  });

  it("leaves an empty field empty rather than reporting a change", () => {
    expect(phoneNumberForEditing("")).toBe("");
  });

  it("is stable once applied, so refocusing changes nothing", () => {
    for (const [stored, country] of [
      ["+14155552671", "US"],
      ["+447578497969", "GB"],
      ["555-12", "US"],
    ] as const) {
      const once = phoneNumberForEditing(stored, country);
      expect(phoneNumberForEditing(once, country)).toBe(once);
    }
  });
});
