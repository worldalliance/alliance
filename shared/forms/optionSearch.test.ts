import { matchesOptionSearch } from "./optionSearch";

it("matches a trimmed, case-insensitive substring of labels", () => {
  expect(matchesOptionSearch({ label: "New York" }, "  w Yo  ")).toBe(true);
  expect(matchesOptionSearch({ label: "New York" }, "newyork")).toBe(false);
  expect(matchesOptionSearch({ label: "New York" }, "   ")).toBe(true);
});

it("treats punctuation literally and leaves option values out of search", () => {
  const option = { label: "C++ (advanced)", value: "internal-code" };
  expect(matchesOptionSearch(option, "++ (")).toBe(true);
  expect(matchesOptionSearch(option, "internal-code")).toBe(false);
  expect(matchesOptionSearch(option, ".*")).toBe(false);
});

it("matches accents in labels and queries regardless of Unicode composition", () => {
  expect(matchesOptionSearch({ label: "Côte d'Ivoire" }, "  COTE  ")).toBe(
    true,
  );
  expect(matchesOptionSearch({ label: "Cote d'Ivoire" }, "côte")).toBe(true);
  expect(matchesOptionSearch({ label: "Côte d'Ivoire" }, "co\u0302te")).toBe(
    true,
  );
  expect(matchesOptionSearch({ label: "Co\u0302te d'Ivoire" }, "cote")).toBe(
    true,
  );
});
