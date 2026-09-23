import { formSchema } from "@alliance/common/forms/form-schema";
import { Logger } from "@nestjs/common";
import type { FormSnapshot } from "./entities/formsnapshot.entity";
import { formSchemaOf } from "./form-snapshot-schema";

let nextId = 1;

const snapshotWithOptions = (values: string[]): FormSnapshot => ({
  id: nextId++,
  hash: "hash",
  createdAt: new Date(0),
  schema: {
    pages: [
      {
        id: "page",
        fields: [
          {
            id: "field",
            type: "input",
            kind: "radio",
            label: "Field",
            options: values.map((value) => ({ label: value, value })),
          },
        ],
      },
    ],
    outputViews: [],
  },
});

describe("formSchemaOf", () => {
  let error: jest.SpyInstance;

  beforeEach(() => {
    error = jest.spyOn(Logger.prototype, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    error.mockRestore();
  });

  it("returns a valid schema without logging", () => {
    const snapshot = snapshotWithOptions(["a", "b"]);

    expect(formSchemaOf(snapshot)).toBe(snapshot.schema);
    expect(error).not.toHaveBeenCalled();
  });

  it("serves a schema that fails a refinement and logs its snapshot once, on one line", () => {
    const snapshot = snapshotWithOptions(["a", "b", "a"]);

    expect(formSchemaOf(snapshot)).toBe(snapshot.schema);
    expect(formSchemaOf(snapshot)).toBe(snapshot.schema);
    expect(error).toHaveBeenCalledTimes(1);
    expect(error.mock.calls[0][0]).toContain(`form snapshot ${snapshot.id}`);
    expect(error.mock.calls[0][0]).not.toContain("\n");
  });

  it("parses each snapshot id once", () => {
    const safeParse = jest.spyOn(formSchema, "safeParse");
    const snapshot = snapshotWithOptions(["a", "b"]);

    formSchemaOf(snapshot);
    formSchemaOf(snapshot);

    expect(safeParse).toHaveBeenCalledTimes(1);
    safeParse.mockRestore();
  });
});
