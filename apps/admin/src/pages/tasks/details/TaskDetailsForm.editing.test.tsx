import { makeEvent } from "@alliance/shared/lib/testFixtures";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { makeParsedAction } from "../../../lib/testing/parsedAction";
import { renderForm } from "./renderDetailsForm";
import {
  PUBLIC_ONLY_CONFIRM,
  STAFF_PREVIEW_CONFIRM,
} from "./VisibilitySection";

const value = (label: RegExp) =>
  screen.getByLabelText<
    HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
  >(label).value;
const checked = (label: RegExp) =>
  screen.getByLabelText<HTMLInputElement>(label).checked;

describe("TaskDetailsForm editing", () => {
  it("shows the stored values and forwards edits", () => {
    const { edits, editor } = renderForm();

    expect(value(/^Name/)).toBe("Call your rep");
    expect(value(/^Task page description/)).toBe("Intro");
    expect(value(/^Visibility once launched/)).toBe("all_members");
    expect(value(/^Time estimate \(min\)/)).toBe("10");
    expect(checked(/^Optional/)).toBe(true);
    expect(checked(/^Page opens to anyone with the link/)).toBe(false);

    fireEvent.change(screen.getByLabelText(/^Name/), {
      target: { value: "Write your rep" },
    });
    fireEvent.change(screen.getByLabelText(/^Task page description/), {
      target: { value: "Hi" },
    });
    fireEvent.change(screen.getByLabelText(/^Visibility once launched/), {
      target: { value: "public" },
    });
    fireEvent.change(screen.getByLabelText(/^Time estimate \(min\)/), {
      target: { value: "5" },
    });
    fireEvent.change(screen.getByLabelText(/^Custom stat label/), {
      target: { value: "Invites" },
    });
    fireEvent.click(screen.getByLabelText(/^Optional/));
    expect(edits).toEqual([
      ["name", "Write your rep"],
      ["body", "Hi"],
      ["visibilityMode", "public"],
      ["timeEstimate", "5"],
      ["customStatLabel", "Invites"],
      ["optional", false],
    ]);

    fireEvent.paste(screen.getByLabelText(/^Task page description/), {
      clipboardData: {
        getData: (type: string) => (type === "text/html" ? "<b>Hi</b>" : ""),
      },
    });
    expect(edits.at(-1)).toEqual(["body", "Intro**Hi**"]);

    const cover = new File(["x"], "cover.png", { type: "image/png" });
    fireEvent.change(screen.getByLabelText("Cover image"), {
      target: { files: [cover] },
    });
    expect(editor.pickCoverImage).toHaveBeenCalledWith(cover);

    fireEvent.click(
      screen.getByRole("button", { name: "Environmental destruction" }),
    );
    expect(editor.handleCategoryChange).toHaveBeenCalledWith(["environment"]);
  });

  it.each([
    [
      "public-only",
      /^Page opens to anyone with the link/,
      PUBLIC_ONLY_CONFIRM,
      "publicOnly",
    ],
    ["staff preview", /^Staff preview/, STAFF_PREVIEW_CONFIRM, "staffPreview"],
  ])(
    "asks before turning %s on, and sets it only once confirmed",
    async (_, label, ask, field) => {
      const { edits } = renderForm();

      fireEvent.click(screen.getByLabelText(label));
      await screen.findByRole("dialog", { name: ask.title });
      fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
      await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
      expect(edits).toEqual([]);

      fireEvent.click(screen.getByLabelText(label));
      fireEvent.click(
        await screen.findByRole("button", { name: ask.confirmLabel }),
      );
      await waitFor(() => expect(edits).toEqual([[field, true]]));
    },
  );

  it("holds staff preview off once Members taking action has started", () => {
    renderForm({
      task: makeParsedAction({ events: [makeEvent()] }),
    });

    expect(
      screen.getByLabelText<HTMLInputElement>(/^Staff preview/).disabled,
    ).toBe(true);
    screen.getByText(
      "Members taking action has started, so staff preview no longer applies.",
    );
  });

  it("lets staff preview be cleared once started, and says what leaving it on does", () => {
    renderForm({
      form: { staffPreview: true },
      task: makeParsedAction({ events: [makeEvent()], staffPreview: true }),
    });

    expect(
      screen.getByLabelText<HTMLInputElement>(/^Staff preview/).disabled,
    ).toBe(false);
    screen.getByText(
      /The setting is still on: a duplicate starts in staff preview\.$/,
    );
  });

  it("says moving the start later turns staff preview back on only for a task in a suite", () => {
    renderForm({
      form: { staffPreview: true },
      task: makeParsedAction({
        events: [makeEvent()],
        staffPreview: true,
        suite: {
          id: 9,
          name: "Live suite",
          createdAt: "2026-01-02T00:00:00.000Z",
          updatedAt: "2026-01-02T00:00:00.000Z",
          events: [],
        },
      }),
    });

    screen.getByText(
      /a duplicate starts in staff preview, and moving the suite's Members taking action later turns it back on\.$/,
    );
  });

  it("lets a saved staff preview that was cleared once started be ticked again, without asking", async () => {
    const { edits } = renderForm({
      form: { staffPreview: false },
      task: makeParsedAction({ events: [makeEvent()], staffPreview: true }),
    });

    fireEvent.click(screen.getByLabelText(/^Staff preview/));
    await waitFor(() => expect(edits).toEqual([["staffPreview", true]]));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("lets an unsaved staff preview be cleared once Members taking action has started", () => {
    renderForm({
      form: { staffPreview: true },
      task: makeParsedAction({ events: [makeEvent()], staffPreview: false }),
    });

    expect(
      screen.getByLabelText<HTMLInputElement>(/^Staff preview/).disabled,
    ).toBe(false);
  });

  it("turns public-only and staff preview off without asking", () => {
    const { edits } = renderForm({
      form: { publicOnly: true, staffPreview: true },
    });

    fireEvent.click(
      screen.getByLabelText(/^Page opens to anyone with the link/),
    );
    fireEvent.click(screen.getByLabelText(/^Staff preview/));

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(edits).toEqual([
      ["publicOnly", false],
      ["staffPreview", false],
    ]);
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
    const cancelCoverImage = jest.fn();
    renderForm({
      form: { image: "cover.png" },
      task: makeParsedAction({}),
      lookups: { suitesLoading: true },
      editor: {
        cancelCoverImage,
        imageUploading: true,
        imageError: "Too big",
        imagePreview: "blob:preview",
      },
    });

    expect(screen.getByText("Loading suites…")).toBeTruthy();
    fireEvent.click(
      screen.getByRole("button", {
        name: "Cancel the upload and keep the current image",
      }),
    );
    expect(cancelCoverImage).toHaveBeenCalledTimes(1);
    expect(screen.getByText("Too big")).toBeTruthy();
    expect(screen.getByAltText<HTMLImageElement>("Cover image").src).toBe(
      "blob:preview",
    );
  });

  it("shows no cover image until there is one", () => {
    renderForm({ task: makeParsedAction({}) });

    expect(screen.queryByAltText("Cover image")).toBeNull();
  });
});
