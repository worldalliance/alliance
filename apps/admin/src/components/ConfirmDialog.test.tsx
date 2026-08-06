import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import ConfirmDialog from "./ConfirmDialog";

afterEach(cleanup);

const renderDialog = (
  overrides: Partial<React.ComponentProps<typeof ConfirmDialog>> = {},
) => {
  const props = {
    isOpen: true,
    title: "Confirm group assignments",
    message: "3 members will be moved.",
    onConfirm: jest.fn(),
    onCancel: jest.fn(),
    ...overrides,
  };
  render(<ConfirmDialog {...props} />);
  return props;
};

describe("ConfirmDialog", () => {
  it("renders nothing while closed", () => {
    renderDialog({ isOpen: false });

    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("confirms on Enter while the panel itself holds focus", () => {
    const { onConfirm } = renderDialog();

    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Enter" });

    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("leaves Enter alone once focus is on a control inside", () => {
    const { onConfirm } = renderDialog();

    fireEvent.keyDown(screen.getByRole("button", { name: "Cancel" }), {
      key: "Enter",
    });
    fireEvent.keyDown(screen.getByRole("button", { name: "Confirm" }), {
      key: "Enter",
    });

    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("ignores the repeats of a held Enter", () => {
    const { onConfirm } = renderDialog();

    fireEvent.keyDown(screen.getByRole("dialog"), {
      key: "Enter",
      repeat: true,
    });

    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("ignores Shift+Enter", () => {
    const { onConfirm } = renderDialog();

    fireEvent.keyDown(screen.getByRole("dialog"), {
      key: "Enter",
      shiftKey: true,
    });

    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("confirms through its footer button", () => {
    const { onConfirm } = renderDialog();

    fireEvent.click(screen.getByRole("button", { name: "Confirm" }));

    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("cancels through its footer button", () => {
    const { onCancel } = renderDialog();

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("offers both choices as labelled buttons", () => {
    renderDialog();

    expect(screen.getByRole("button", { name: "Cancel" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Confirm" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Close" })).toBeNull();
  });

  it("cancels on Escape", () => {
    const { onCancel } = renderDialog();

    fireEvent.keyDown(document, { key: "Escape" });

    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("stays put on a backdrop click", () => {
    const { onCancel } = renderDialog();

    const outside = screen.getByRole("dialog").parentElement;
    if (!outside) throw new Error("dialog positioning wrapper not found");
    fireEvent.click(outside);

    expect(onCancel).not.toHaveBeenCalled();
  });

  describe("while loading", () => {
    it("disables both of its buttons", () => {
      renderDialog({ isLoading: true });

      const confirm = screen.getByRole("button", { name: "Updating..." });
      const cancel = screen.getByRole("button", { name: "Cancel" });

      expect(confirm.hasAttribute("disabled")).toBe(true);
      expect(cancel.hasAttribute("disabled")).toBe(true);
    });

    it("ignores Enter", () => {
      const { onConfirm } = renderDialog({ isLoading: true });

      fireEvent.keyDown(screen.getByRole("dialog"), { key: "Enter" });

      expect(onConfirm).not.toHaveBeenCalled();
    });

    it("ignores Escape", () => {
      const { onCancel } = renderDialog({ isLoading: true });

      fireEvent.keyDown(document, { key: "Escape" });

      expect(onCancel).not.toHaveBeenCalled();
    });
  });
});
