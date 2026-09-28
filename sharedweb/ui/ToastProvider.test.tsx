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
});
