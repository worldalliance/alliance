import type { FormSchema } from "@alliance/common/forms/form-schema";
import { R } from "@alliance/common/result";
import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import { render } from "@testing-library/react";
import type { ReactNode } from "react";
import { createMemoryRouter, Outlet, RouterProvider } from "react-router";
import LeaveGuard from "../../components/LeaveGuard";
import { FormBuilder } from "../../pages/forms/builder/FormBuilder";
import { ShortcutsProvider } from "../../shell/shortcuts";
import { SiteOriginLinkProvider } from "../../ui/SiteAppProvider";
import { ToastProvider } from "../../ui/ToastProvider";

function renderBuilder(builder: ReactNode, url = "/") {
  const router = createMemoryRouter(
    [
      {
        element: (
          <LeaveGuard>
            <Outlet />
          </LeaveGuard>
        ),
        children: [{ path: "/", element: builder }],
      },
    ],
    { initialEntries: [url] },
  );
  render(
    <SiteOriginLinkProvider origin="https://worldalliance.org">
      <ToastProvider>
        <ShortcutsProvider>
          <RouterProvider router={router} />
        </ShortcutsProvider>
      </ToastProvider>
    </SiteOriginLinkProvider>,
    queryWrapper(),
  );
  return router;
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

export function renderTaskFormBuilder(initialSchema: FormSchema) {
  renderBuilder(
    <FormBuilder initialSchema={initialSchema} setFormId={() => {}} taskFlow />,
  );
}

/** The builder loading form `formId` from the server, opened at `url`. */
export function renderSavedFormBuilder(formId: number, url: string) {
  return renderBuilder(
    <FormBuilder formId={formId} setFormId={() => {}} />,
    url,
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
