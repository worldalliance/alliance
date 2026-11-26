import { anyFieldSchema } from "@alliance/common/forms/form-schema";
import { createField } from "./createField";

const FIELD_KINDS = anyFieldSchema.options.map(
  (option) => option.shape.kind.value,
);

describe("createField", () => {
  it.each(FIELD_KINDS)("makes a valid %s field", (kind) => {
    const field = createField(kind, "field-1");
    expect(field).toMatchObject({ id: "field-1", kind });
    expect(anyFieldSchema.safeParse(field).success).toBe(true);
  });
});
