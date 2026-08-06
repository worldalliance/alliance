import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { useState, type ReactElement } from "react";
import Modal, {
  MODAL_CLOSE_GUTTER,
  ModalDescription,
  ModalHeader,
  ModalTitle,
} from "./Modal";

afterEach(cleanup);

function outsideDialog(): HTMLElement {
  const dialog = screen.getByRole("dialog");
  const outside = dialog.parentElement;
  if (!outside) throw new Error("dialog positioning wrapper not found");
  return outside;
}

// Under bun + happy-dom, `waitFor` starves its timers and takes seconds to
// observe focus changes. Polling inside `act` observes them promptly without
// leaking act() warnings.
async function waitForCondition(
  check: () => boolean,
  timeoutMs = 2_000,
): Promise<void> {
  const deadline = performance.now() + timeoutMs;
  while (!check()) {
    if (performance.now() > deadline) {
      throw new Error(`condition still false after ${timeoutMs}ms`);
    }
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));
    });
  }
}

function modalHeader(): HTMLElement {
  const header = screen
    .getByRole("dialog")
    .querySelector<HTMLElement>("[data-modal-header]");
  if (!header) throw new Error("modal header not found");
  return header;
}

describe("Modal", () => {
  it("uses the supplied accessible name and initially focuses the panel", async () => {
    render(
      <Modal onClose={() => {}} ariaLabel="Choose a form">
        <button>Choose</button>
      </Modal>,
    );

    const dialog = screen.getByRole("dialog", { name: "Choose a form" });
    await waitForCondition(() => document.activeElement === dialog);
  });

  it("takes its accessible name from ModalTitle without threading an id", () => {
    render(
      <Modal onClose={() => {}}>
        <ModalTitle>Reassign snapshots</ModalTitle>
      </Modal>,
    );

    expect(
      screen.getByRole("dialog", { name: "Reassign snapshots" }),
    ).toBeTruthy();
  });

  it("describes the panel from ModalDescription without threading an id", () => {
    render(
      <Modal onClose={() => {}}>
        <ModalTitle>Reassign snapshots</ModalTitle>
        <ModalDescription>Pick the variant to repoint.</ModalDescription>
      </Modal>,
    );

    expect(
      screen.getByRole("dialog", {
        name: "Reassign snapshots",
        description: "Pick the variant to repoint.",
      }),
    ).toBeTruthy();
  });

  it("keeps the ModalTitle name when the panel renders a custom element", () => {
    render(
      <Modal onClose={() => {}}>
        <ModalTitle render={<h3 />}>Confirm assignments</ModalTitle>
      </Modal>,
    );

    const title = screen.getByRole("heading", { name: "Confirm assignments" });
    expect(title.tagName).toBe("H3");
    expect(
      screen.getByRole("dialog", { name: "Confirm assignments" }),
    ).toBeTruthy();
  });

  it("dismisses on Escape by default", () => {
    const onClose = jest.fn();
    render(
      <Modal onClose={onClose} ariaLabel="Test dialog">
        Content
      </Modal>,
    );

    fireEvent.keyDown(document, { key: "Escape" });

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("reports panel-level keydowns as targeting the panel itself", () => {
    const seen: boolean[] = [];
    render(
      <Modal
        onClose={() => {}}
        ariaLabel="Test dialog"
        onKeyDown={(e) => seen.push(e.target === e.currentTarget)}
      >
        <button>Inside</button>
      </Modal>,
    );

    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Enter" });

    expect(seen).toEqual([true]);
  });

  it("distinguishes keydowns from controls inside the panel", () => {
    const seen: boolean[] = [];
    render(
      <Modal
        onClose={() => {}}
        ariaLabel="Test dialog"
        onKeyDown={(e) => seen.push(e.target === e.currentTarget)}
      >
        <button>Inside</button>
      </Modal>,
    );

    fireEvent.keyDown(screen.getByRole("button", { name: "Inside" }), {
      key: "Enter",
    });

    expect(seen).toEqual([false]);
  });

  it("dismisses through its semantic close control", () => {
    const onClose = jest.fn();
    render(
      <Modal onClose={onClose} ariaLabel="Test dialog">
        <ModalHeader>Header</ModalHeader>
      </Modal>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Close" }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("omits the close control when the modal offers no close route", () => {
    render(
      <Modal onClose={() => {}} ariaLabel="Test dialog" showClose={false}>
        <ModalHeader>
          <ModalTitle>Confirm</ModalTitle>
        </ModalHeader>
      </Modal>,
    );

    expect(screen.queryByRole("button", { name: "Close" })).toBeNull();
    expect(modalHeader().classList.contains(MODAL_CLOSE_GUTTER)).toBe(false);
  });

  it("suspends every dismissal route while dismissal is disabled", () => {
    const onClose = jest.fn();
    render(
      <Modal onClose={onClose} ariaLabel="Test dialog" dismissDisabled>
        <ModalHeader>Header</ModalHeader>
      </Modal>,
    );

    const close = screen.getByRole("button", { name: "Close" });
    expect(close.hasAttribute("disabled")).toBe(true);
    fireEvent.click(close);
    fireEvent.keyDown(document, { key: "Escape" });
    fireEvent.click(outsideDialog());

    expect(onClose).not.toHaveBeenCalled();
  });

  it("keeps the close button's gutter when the caller overrides padding", () => {
    render(
      <Modal onClose={() => {}} ariaLabel="Test dialog">
        <ModalHeader className="p-6">
          <ModalTitle>Confirm</ModalTitle>
        </ModalHeader>
      </Modal>,
    );

    // tailwind-merge drops the gutter if `p-6` comes later, so retaining both
    // proves the header applies its gutter after the caller's classes.
    const header = modalHeader();
    expect(header.classList.contains("p-6")).toBe(true);
    expect(header.classList.contains(MODAL_CLOSE_GUTTER)).toBe(true);
  });

  it("can prevent Escape dismissal", () => {
    const onClose = jest.fn();
    render(
      <Modal onClose={onClose} ariaLabel="Test dialog" dismissOnEscape={false}>
        Content
      </Modal>,
    );

    fireEvent.keyDown(document, { key: "Escape" });

    expect(onClose).not.toHaveBeenCalled();
  });

  it("dismisses on outside interaction by default", () => {
    const onClose = jest.fn();
    render(
      <Modal onClose={onClose} ariaLabel="Test dialog">
        Content
      </Modal>,
    );

    fireEvent.click(outsideDialog());

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("can prevent outside dismissal", () => {
    const onClose = jest.fn();
    render(
      <Modal
        onClose={onClose}
        ariaLabel="Test dialog"
        dismissOnBackdrop={false}
      >
        Content
      </Modal>,
    );

    fireEvent.click(outsideDialog());

    expect(onClose).not.toHaveBeenCalled();
  });

  it("restores focus after closing", async () => {
    const Example = () => {
      const [open, setOpen] = useState(false);
      return (
        <>
          <button onClick={() => setOpen(true)}>Open</button>
          {open && (
            <Modal onClose={() => setOpen(false)} ariaLabel="Test dialog">
              <button onClick={() => setOpen(false)}>Close</button>
            </Modal>
          )}
        </>
      );
    };

    render(<Example />);
    const trigger = screen.getByRole("button", { name: "Open" });
    trigger.focus();
    fireEvent.click(trigger);
    // Focus has to be seen leaving the trigger first, or a modal that never
    // took focus would satisfy the assertion below without restoring anything.
    await waitForCondition(() => document.activeElement !== trigger);
    fireEvent.click(screen.getByRole("button", { name: "Close" }));

    await waitForCondition(() => document.activeElement === trigger);
  });

  describe("accessible name", () => {
    const NO_NAME = "<Modal> renders no accessible name";

    // The warning is deferred a turn (see `useAccessibleNameWarning`), so both
    // its presence and its absence only settle once the timer has run.
    async function nameWarnings(ui: ReactElement): Promise<string[]> {
      const messages: string[] = [];
      const original = console.error;
      console.error = (...args: unknown[]) =>
        void messages.push(String(args[0]));
      try {
        render(ui);
        await new Promise((resolve) => setTimeout(resolve, 0));
      } finally {
        console.error = original;
      }
      return messages.filter((message) => message.startsWith(NO_NAME));
    }

    it("warns about a panel with neither a title nor an ariaLabel", async () => {
      expect(
        await nameWarnings(<Modal onClose={() => {}}>Content</Modal>),
      ).toHaveLength(1);
    });

    it("stays quiet when a ModalTitle names the panel", async () => {
      expect(
        await nameWarnings(
          <Modal onClose={() => {}}>
            <ModalTitle>Reassign snapshots</ModalTitle>
          </Modal>,
        ),
      ).toEqual([]);
    });

    it("stays quiet when ariaLabel names the panel", async () => {
      expect(
        await nameWarnings(
          <Modal onClose={() => {}} ariaLabel="Choose a form">
            Content
          </Modal>,
        ),
      ).toEqual([]);
    });
  });
});
