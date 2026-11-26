import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, jest } from "bun:test";
import { notifyRealMembersText } from "../lib/notifyRealMembers";
import ConfirmDialog from "./ConfirmDialog";
import { ToastProvider, useToast, type ConfirmOptions } from "./ToastProvider";

afterEach(cleanup);

const PHRASE = notifyRealMembersText(2911);

describe("ConfirmDialog with a typed phrase", () => {
  const renderTyped = () => {
    const onConfirm = jest.fn();
    render(
      <ConfirmDialog
        open
        title="Launch Holiday check-ins?"
        message="2,911 real members are notified. This can't be undone."
        confirmLabel="Launch"
        requiredText={PHRASE}
        onConfirm={onConfirm}
        onCancel={() => {}}
      />,
    );
    return {
      onConfirm,
      input: screen.getByPlaceholderText(PHRASE),
      launch: screen.getByRole<HTMLButtonElement>("button", { name: "Launch" }),
    };
  };

  it("keeps the confirm button disabled until the phrase matches exactly", () => {
    const { input, launch, onConfirm } = renderTyped();
    expect(launch.disabled).toBe(true);

    fireEvent.change(input, {
      target: { value: "I am going to notify 2,911 real members" },
    });
    expect(launch.disabled).toBe(true);
    fireEvent.keyDown(input, { key: "Enter" });
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Enter" });
    expect(onConfirm).not.toHaveBeenCalled();

    fireEvent.change(input, { target: { value: `  ${PHRASE} ` } });
    expect(launch.disabled).toBe(false);
    fireEvent.click(launch);
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("confirms on Enter in the field once the phrase matches", () => {
    const { input, onConfirm } = renderTyped();
    fireEvent.change(input, { target: { value: PHRASE } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("names the field with the phrase to type", () => {
    renderTyped();
    expect(
      screen.getByRole("textbox", {
        name: `Type "${PHRASE}" to confirm this action.`,
      }),
    ).toBeTruthy();
  });
});

describe("ConfirmDialog", () => {
  it("holds both buttons while the work runs", () => {
    render(
      <ConfirmDialog
        open
        busy
        title="Delete the tag?"
        confirmLabel="Delete tag"
        destructive
        onConfirm={() => {}}
        onCancel={() => {}}
      />,
    );
    expect(
      screen.getByRole<HTMLButtonElement>("button", { name: "Delete tag" })
        .disabled,
    ).toBe(true);
    expect(
      screen.getByRole<HTMLButtonElement>("button", { name: "Cancel" })
        .disabled,
    ).toBe(true);
  });
});

describe("useToast().confirm", () => {
  const results: boolean[] = [];
  function Asker({ options }: { options: ConfirmOptions }) {
    const { confirm } = useToast();
    return (
      <button
        type="button"
        onClick={() => void confirm(options).then((v) => results.push(v))}
      >
        Ask
      </button>
    );
  }
  const ask = async (options: ConfirmOptions) => {
    results.length = 0;
    render(
      <ToastProvider>
        <Asker options={options} />
      </ToastProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Ask" }));
    await screen.findByRole("dialog");
  };

  it("resolves true on confirm and closes", async () => {
    await ask({ title: "Remove the leader?", confirmLabel: "Remove leader" });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Remove leader" }));
    });
    expect(results).toEqual([true]);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("resolves false on cancel", async () => {
    await ask({ title: "Remove the leader?" });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    });
    expect(results).toEqual([false]);
  });

  it("shows the confirm button alone to acknowledge", async () => {
    await ask({
      title: "Nothing was deleted",
      confirmLabel: "OK",
      cancelLabel: null,
    });
    const dialog = screen.getByRole("dialog");
    expect(
      [...dialog.querySelectorAll("button")]
        .map((button) => button.textContent)
        .filter((name) => name !== ""),
    ).toEqual(["OK"]);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "OK" }));
    });
    expect(results).toEqual([true]);
  });

  it("resolves false and closes when its signal aborts", async () => {
    const controller = new AbortController();
    await ask({ title: "Remove the leader?", signal: controller.signal });
    await act(async () => {
      controller.abort();
    });
    expect(results).toEqual([false]);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("asks for the phrase when one is required", async () => {
    await ask({ title: "Send?", requiredText: PHRASE, confirmLabel: "Send" });
    expect(
      screen.getByRole<HTMLButtonElement>("button", { name: "Send" }).disabled,
    ).toBe(true);
  });

  it("focuses the phrase field on open and returns focus to the opener on cancel", async () => {
    results.length = 0;
    render(
      <ToastProvider>
        <Asker
          options={{
            title: "Send?",
            requiredText: PHRASE,
            confirmLabel: "Send",
          }}
        />
      </ToastProvider>,
    );
    screen.getByRole("button", { name: "Ask" }).focus();
    fireEvent.click(screen.getByRole("button", { name: "Ask" }));
    await screen.findByRole("dialog");
    expect(document.activeElement).toBe(screen.getByRole("textbox"));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    });
    await waitFor(() =>
      expect(document.activeElement).toBe(
        screen.getByRole("button", { name: "Ask" }),
      ),
    );
  });
});

describe("useToast().confirm asked twice", () => {
  let confirm: ReturnType<typeof useToast>["confirm"] = () =>
    Promise.resolve(false);
  function Capture() {
    confirm = useToast().confirm;
    return null;
  }
  const mount = () =>
    render(
      <ToastProvider>
        <Capture />
      </ToastProvider>,
    );
  const press = (name: string) =>
    act(async () => {
      fireEvent.click(screen.getByRole("button", { name }));
    });
  const ask = { title: "Remove the leader?", confirmLabel: "Remove leader" };

  it("declines a second identical ask and keeps the one dialog", async () => {
    mount();
    let first: Promise<boolean> = Promise.resolve(false);
    let second: Promise<boolean> = Promise.resolve(true);
    await act(async () => {
      first = confirm(ask);
      second = confirm({ ...ask });
    });

    expect(await second).toBe(false);
    expect(screen.getAllByRole("dialog")).toHaveLength(1);
    await press("Remove leader");

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(await first).toBe(true);
  });

  it("still queues a different ask behind the open one", async () => {
    mount();
    let second: Promise<boolean> = Promise.resolve(true);
    await act(async () => {
      void confirm(ask);
      second = confirm({ ...ask, title: "Remove the member?" });
    });
    await press("Cancel");

    expect(
      screen.getByRole("dialog", { name: "Remove the member?" }),
    ).toBeTruthy();
    await press("Cancel");
    expect(await second).toBe(false);
  });

  it("asks again once the first identical ask is answered", async () => {
    mount();
    await act(async () => {
      void confirm(ask);
    });
    await press("Cancel");
    let again: Promise<boolean> = Promise.resolve(false);
    await act(async () => {
      again = confirm({ ...ask });
    });
    await press("Remove leader");

    expect(await again).toBe(true);
  });
});
