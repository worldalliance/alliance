import type { FormSchema } from "@alliance/common/forms/form-schema";
import { SiteOriginLinkProvider } from "@alliance/sharedweb/ui/SiteAppProvider";
import { ToastProvider } from "@alliance/sharedweb/ui/ToastProvider";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { FormBuilder } from "../../components/FormBuilder";

export function renderFormBuilder(initialSchema: FormSchema, formId?: number) {
  const router = createMemoryRouter([
    {
      path: "/",
      element: (
        <FormBuilder
          formId={formId}
          initialSchema={initialSchema}
          setFormId={() => {}}
        />
      ),
    },
  ]);
  render(
    <SiteOriginLinkProvider origin="https://worldalliance.org">
      <QueryClientProvider client={new QueryClient()}>
        <ToastProvider>
          <RouterProvider router={router} />
        </ToastProvider>
      </QueryClientProvider>
    </SiteOriginLinkProvider>,
  );
}
