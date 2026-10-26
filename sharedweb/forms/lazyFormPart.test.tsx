import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { ErrorBoundary } from "react-error-boundary";
import { holdChunkReloads } from "../lib/lazyOrReload";
import { lazyFormPart } from "./lazyFormPart";

describe("a lazy form part", () => {
  let release: () => void;
  beforeEach(() => {
    sessionStorage.clear();
    release = holdChunkReloads();
    jest.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => release());

  const renderInForm = (Part: () => ReactNode) =>
    render(
      <ErrorBoundary fallback={<p>Form failed</p>}>
        <p>Rest of the form</p>
        <Part />
      </ErrorBoundary>,
    );

  it("shows in its place alone a chunk that didn't load", async () => {
    const Part = lazyFormPart<object>(() =>
      Promise.reject(new Error("Failed to fetch dynamically imported module")),
    );
    renderInForm(() => <Part />);

    expect(await screen.findByText(/Reload the page to show it/)).toBeTruthy();
    expect(screen.getByText("Rest of the form")).toBeTruthy();
  });

  it("leaves any other failure to the form's boundary", async () => {
    const Part = lazyFormPart<object>(async () => ({
      default: () => {
        throw new Error("broken part");
      },
    }));
    renderInForm(() => <Part />);

    expect(await screen.findByText("Form failed")).toBeTruthy();
  });
});
