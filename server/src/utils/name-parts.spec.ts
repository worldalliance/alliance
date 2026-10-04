import { nameParts } from "./name-parts";

describe("nameParts", () => {
  it.each([
    ["Jane Doe", "Jane", "Doe"],
    ["Jane Q Doe", "Jane", "Doe"],
    ["Jane", "Jane", ""],
    ["Jane ", "Jane", ""],
    ["", "", ""],
  ])("splits %p", (name, firstname, lastname) => {
    expect(nameParts(name)).toEqual({ firstname, lastname });
  });
});
