import type { AnyField } from "@alliance/common/forms/form-schema";
import { dropUnuploadedFileAnswers } from "./fileAnswers";

const fileField = (id: string): AnyField =>
  ({ id, kind: "file", label: id }) as AnyField;

const fields = new Map<string, AnyField>([
  ["photo", fileField("photo")],
  ["name", { id: "name", kind: "text", label: "Name" } as AnyField],
  [
    "pets",
    {
      id: "pets",
      kind: "list",
      label: "Pets",
      fields: [
        fileField("pic"),
        { id: "petName", kind: "text", label: "Name" },
      ],
    } as AnyField,
  ],
]);

const drop = (answers: Parameters<typeof dropUnuploadedFileAnswers>[0]) =>
  dropUnuploadedFileAnswers(answers, fields);

describe("dropUnuploadedFileAnswers", () => {
  it("keeps an uploaded image key", () => {
    expect(drop({ photo: "abc.webp" })).toEqual({ photo: "abc.webp" });
  });

  it("drops a local pick an older client stored as the answer", () => {
    expect(drop({ photo: "file:///var/tmp/IMG_0001.HEIC" })).toEqual({});
    expect(drop({ photo: "ph://1A2B3C" })).toEqual({});
    expect(drop({ photo: "data:image/png;base64,aaa" })).toEqual({});
  });

  it("drops local picks inside list cards", () => {
    expect(
      drop({
        pets: [
          { pic: "file:///var/tmp/a.jpg", petName: "Rex" },
          { pic: "abc.webp" },
        ],
      }),
    ).toEqual({ pets: [{ petName: "Rex" }, { pic: "abc.webp" }] });
  });

  it("leaves answers for other kinds of field alone", () => {
    expect(drop({ name: "file://not-a-file-field" })).toEqual({
      name: "file://not-a-file-field",
    });
  });
});
