import { CommentDto, PostTagDto } from "@alliance/shared/client";
import {
  buildTagChips,
  countCommentsByTag,
  matchesTagFilter,
} from "./commentTags";

const comment = (id: number, tagId: number | null) =>
  ({ id, tagId }) as CommentDto;

const tags: PostTagDto[] = [
  { id: 1, name: "Praise", sortOrder: 0 },
  { id: 2, name: "Gripes", sortOrder: 1 },
];

const comments = [comment(10, 1), comment(11, 1), comment(12, null)];

describe("countCommentsByTag", () => {
  it("counts each tag, the untagged remainder, and the total", () => {
    expect(countCommentsByTag(comments, tags)).toEqual({
      all: 3,
      untagged: 1,
      byTagId: { 1: 2, 2: 0 },
    });
  });
});

describe("matchesTagFilter", () => {
  it("shows everything with no filter, and only untagged for null", () => {
    expect(comments.filter((c) => matchesTagFilter(c, undefined))).toHaveLength(
      3,
    );
    expect(comments.filter((c) => matchesTagFilter(c, null))).toEqual([
      comment(12, null),
    ]);
    expect(comments.filter((c) => matchesTagFilter(c, 1))).toHaveLength(2);
  });
});

describe("buildTagChips", () => {
  it("offers an untagged chip so comments written before the tags stay reachable", () => {
    const counts = countCommentsByTag(comments, tags);
    expect(buildTagChips(tags, counts)).toEqual([
      { key: "all", value: undefined, label: "All (3)" },
      { key: "1", value: 1, label: "Praise (2)" },
      { key: "2", value: 2, label: "Gripes (0)" },
      { key: "untagged", value: null, label: "Untagged (1)" },
    ]);
  });

  it("drops the untagged chip once every comment carries a tag", () => {
    const tagged = [comment(10, 1), comment(11, 2)];
    const keys = buildTagChips(tags, countCommentsByTag(tagged, tags)).map(
      (chip) => chip.key,
    );
    expect(keys).toEqual(["all", "1", "2"]);
  });

  it("lists bare tag names for the picker", () => {
    expect(buildTagChips(tags)).toEqual([
      { key: "1", value: 1, label: "Praise" },
      { key: "2", value: 2, label: "Gripes" },
    ]);
  });
});
