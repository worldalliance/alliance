import { client } from "@alliance/shared/client/client.gen";
import { ToastProvider } from "@alliance/sharedweb/ui/ToastProvider";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import CreateActionMenu from "./CreateActionMenu";

const { baseUrl, fetch } = client.getConfig();

afterEach(() => {
  cleanup();
  jest.restoreAllMocks();
  client.setConfig({ baseUrl, fetch });
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
