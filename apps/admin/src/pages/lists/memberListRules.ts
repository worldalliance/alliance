export const NEW = "new";

// The server parses ids with `ParseUUIDPipe`, so nothing else can exist.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const couldExist = (listId: string) => UUID.test(listId);

/** The paste box's error for entries that matched no member. */
export const unmatchedMessage = (unmatched: readonly string[]) =>
  unmatched.length === 0
    ? null
    : `${
        unmatched.length === 1
          ? "This matched no member, so it wasn't added: "
          : `These ${unmatched.length} matched no member, so they weren't added: `
      }${unmatched.join(", ")}`;
