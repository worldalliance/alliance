import { act, render, screen } from "@testing-library/react";
import { StrictMode, useLayoutEffect, useState } from "react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { ToastProvider } from "../ui/ToastProvider";
import { useConfirmOnPage } from "./useConfirmOnPage";

let answer: Promise<boolean> | null = null;
let heldConfirm: ReturnType<typeof useConfirmOnPage> | null = null;

const Asker = () => {
  const confirm = useConfirmOnPage();
  heldConfirm ??= confirm;
  return (
    <button
      type="button"
      onClick={() => (answer = confirm({ message: "Send to members?" }))}
    >
      Send
    </button>
  );
};

const AskerOnMount = () => {
  const confirm = useConfirmOnPage();
  useLayoutEffect(() => {
    answer = confirm({ message: "Send to members?" });
  }, [confirm]);
  return null;
};

const UnmountableAsker = () => {
  const [shown, setShown] = useState(true);
  return (
    <>
      <button type="button" onClick={() => setShown(false)}>
        Hide
      </button>
      {shown && <Asker />}
    </>
  );
};

const renderAt = (path: string, asker = <Asker />) => {
  const router = createMemoryRouter(
    [
      { path: "/items/:id", element: asker },
      { path: "/other", element: null },
    ],
    {
      initialEntries: [path],
    },
  );
  render(
    <StrictMode>
      <ToastProvider>
        <RouterProvider router={router} />
      </ToastProvider>
    </StrictMode>,
  );
  return router;
};

describe("useConfirmOnPage", () => {
  beforeEach(() => {
    answer = null;
    heldConfirm = null;
  });

  it("declines and closes the question when the path changes", async () => {
    const router = renderAt("/items/2");
    act(() => screen.getByRole("button", { name: "Send" }).click());
    expect(screen.getByText("Send to members?")).toBeTruthy();

    await act(() => router.navigate("/items/1"));

    expect(await answer).toBe(false);
    expect(screen.queryByText("Send to members?")).toBeNull();
  });

  it("keeps the question open across a search change on the same path", async () => {
    const router = renderAt("/items/2");
    act(() => screen.getByRole("button", { name: "Send" }).click());

    await act(() => router.navigate("/items/2?tab=events"));

    expect(screen.getByText("Send to members?")).toBeTruthy();
  });

  it("declines and closes the question when its caller unmounts on the same path", async () => {
    renderAt("/items/2", <UnmountableAsker />);
    act(() => screen.getByRole("button", { name: "Send" }).click());

    act(() => screen.getByRole("button", { name: "Hide" }).click());

    expect(await answer).toBe(false);
    expect(screen.queryByText("Send to members?")).toBeNull();
  });

  it("closes a question asked in a layout effect when the path changes", async () => {
    const router = renderAt("/items/2", <AskerOnMount />);
    expect(screen.getByText("Send to members?")).toBeTruthy();

    await act(() => router.navigate("/other"));

    expect(await answer).toBe(false);
    expect(screen.queryByText("Send to members?")).toBeNull();
  });

  it("declines a question asked through a confirm from an earlier path", async () => {
    const router = renderAt("/items/2");
    await act(() => router.navigate("/items/1"));

    expect(await heldConfirm!({ message: "Send to members?" })).toBe(false);
    expect(screen.queryByText("Send to members?")).toBeNull();
  });
});
