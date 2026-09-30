import { client } from "@alliance/shared/client/client.gen";
import { registerErrorStatus } from "@alliance/shared/lib/hey-api";
import { ToastProvider } from "@alliance/sharedweb/ui/ToastProvider";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import CreateActionMenu from "./CreateActionMenu";

const { baseUrl, fetch } = client.getConfig();

registerErrorStatus(client);

afterEach(() => {
  cleanup();
  jest.restoreAllMocks();
  client.setConfig({ baseUrl, fetch });
});

const renderMenu = () => {
  const router = createMemoryRouter([
    { path: "/", element: <CreateActionMenu /> },
  ]);
  render(
    <QueryClientProvider client={new QueryClient()}>
      <ToastProvider>
        <RouterProvider router={router} />
      </ToastProvider>
    </QueryClientProvider>,
  );
};

it("shows the server's reason for refusing a paste", async () => {
  jest.spyOn(console, "error").mockImplementation(() => {});
  jest.spyOn(navigator.clipboard, "readText").mockResolvedValue("{}");
  const reason = "Every Tag condition in the cohort must name an existing tag.";
  client.setConfig({
    baseUrl: "http://localhost",
    fetch: async () =>
      Response.json({ statusCode: 400, message: reason }, { status: 400 }),
  });
  renderMenu();

  fireEvent.click(screen.getByRole("button", { name: "Create" }));
  fireEvent.click(await screen.findByText("Paste JSON"));

  expect(await screen.findByText(reason)).toBeTruthy();
});

it.each([
  [
    "clipboard read",
    () =>
      jest
        .spyOn(navigator.clipboard, "readText")
        .mockRejectedValue(new DOMException("denied", "NotAllowedError")),
  ],
  [
    "paste request",
    () => {
      jest.spyOn(navigator.clipboard, "readText").mockResolvedValue("{}");
      client.setConfig({
        baseUrl: "http://localhost",
        fetch: () => Promise.reject(new TypeError("Failed to fetch")),
      });
    },
  ],
])("reports a rejected %s and re-enables Paste JSON", async (_, reject) => {
  jest.spyOn(console, "error").mockImplementation(() => {});
  reject();
  renderMenu();

  fireEvent.click(screen.getByRole("button", { name: "Create" }));
  fireEvent.click(await screen.findByText("Paste JSON"));

  expect(await screen.findByText("Could not paste action")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Create" }));
  expect(
    (await screen.findByRole("menuitem", { name: "Paste JSON" })).getAttribute(
      "aria-disabled",
    ),
  ).not.toBe("true");
});
