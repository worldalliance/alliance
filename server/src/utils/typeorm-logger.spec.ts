import { Logger } from "@nestjs/common";
import { AppTypeOrmLogger } from "./typeorm-logger";

describe("AppTypeOrmLogger.logQueryError", () => {
  let error: jest.SpyInstance;

  beforeEach(() => {
    error = jest.spyOn(Logger.prototype, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    error.mockRestore();
  });

  it("logs parameter types, never their values", () => {
    new AppTypeOrmLogger().logQueryError(
      new Error("duplicate key"),
      'INSERT INTO "user" ("email", "age", "bio") VALUES ($1, $2, $3)',
      ["ada@example.com", 36, null],
    );

    const logged = JSON.stringify(error.mock.calls);
    expect(logged).not.toContain("ada@example.com");
    expect(error.mock.calls[0][0]).toMatchObject({
      params: ["string", "number", "null"],
    });
  });
});
