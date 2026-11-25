import {
  BigLinkAction,
  BigLinkColor,
  type BigLinkBlock,
} from "@alliance/common/forms/display-blocks";
import type { ExternalShareTargetDto } from "@alliance/shared/client";
import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { SiteOriginLinkProvider } from "../../ui/SiteAppProvider";
import { ToastProvider } from "../../ui/ToastProvider";
import { EditableBigLinkBlock } from "./EditableBigLinkBlock";

serveApi(
  routes({
    "GET /user/list": () => Response.json([]),
    "GET /external-share-targets": () =>
      Response.json([
        {
          id: 4,
          name: "Qualtrics survey",
          url: "https://example.com/survey",
          paramName: "Alliance_ID",
          createdAt: "2026-01-02T00:00:00.000Z",
          updatedAt: "2026-01-02T00:00:00.000Z",
        } satisfies ExternalShareTargetDto,
      ]),
  }),
);

const urlLink: BigLinkBlock = {
  type: "display",
  kind: "biglink",
  id: "block-1",
  text: "Take the survey",
  url: "/",
};

const targetLink: BigLinkBlock = {
  ...urlLink,
  url: "https://example.com/survey",
  externalTargetId: 4,
};

const renderEditor = (block: BigLinkBlock) => {
  const onUpdate = jest.fn();
  render(
    <MemoryRouter>
      <ToastProvider>
        <SiteOriginLinkProvider origin="https://thealliance.org">
          <EditableBigLinkBlock
            block={block}
            onUpdate={onUpdate}
            onRemove={() => {}}
          />
        </SiteOriginLinkProvider>
      </ToastProvider>
    </MemoryRouter>,
    queryWrapper(),
  );
  return onUpdate;
};

it("stores the picked target with its base URL as the fallback link", async () => {
  const onUpdate = renderEditor(urlLink);

  fireEvent.click(screen.getByRole("radio", { name: "Share target" }));
  const select = await screen.findByDisplayValue("Select a target…");
  fireEvent.change(select, { target: { value: "4" } });

  expect(onUpdate).toHaveBeenLastCalledWith({
    externalTargetId: 4,
    url: "https://example.com/survey",
  });
});

it("drops the target when switched back to a URL", () => {
  const onUpdate = renderEditor(targetLink);

  expect(
    screen.getByRole<HTMLInputElement>("radio", { name: "Share target" })
      .checked,
  ).toBe(true);
  fireEvent.click(screen.getByRole("radio", { name: "URL" }));

  expect(onUpdate).toHaveBeenLastCalledWith({ externalTargetId: undefined });
});

it("stores the Green color", () => {
  const onUpdate = renderEditor(urlLink);

  fireEvent.change(screen.getByRole("combobox", { name: "Color" }), {
    target: { value: BigLinkColor.Green },
  });

  expect(onUpdate).toHaveBeenLastCalledWith({ color: BigLinkColor.Green });
});

it("stores the Copy the link option", () => {
  const onUpdate = renderEditor(urlLink);

  fireEvent.click(screen.getByRole("radio", { name: "Copy the link" }));

  expect(onUpdate).toHaveBeenLastCalledWith({ action: BigLinkAction.Copy });
});

it("stores showing the link, and drops it when unchecked", () => {
  const onUpdate = renderEditor({ ...urlLink, showUrl: true });

  fireEvent.click(screen.getByRole("checkbox", { name: "Show the link" }));

  expect(onUpdate).toHaveBeenLastCalledWith({ showUrl: undefined });
});

it("keeps the target picker open while none is chosen", async () => {
  renderEditor(urlLink);

  fireEvent.click(screen.getByRole("radio", { name: "Share target" }));

  expect(await screen.findByText("Select a target…")).toBeTruthy();
  expect(screen.queryByPlaceholderText("/path or https://...")).toBeNull();
});
