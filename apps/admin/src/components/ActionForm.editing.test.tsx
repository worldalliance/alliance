import { fireEvent, screen } from "@testing-library/react";
import { renderForm } from "../lib/testing/renderActionForm";

describe("ActionForm editing", () => {
  it("shows the stored values and forwards edits", () => {
    const { edits, onImageChange, onCategoryChange } = renderForm();

    const value = (label: string | RegExp) =>
      screen.getByLabelText<
        HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
      >(label).value;
    const checked = (label: RegExp) =>
      screen.getByLabelText<HTMLInputElement>(label).checked;
    expect(value("Name")).toBe("Call your rep");
    expect(value("Action page description")).toBe("Intro");
    expect(value("Visibility Mode")).toBe("all_members");
    expect(value("Time Estimate (min)")).toBe("10");
    expect(checked(/^Optional/)).toBe(true);
    expect(checked(/^Public Only/)).toBe(false);

    fireEvent.change(screen.getByLabelText("Name"), {
      target: { value: "Write your rep" },
    });
    fireEvent.change(screen.getByLabelText("Action page description"), {
      target: { value: "Hi" },
    });
    fireEvent.change(screen.getByLabelText("Visibility Mode"), {
      target: { value: "public" },
    });
    fireEvent.change(screen.getByLabelText("Time Estimate (min)"), {
      target: { value: "5" },
    });
    fireEvent.change(screen.getByLabelText("Custom Stat Label"), {
      target: { value: "Invites" },
    });
    fireEvent.click(screen.getByLabelText(/^Public Only/));
    fireEvent.click(screen.getByLabelText(/^Optional/));
    expect(edits).toEqual([
      ["name", "Write your rep"],
      ["body", "Hi"],
      ["visibilityMode", "public"],
      ["timeEstimate", "5"],
      ["customStatLabel", "Invites"],
      ["publicOnly", true],
      ["optional", false],
    ]);

    fireEvent.paste(screen.getByLabelText("Action page description"), {
      clipboardData: {
        getData: (type: string) => (type === "text/html" ? "<b>Hi</b>" : ""),
      },
    });
    expect(edits.at(-1)).toEqual(["body", "Intro**Hi**"]);

    fireEvent.change(screen.getByLabelText("Cover image"), {
      target: { files: [new File(["x"], "cover.png", { type: "image/png" })] },
    });
    expect(onImageChange).toHaveBeenCalledTimes(1);

    fireEvent.click(
      screen.getByRole("button", { name: "Environmental destruction" }),
    );
    expect(onCategoryChange).toHaveBeenCalledWith(["environment"]);
  });

  it("shows the stored categories", () => {
    renderForm({ form: { category: ["poverty"] } });

    expect(
      screen
        .getByRole("button", { name: "Extreme poverty" })
        .getAttribute("aria-pressed"),
    ).toBe("true");
    expect(
      screen
        .getByRole("button", { name: "Environmental destruction" })
        .getAttribute("aria-pressed"),
    ).toBe("false");
  });

  it("shows suite loading and the cover image's upload, error, and preview", () => {
    const onCancelImageUpload = jest.fn();
    renderForm({
      form: { image: "cover.png" },
      props: {
        isNew: false,
        baseUrl: "https://api.example",
        onCancelImageUpload,
        suitesLoading: true,
        imageUploading: true,
        imageError: "Too big",
        imagePreview: "blob:preview",
      },
    });

    expect(screen.getByText("Fetching suites...")).toBeTruthy();
    fireEvent.click(
      screen.getByRole("button", {
        name: "Cancel the upload and keep the current image",
      }),
    );
    expect(onCancelImageUpload).toHaveBeenCalledTimes(1);
    expect(screen.getByText("Too big")).toBeTruthy();
    expect(screen.getByAltText<HTMLImageElement>("Preview").src).toBe(
      "blob:preview",
    );
    expect(screen.queryByAltText("Current")).toBeNull();
  });

  it("shows the current cover image when editing", () => {
    renderForm({
      form: { image: "cover.png" },
      props: { isNew: false, baseUrl: "https://api.example" },
    });

    expect(screen.getByAltText<HTMLImageElement>("Current").src).toBe(
      "https://api.example/images/cover.png",
    );
  });

  it("shows no current cover image on a new action", () => {
    renderForm({
      form: { image: "cover.png" },
      props: { baseUrl: "https://api.example" },
    });

    expect(screen.queryByAltText("Current")).toBeNull();
  });
});
