import type { FormSchema } from "@alliance/common/forms/form-schema";
import { queryKeys } from "@alliance/shared/lib/queryKeys";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { useConditionFieldLookup } from "./useConditionFieldLookup";

const schema: FormSchema = {
  pages: [
    {
      id: "p1",
      fields: [
        { id: "pet", type: "input", kind: "text", label: "Our pet" },
        {
          id: "shown",
          type: "input",
          kind: "text",
          label: "Shown",
          visibleIfFormula: {
            conditions: {
              c1: {
                kind: "hasValue",
                when: "pet",
                hasValue: true,
                sourceFormId: 7,
              },
            },
            formula: "c1",
          },
        },
      ],
    },
  ],
  outputViews: [],
};

const renderLookup = (form: FormSchema, queryClient = new QueryClient()) =>
  renderHook(() => useConditionFieldLookup(form, form.pages[0]!), {
    wrapper: ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    ),
  });

it("finds a rule's question on this form or, loaded, on another one", () => {
  const queryClient = new QueryClient();
  queryClient.setQueryData(queryKeys.formQuestionFieldsAdmin(7), {
    formId: 7,
    fields: [{ id: "pet", type: "input", kind: "text", label: "Their pet" }],
  });
  const { result } = renderLookup(schema, queryClient);
  expect(result.current("pet", 7)?.label).toBe("Their pet");
  expect(result.current("pet", null)?.label).toBe("Our pet");
  expect(result.current("pet", 8)).toBeUndefined();
});

it("finds a list's sub-field, which a rule may read", () => {
  const withList: FormSchema = {
    pages: [
      {
        id: "p1",
        fields: [
          {
            id: "kids",
            type: "input",
            kind: "list",
            label: "Kids",
            fields: [
              { id: "name", type: "input", kind: "text", label: "Name" },
            ],
          },
        ],
      },
    ],
    outputViews: [],
  };
  const { result } = renderLookup(withList);
  expect(result.current("name", null)?.label).toBe("Name");
});
