import { act, cleanup, render, screen } from "@testing-library/react";
import { useEffect } from "react";
import { ToastProvider, useToast } from "./ToastProvider";

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
});
