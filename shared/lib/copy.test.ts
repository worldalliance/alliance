import { agreementEnteredCount } from "./copy";

it("counts the inviter apart from the others who entered", () => {
  expect(agreementEnteredCount({ afterInviter: true, signedCount: 1201 })).toBe(
    "and 1,200 others have entered the agreement.",
  );
});

it("counts every member when no one invited the viewer", () => {
  expect(
    agreementEnteredCount({ afterInviter: false, signedCount: 1201 }),
  ).toBe("1,201 members have entered the agreement.");
});
