import { rowKey } from "@alliance/common/forms/row-list";
import type { RowList } from "@alliance/common/forms/row-list-schema";
import { pickBalancedRow } from "./form-row-pick";

const list: RowList = {
  rows: [
    { name: "Springfield", type: "City" },
    { name: "Springfield", type: "County" },
    { name: "Shelbyville", type: "City" },
  ],
  keyFields: ["name", "type"],
};
const [city, county, shelbyville] = list.rows.map((row) =>
  rowKey(row, list.keyFields),
);

describe("pickBalancedRow", () => {
  it("picks the row with the fewest holders", () => {
    const picked = pickBalancedRow({
      list,
      holdersByKey: new Map([
        [city, 3],
        [county, 1],
        [shelbyville, 2],
      ]),
      random: () => 0,
    });
    expect(picked).toEqual({ key: county, values: list.rows[1] });
  });

  it("counts a row nobody holds as zero", () => {
    const picked = pickBalancedRow({
      list,
      holdersByKey: new Map([
        [city, 1],
        [county, 1],
      ]),
      random: () => 0.99,
    });
    expect(picked.key).toBe(shelbyville);
  });

  it("spreads ties by the random draw", () => {
    const pick = (draw: number) =>
      pickBalancedRow({ list, holdersByKey: new Map(), random: () => draw })
        .key;
    expect([pick(0), pick(0.5), pick(0.99)]).toEqual([
      city,
      county,
      shelbyville,
    ]);
  });

  it("ignores holders of rows the list no longer has", () => {
    const picked = pickBalancedRow({
      list,
      holdersByKey: new Map([
        ['["Gone","City"]', 0],
        [city, 1],
        [county, 1],
        [shelbyville, 1],
      ]),
      random: () => 0,
    });
    expect(picked.key).toBe(city);
  });
});
