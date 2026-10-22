import { isPostAuthor, postBylineAuthors } from "./postAuthors";

const creator = { id: 1 };
const coAuthor = { id: 2 };

describe("postBylineAuthors", () => {
  it("credits the co-author list when set", () => {
    expect(postBylineAuthors({ author: creator, authors: [coAuthor] })).toEqual(
      [coAuthor],
    );
  });

  it("falls back to the creator when the list is empty or not loaded", () => {
    expect(postBylineAuthors({ author: creator, authors: [] })).toEqual([
      creator,
    ]);
    expect(postBylineAuthors({ author: creator })).toEqual([creator]);
  });

  it("credits nobody when neither is loaded", () => {
    expect(postBylineAuthors({})).toEqual([]);
  });
});

describe("isPostAuthor", () => {
  const post = { authorId: creator.id, authorIds: [coAuthor.id] };

  it("accepts a co-author", () => {
    expect(isPostAuthor(post, coAuthor.id)).toBe(true);
  });

  it("accepts the creator when the co-author list leaves them out", () => {
    expect(isPostAuthor(post, creator.id)).toBe(true);
  });

  it("rejects anyone else and a signed-out viewer", () => {
    expect(isPostAuthor(post, 3)).toBe(false);
    expect(isPostAuthor(post, undefined)).toBe(false);
  });
});
