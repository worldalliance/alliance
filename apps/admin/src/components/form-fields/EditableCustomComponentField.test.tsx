import type { CustomComponentField } from "@alliance/common/forms/form-schema";
import type { ExternalShareTargetDto } from "@alliance/shared/client";
import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { SiteAppProvider } from "@alliance/sharedweb/ui/SiteAppProvider";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { CustomValidatorDraftsContext } from "./customValidatorDrafts";
import { EditableCustomComponentField } from "./EditableCustomComponentField";

afterEach(cleanup);

let loadStatus = 200;

serveApi(
  routes({
    "GET /external-share-targets": () =>
      loadStatus === 200
        ? Response.json([
            {
              id: 1,
              name: "Partner A",
              url: "https://example.com/a",
              paramName: "code",
              createdAt: "2026-01-02T00:00:00.000Z",
              updatedAt: "2026-01-02T00:00:00.000Z",
            } satisfies ExternalShareTargetDto,
          ])
        : Response.json({}, { status: loadStatus }),
    "POST /share-urls/get-share-link": () =>
      Response.json({ url: "https://example.com/a?code=share-1" }),
  }),
);

beforeEach(() => {
  loadStatus = 200;
});

const field: CustomComponentField = {
  id: "share",
  type: "input",
  kind: "custom",
  label: "Share",
  componentId: "share-url",
  componentConfig: { externalTargetId: 1 },
};

const renderField = () =>
  render(
    <MemoryRouter>
      <SiteAppProvider>
        <CustomValidatorDraftsContext.Provider
          value={{
            drafts: {},
            setDraft() {},
            removeDraft() {},
            createDraftId: () => -1,
          }}
        >
          <EditableCustomComponentField
            field={field}
            onUpdate={() => {}}
            onRemove={() => {}}
          />
        </CustomValidatorDraftsContext.Provider>
      </SiteAppProvider>
    </MemoryRouter>,
    queryWrapper(),
  );

it("offers the loaded share targets", async () => {
  renderField();
  expect(await screen.findByRole("option", { name: "Partner A" })).toBeTruthy();
});

it("says the share targets failed to load instead of listing none", async () => {
  loadStatus = 500;
  renderField();
  expect(await screen.findByText("Failed to load share targets.")).toBeTruthy();
  expect(
    screen.queryByText("No external share targets configured yet."),
  ).toBeNull();
});
