/** An admin-set co-author list may leave out the creator, who then goes uncredited. */
export function postBylineAuthors<U>(post: { author?: U; authors?: U[] }): U[] {
  if (post.authors?.length) return post.authors;
  return post.author ? [post.author] : [];
}

/** The creator may edit and delete a post even when the byline leaves them out. */
export function isPostAuthor(
  post: { authorId: number; authorIds: number[] },
  userId: number | undefined,
): boolean {
  return (
    userId !== undefined &&
    (post.authorId === userId || post.authorIds.includes(userId))
  );
}
