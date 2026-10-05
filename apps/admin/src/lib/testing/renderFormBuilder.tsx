import type { FormSchema } from "@alliance/common/forms/form-schema";
import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import { SiteOriginLinkProvider } from "@alliance/sharedweb/ui/SiteAppProvider";
import { ToastProvider } from "@alliance/sharedweb/ui/ToastProvider";
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
      <ToastProvider>
        <RouterProvider router={router} />
      </ToastProvider>
    </SiteOriginLinkProvider>,
    queryWrapper(),
  );
}
