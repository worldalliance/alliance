/** A single-word name is all first name. */
export function nameParts(name: string): {
  firstname: string;
  lastname: string;
} {
  const names = name.trim().split(/\s+/);
  return {
    firstname: names[0],
    lastname: names.length < 2 ? "" : names[names.length - 1],
  };
}
