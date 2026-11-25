import type { FormSchema } from "@alliance/common/forms/form-schema";
import type { FormResponseDto } from "@alliance/shared/client";
import { makeFormResponse } from "@alliance/shared/lib/testFixtures";
import { fireEvent, render, screen } from "@testing-library/react";
import { SiteOriginLinkProvider } from "../ui/SiteAppProvider";
import FormResponseStatistics from "./FormResponseStatistics";

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
): FormResponseDto =>
  makeFormResponse({ formSnapshotId: 7, schemaSnapshot: schema, ...saved });

it("counts every choice any response saved, under the label saved first", () => {
  render(
    <SiteOriginLinkProvider origin="https://worldalliance.org">
      <FormResponseStatistics
        form={{ id: 1, title: "Form", formSnapshotId: 7, schema }}
        loading={false}
        error={null}
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

it("filters the replays by the answer whose bar is pressed", () => {
  const onFilterSelect = jest.fn();
  render(
    <SiteOriginLinkProvider origin="https://worldalliance.org">
      <FormResponseStatistics
        form={{ id: 1, title: "Form", formSnapshotId: 7, schema }}
        loading={false}
        error={null}
        responses={[
          response({
            id: 1,
            createdAt: "2026-03-04T10:00:00.000Z",
            answers: { pick: ["a"] },
            formulaChoices: { pick: [{ label: "Alpha", value: "a" }] },
          }),
        ]}
        onFilterSelect={onFilterSelect}
      />
    </SiteOriginLinkProvider>,
  );
  fireEvent.click(
    screen.getByRole("button", {
      name: /Alpha.*Show these responses in Replays/,
    }),
  );

  expect(onFilterSelect).toHaveBeenCalledWith({
    fieldId: "pick",
    op: "includes",
    value: "a",
  });
});

it("offers no answer to select when no bar is a button", () => {
  const numberSchema: FormSchema = {
    pages: [
      {
        id: "page-1",
        fields: [{ id: "age", type: "input", kind: "number", label: "Age" }],
      },
    ],
    outputViews: [],
  };
  render(
    <SiteOriginLinkProvider origin="https://worldalliance.org">
      <FormResponseStatistics
        form={{ id: 1, title: "Form", formSnapshotId: 7, schema: numberSchema }}
        loading={false}
        error={null}
        responses={[1, 2, 3].map((age) =>
          makeFormResponse({
            id: age,
            formSnapshotId: 7,
            schemaSnapshot: numberSchema,
            answers: { age },
          }),
        )}
        onFilterSelect={jest.fn()}
      />
    </SiteOriginLinkProvider>,
  );

  expect(screen.getByText("Age")).toBeTruthy();
  expect(screen.queryByText(/Select an answer/)).toBeNull();
});

it("says nothing about responses until they load", () => {
  const view = render(
    <FormResponseStatistics
      form={{ id: 1, title: "Form", formSnapshotId: 7, schema }}
      responses={[]}
      loading
      error={null}
    />,
  );
  expect(screen.queryByText("No responses yet")).toBeNull();

  view.rerender(
    <FormResponseStatistics
      form={{ id: 1, title: "Form", formSnapshotId: 7, schema }}
      responses={[]}
      loading={false}
      error="The server didn't answer."
    />,
  );
  expect(screen.getByText("Couldn't load responses")).toBeTruthy();
  expect(screen.queryByText("No responses yet")).toBeNull();
});
