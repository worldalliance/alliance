/** A single-word name is all first name. */
export function nameParts(name: string): {
  firstname: string;
  lastname: string;
} {
  const names = name.split(" ");
  return names.length < 2
    ? { firstname: name, lastname: "" }
    : { firstname: names[0], lastname: names[names.length - 1] };
}
