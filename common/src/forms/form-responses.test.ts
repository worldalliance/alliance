import { describe, expect, it } from "bun:test";
import { R } from "../result";
import { readFormAnswers, readStoredFormAnswers } from "./form-responses";

const legacyCity = {
  id: 2988507,
  name: "Paris",
  admin1: "Île-de-France",
  countryCode: "FR",
  countryName: "France",
  latitude: 48.85,
  longitude: 2.35,
};

const city = {
  id: 2988507,
  name: "Paris",
  admin1: "Île-de-France",
  countryCode: "FR",
  countryName: "France",
};

describe("readStoredFormAnswers", () => {
  it("reads a city saved with keys a new answer can't have", () => {
    expect(R.isFailure(readFormAnswers({ home: legacyCity }))).toBe(true);
    expect(
      R.unwrap(
        readStoredFormAnswers({
          home: legacyCity,
          trips: [{ where: legacyCity, days: 3 }],
        }),
      ),
    ).toEqual({ home: city, trips: [{ where: city, days: 3 }] });
  });

  it("still rejects a value no question stores", () => {
    expect(R.isFailure(readStoredFormAnswers({ home: { id: "x" } }))).toBe(
      true,
    );
  });
});
