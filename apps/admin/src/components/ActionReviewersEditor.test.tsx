import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import ActionReviewersEditor, {
  type ReviewerRow,
} from "./ActionReviewersEditor";

afterEach(cleanup);

const renderEditor = (reviewers: ReviewerRow[]) => {
  const onReviewersChange = jest.fn();
  render(
    <ActionReviewersEditor
      reviewers={reviewers}
      onReviewersChange={onReviewersChange}
    />,
  );
  return onReviewersChange;
};

describe("ActionReviewersEditor", () => {
  it("shows Auto with the icon its link implies", () => {
    renderEditor([
      {
        key: "a",
        name: "Ada",
        url: "https://www.linkedin.com/in/ada",
        icon: "linkedin",
      },
    ]);

    const select = screen.getByRole<HTMLSelectElement>("combobox");
    expect(select.value).toBe("auto");
    expect(select.options[0].textContent).toBe("Icon: Auto (LinkedIn)");
  });

  it("keeps an auto icon tracking the link", () => {
    const onReviewersChange = renderEditor([{ key: "a", name: "Ada" }]);

    fireEvent.change(screen.getByPlaceholderText("Link (optional)"), {
      target: { value: "https://linkedin.com/in/ada" },
    });

    expect(onReviewersChange).toHaveBeenCalledWith([
      {
        key: "a",
        name: "Ada",
        url: "https://linkedin.com/in/ada",
        icon: "linkedin",
      },
    ]);
  });

  it("keeps an explicit icon when the link changes", () => {
    const onReviewersChange = renderEditor([
      { key: "a", name: "Ada", url: "https://ada.dev", icon: "linkedin" },
    ]);

    fireEvent.change(screen.getByPlaceholderText("Link (optional)"), {
      target: { value: "https://ada.example" },
    });

    expect(onReviewersChange).toHaveBeenCalledWith([
      { key: "a", name: "Ada", url: "https://ada.example", icon: "linkedin" },
    ]);
  });

  it("keeps an explicit icon the link does not imply", () => {
    const row: ReviewerRow = { key: "a", name: "Ada", url: "https://ada.dev" };
    const onReviewersChange = renderEditor([row]);

    fireEvent.change(screen.getByRole("combobox"), {
      target: { value: "linkedin" },
    });
    expect(onReviewersChange).toHaveBeenCalledWith([
      { ...row, icon: "linkedin" },
    ]);

    cleanup();
    renderEditor([{ ...row, icon: "linkedin" }]);
    expect(screen.getByRole<HTMLSelectElement>("combobox").value).toBe(
      "linkedin",
    );
  });

  it("renames only the edited row", () => {
    const onReviewersChange = renderEditor([
      { key: "a", name: "Ada" },
      { key: "b", name: "Grace" },
    ]);

    fireEvent.change(screen.getAllByPlaceholderText("Name")[0], {
      target: { value: "Ada Lovelace" },
    });

    expect(onReviewersChange).toHaveBeenCalledWith([
      { key: "a", name: "Ada Lovelace" },
      { key: "b", name: "Grace" },
    ]);
  });

  it("clears the icon when None is picked", () => {
    const onReviewersChange = renderEditor([
      {
        key: "a",
        name: "Ada",
        url: "https://linkedin.com/in/ada",
        icon: "linkedin",
      },
    ]);

    fireEvent.change(screen.getByRole("combobox"), {
      target: { value: "none" },
    });

    expect(onReviewersChange).toHaveBeenCalledWith([
      {
        key: "a",
        name: "Ada",
        url: "https://linkedin.com/in/ada",
        icon: undefined,
      },
    ]);
  });

  it("adds and removes rows", () => {
    const onReviewersChange = renderEditor([
      { key: "a", name: "Ada" },
      { key: "b", name: "Grace" },
    ]);

    fireEvent.click(screen.getAllByRole("button", { name: "Remove" })[0]);
    expect(onReviewersChange).toHaveBeenLastCalledWith([
      { key: "b", name: "Grace" },
    ]);

    fireEvent.click(screen.getByRole("button", { name: "+ Add reviewer" }));
    expect(onReviewersChange).toHaveBeenLastCalledWith([
      { key: "a", name: "Ada" },
      { key: "b", name: "Grace" },
      { key: expect.any(String), name: "" },
    ]);
  });
});
