import { cleanup, render, screen } from "@testing-library/react";
import { TagEditor } from "./CohortExpressionBuilder";

afterEach(cleanup);

const availableTags = [
  {
    id: "tag-1",
    name: "non-US",
    description: "",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    users: [],
  },
];

const renderTagEditor = (
  tagId: string,
  { tagsLoading = false, tagsError = false } = {},
) =>
  render(
    <TagEditor
      value={{ type: "Tag", tagId }}
      onChange={jest.fn()}
      availableTags={availableTags}
      tagsLoading={tagsLoading}
      tagsError={tagsError}
    />,
  );

const selectedLabel = () =>
  screen.getByRole<HTMLSelectElement>("combobox").selectedOptions[0]
    .textContent;

describe("TagEditor", () => {
  it("shows the selected tag's name", () => {
    renderTagEditor("tag-1");

    expect(selectedLabel()).toBe("non-US");
  });

  it("shows a tag that no longer exists as deleted rather than unset", () => {
    renderTagEditor("gone");

    expect(selectedLabel()).toBe("Deleted tag");
  });

  it("does not call a tag deleted while tags are loading", () => {
    renderTagEditor("gone", { tagsLoading: true });

    expect(selectedLabel()).toBe("Loading tags...");
  });

  it("does not call a tag deleted when the tags failed to load", () => {
    renderTagEditor("gone", { tagsError: true });

    expect(selectedLabel()).toBe("Couldn't load tags");
  });
});
