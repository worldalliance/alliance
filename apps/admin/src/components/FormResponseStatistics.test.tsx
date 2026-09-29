import type { FormSchema } from "@alliance/common/forms/form-schema";
import type { FormResponseDto } from "@alliance/shared/client";
import { SiteOriginLinkProvider } from "@alliance/sharedweb/ui/SiteAppProvider";
import { cleanup, render, screen } from "@testing-library/react";
import FormResponseStatistics from "./FormResponseStatistics";

afterEach(cleanup);

const schema: FormSchema = {
  pages: [
    {
      id: "page-1",
      fields: [
        {
          id: "pick",
          type: "input",
          kind: "multiselect",
          label: "Pick",
          options: [],
          optionsFormula: { inputs: {}, formula: "[]" },
        },
      ],
    },
  ],
  outputViews: [],
};

const response = (
  saved: Pick<FormResponseDto, "id" | "createdAt" | "answers"> & {
    formulaChoices: FormResponseDto["formulaChoices"];
  },
): FormResponseDto => ({
  formId: 1,
  formSnapshotId: 7,
  publicAnswers: {},
  schemaSnapshot: schema,
  visibilityValidatorResults: {},
  ...saved,
});

it("counts every choice any response saved, under the label saved first", () => {
  render(
    <SiteOriginLinkProvider origin="https://worldalliance.org">
      <FormResponseStatistics
        form={{ id: 1, title: "Form", formSnapshotId: 7, schema }}
        responses={[
          response({
            id: 2,
            createdAt: "2026-03-05T10:00:00.000Z",
            answers: { pick: ["a", "b"] },
            formulaChoices: {
              pick: [
                { label: "Renamed A", value: "a" },
                { label: "Beta", value: "b" },
              ],
            },
          }),
          response({
            id: 1,
            createdAt: "2026-03-04T10:00:00.000Z",
            answers: { pick: ["a"] },
            formulaChoices: { pick: [{ label: "Alpha", value: "a" }] },
          }),
        ]}
      />
    </SiteOriginLinkProvider>,
  );

  expect(screen.getByText("Alpha")).toBeTruthy();
  expect(screen.getByText("Beta")).toBeTruthy();
  expect(screen.queryByText("Renamed A")).toBeNull();
  expect(screen.queryByText(/Unknown option/)).toBeNull();
});
