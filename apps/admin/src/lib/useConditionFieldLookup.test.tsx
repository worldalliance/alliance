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

it("finds a rule's question on this form or, loaded, on another one", () => {
  const queryClient = new QueryClient();
  queryClient.setQueryData(queryKeys.formQuestionFieldsAdmin(7), {
    formId: 7,
    fields: [{ id: "pet", type: "input", kind: "text", label: "Their pet" }],
  });
  const { result } = renderHook(
    () => useConditionFieldLookup(schema, schema.pages[0]!),
    {
      wrapper: ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={queryClient}>
          {children}
        </QueryClientProvider>
      ),
    },
  );
  expect(result.current("pet", 7)?.label).toBe("Their pet");
  expect(result.current("pet", null)?.label).toBe("Our pet");
  expect(result.current("pet", 8)).toBeUndefined();
});
