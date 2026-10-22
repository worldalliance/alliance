import { R } from "@alliance/common/result";
import { INVALID_CONTACT, parseWaitlistContact } from "./WaitlistContactInput";

test("accepts internationalized email addresses", () => {
  for (const email of ["user@münchen.de", "josé@example.com"]) {
    expect(parseWaitlistContact(` ${email} `, "US")).toEqual(
      R.success({ email }),
    );
  }
});

test("refuses a malformed email address", () => {
  for (const email of ["person@example", "@example.com", "a@@example.com"]) {
    expect(parseWaitlistContact(email, "US")).toEqual(
      R.failure(INVALID_CONTACT),
    );
  }
});

test("refuses free text around a number, and a desk line's extension", () => {
  for (const text of [
    "Tel: 415-555-2671",
    "call me at 415 555 2671",
    "415-555-2671 ext 12",
  ]) {
    expect(parseWaitlistContact(text, "US")).toEqual(
      R.failure(INVALID_CONTACT),
    );
  }
  expect(parseWaitlistContact("415-555-2671", "US")).toEqual(
    R.success({ phoneNumber: "+14155552671" }),
  );
});
