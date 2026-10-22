import { nameParts } from "./nameParts";

describe("nameParts", () => {
  it.each([
    ["Jane Doe", "Jane", "Doe"],
    ["Jane Q Doe", "Jane", "Doe"],
    ["Jane", "Jane", ""],
    ["Jane ", "Jane", ""],
    [" Jane  Doe ", "Jane", "Doe"],
    ["Jane\tDoe", "Jane", "Doe"],
    ["", "", ""],
    ["   ", "", ""],
  ])("splits %p", (name, firstname, lastname) => {
    expect(nameParts(name)).toEqual({ firstname, lastname });
  });
});
