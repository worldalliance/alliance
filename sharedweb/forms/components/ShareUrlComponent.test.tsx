import type { CustomComponentField } from "@alliance/common/forms/form-schema";
import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import ShareUrlComponent from "./ShareUrlComponent";

afterEach(() => {
  cleanup();
  jest.restoreAllMocks();
});

serveApi(
  routes({
    "POST /share-urls/get-share-link": () =>
      Response.json({ url: "https://example.com/a?code=share-1" }),
  }),
);

const field: CustomComponentField = {
  id: "share",
  type: "input",
  kind: "custom",
  label: "Share",
  componentId: "share-url",
  componentConfig: { externalTargetId: 1 },
};

it.each([
  ["Copied!", () => Promise.resolve()],
  ["Copy failed", () => Promise.reject(new DOMException("denied"))],
])("says %s", async (label, writeText) => {
  jest.spyOn(navigator.clipboard, "writeText").mockImplementation(writeText);
  render(
    <ShareUrlComponent field={field} value={null} onChange={() => {}} />,
    queryWrapper(),
  );

  await screen.findByText("https://example.com/a?code=share-1");
  fireEvent.click(screen.getByText("Copy"));

  expect(await screen.findByText(label)).toBeTruthy();
});
