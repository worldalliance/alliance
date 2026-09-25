import type { AnyField, FormSchema } from "@alliance/common/forms/form-schema";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { VariableBuilder } from "./VariableBuilder";

export const town: AnyField = {
  id: "town",
  type: "input",
  kind: "text",
  label: "Town",
};

export function Harness({
  initial,
  onSave,
  unsaved = false,
}: {
  initial: FormSchema;
  onSave: (schema: FormSchema) => void;
  unsaved?: boolean;
}) {
  const [current, setCurrent] = useState(initial);
  const [queryClient] = useState(
    () => new QueryClient({ defaultOptions: { queries: { retry: false } } }),
  );
  return (
    <QueryClientProvider client={queryClient}>
      <VariableBuilder
        formId={unsaved ? undefined : 1}
        schema={current}
        onSchemaChange={(next) => {
          setCurrent(next);
          onSave(next);
        }}
      />
    </QueryClientProvider>
  );
}
