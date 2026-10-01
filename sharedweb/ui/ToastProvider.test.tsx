import { act, cleanup, render, screen } from "@testing-library/react";
import { useEffect } from "react";
import { ToastPlacement, ToastProvider, useToast } from "./ToastProvider";

afterEach(cleanup);

let toast: ReturnType<typeof useToast>;

const CaptureToast = () => {
  const ctx = useToast();
  useEffect(() => {
    toast = ctx;
  }, [ctx]);
  return null;
};

function renderProvider() {
  render(
    <ToastProvider>
      <CaptureToast />
    </ToastProvider>,
  );
}

describe("ToastProvider", () => {
  it("labels a toast's dismiss button", () => {
    renderProvider();
    act(() => toast.success("Invite link copied"));
    expect(screen.getByRole("button", { name: "Dismiss" })).toBeTruthy();
  });

  it("keeps both live regions mounted before any toast", () => {
    renderProvider();
    expect(screen.getByRole("status").textContent).toBe("");
    expect(screen.getByRole("alert").textContent).toBe("");
  });

  it("announces only the added toast, not the whole region", () => {
    renderProvider();
    for (const role of ["status", "alert"]) {
      expect(screen.getByRole(role).getAttribute("aria-atomic")).toBe("false");
    }
  });

  it.each(["success", "info", "warning"] as const)(
    "announces a %s toast as a status",
    (variant) => {
      renderProvider();
      act(() => toast[variant]("Invite link copied"));
      expect(screen.getByRole("status").textContent).toContain(
        "Invite link copied",
      );
      expect(screen.getByRole("alert").textContent).toBe("");
    },
  );

  it("announces an error toast as an alert", () => {
    renderProvider();
    act(() => toast.error("Could not copy"));
    expect(screen.getByRole("alert").textContent).toContain("Could not copy");
    expect(screen.getByRole("status").textContent).toBe("");
  });

  it("keeps a confirm out of both live regions", () => {
    renderProvider();
    act(() => {
      void toast.confirm({ message: "Delete this invite?" });
    });
    expect(screen.getByText("Delete this invite?")).toBeTruthy();
    expect(screen.getByRole("status").textContent).toBe("");
    expect(screen.getByRole("alert").textContent).toBe("");
  });

  it("opens a confirm that requires typed text as a fullscreen modal", () => {
    renderProvider();
    act(() => {
      void toast.confirm({
        message: "Delete this group?",
        requiredText: "DELETE",
      });
    });
    expect(screen.getByPlaceholderText("DELETE")).toBeTruthy();
  });

  it.each([
    [
      ToastPlacement.Top,
      { top: "92px", left: "125px", transform: "translate(-50%, -100%)" },
    ],
    [
      ToastPlacement.Bottom,
      { top: "128px", left: "125px", transform: "translate(-50%, 0)" },
    ],
    [
      ToastPlacement.Left,
      { top: "110px", left: "42px", transform: "translate(-100%, -50%)" },
    ],
    [
      ToastPlacement.Right,
      { top: "110px", left: "208px", transform: "translate(0, -50%)" },
    ],
    [
      ToastPlacement.TopLeft,
      { top: "92px", left: "200px", transform: "translate(-100%, -100%)" },
    ],
    [
      ToastPlacement.TopRight,
      { top: "92px", left: "208px", transform: "translate(0, -100%)" },
    ],
    [
      ToastPlacement.BottomLeft,
      { top: "128px", left: "42px", transform: "translate(-100%, 0)" },
    ],
    [
      ToastPlacement.BottomRight,
      { top: "128px", left: "208px", transform: "translate(0, 0)" },
    ],
  ] as const)(
    "anchors a %s confirm beside its element",
    (placement, expected) => {
      const anchorEl = document.createElement("button");
      anchorEl.getBoundingClientRect = () => new DOMRect(50, 100, 150, 20);
      renderProvider();
      act(() => {
        void toast.confirm({
          message: "Delete this invite?",
          anchorEl,
          placement,
        });
      });
      const popover = screen
        .getByText("Delete this invite?")
        .closest("[style]");
      if (!(popover instanceof HTMLElement)) {
        throw new Error("confirm has no positioned container");
      }
      const { top, left, transform } = popover.style;
      expect({ top, left, transform }).toEqual(expected);
    },
  );
});
