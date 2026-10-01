import type { FormResponseDto } from "@alliance/shared/client";
import { makeFormResponse } from "@alliance/shared/lib/testFixtures";
import { savedChoicesAcrossResponses } from "./savedChoices";

const response = (
  createdAt: string,
  formulaChoices: FormResponseDto["formulaChoices"],
): FormResponseDto => makeFormResponse({ createdAt, formulaChoices });

it("merges every response's saved choices under the label first saved", () => {
  expect(
    savedChoicesAcrossResponses([
      response("2026-03-05T00:00:00.000Z", {
        pick: [
          { label: "Renamed", value: "a" },
          { label: "Beta", value: "b" },
        ],
      }),
      response("2026-03-04T00:00:00.000Z", {
        pick: [{ label: "Alpha", value: "a" }],
        other: [{ label: "Gamma", value: "c" }],
      }),
    ]),
  ).toEqual({
    pick: [
      { label: "Alpha", value: "a" },
      { label: "Beta", value: "b" },
    ],
    other: [{ label: "Gamma", value: "c" }],
  });
});
