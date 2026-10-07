import type { FormSchema } from "@alliance/common/forms/form-schema";
import { R } from "@alliance/common/result";
import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import { SiteOriginLinkProvider } from "@alliance/sharedweb/ui/SiteAppProvider";
import { ToastProvider } from "@alliance/sharedweb/ui/ToastProvider";
import { render } from "@testing-library/react";
import type { ReactNode } from "react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { FormBuilder } from "../../components/FormBuilder";

function renderBuilder(builder: ReactNode) {
  const router = createMemoryRouter([{ path: "/", element: builder }]);
  render(
    <SiteOriginLinkProvider origin="https://worldalliance.org">
      <ToastProvider>
        <RouterProvider router={router} />
      </ToastProvider>
    </SiteOriginLinkProvider>,
    queryWrapper(),
  );
}

export function renderFormBuilder(initialSchema: FormSchema, formId?: number) {
  renderBuilder(
    <FormBuilder
      formId={formId}
      initialSchema={initialSchema}
      setFormId={() => {}}
    />,
  );
}

export function renderDisplayOnlyBuilder(initialSchema: FormSchema) {
  renderBuilder(
    <FormBuilder
      displayOnly
      title="Update"
      initialSnapshotId={1}
      onSave={async () => R.success({ snapshotId: 2 })}
      initialSchema={initialSchema}
      setFormId={() => {}}
    />,
  );
}
