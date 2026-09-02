import type { DisplayBlock } from "@alliance/common/forms/display-blocks";
import type { FormSchema } from "@alliance/common/forms/form-schema";
import { cleanup, renderHook } from "@testing-library/react";
import { useDisplayBlockWrite } from "./useDisplayBlockWrite";

const images = (id: string, ...srcs: string[]): DisplayBlock => ({
  type: "display",
  kind: "images",
  id,
  images: srcs.map((src) => ({ id: src, src })),
});

const form = (description: string, blocks: DisplayBlock[]): FormSchema => ({
  description,
  pages: [
    { id: "page-1", title: "One", fields: [] },
    { id: "page-2", title: "Two", fields: blocks },
  ],
  outputViews: [],
});

const appendImage =
  (src: string) =>
  (current: DisplayBlock): Partial<DisplayBlock> => {
    if (current.kind !== "images") {
      throw new Error(`wrote to a ${current.kind} block`);
    }
    return { images: [...current.images, { id: src, src }] };
  };

// `write` is the one the first render made, since an upload calls the handler
// it was handed renders ago.
const mount = (initial: FormSchema) => {
  const written: FormSchema[] = [];
  const view = renderHook(
    ({ schema }: { schema: FormSchema }) =>
      useDisplayBlockWrite(schema, (next) => written.push(next)),
    { initialProps: { schema: initial } },
  );
  return { written, view, write: view.result.current };
};

const blockIn = (schema: FormSchema, index = 0) =>
  schema.pages[1]?.fields[index];

afterEach(cleanup);

describe("useDisplayBlockWrite", () => {
  it("lands on the form the builder holds now", () => {
    const { written, view, write } = mount(
      form("first draft", [images("block-1", "one.webp")]),
    );

    view.rerender({
      schema: form("edited since", [images("block-1", "one.webp", "two.webp")]),
    });

    expect(write("block-1", appendImage("three.webp"))).toBe(true);
    expect(written).toHaveLength(1);
    const landed = written[0];
    if (!landed) throw new Error("the write never landed");
    expect(landed.description).toBe("edited since");
    expect(blockIn(landed)).toMatchObject({
      images: [{ src: "one.webp" }, { src: "two.webp" }, { src: "three.webp" }],
    });
  });

  it("leaves the rest of the form alone", () => {
    const { written, write } = mount(
      form("first draft", [images("block-1", "one.webp"), images("block-2")]),
    );

    write("block-1", appendImage("two.webp"));

    const landed = written[0];
    if (!landed) throw new Error("the write never landed");
    expect(blockIn(landed, 1)).toMatchObject({ id: "block-2", images: [] });
    expect(landed.pages[0]).toMatchObject({ id: "page-1", fields: [] });
  });

  // Two writes in one batch commit together, so there is no render between
  // them to hand the second what the first wrote.
  it("keeps both writes when two land in one batch", () => {
    const { written, write } = mount(
      form("first draft", [images("block-1"), images("block-2")]),
    );

    write("block-1", appendImage("one.webp"));
    write("block-2", appendImage("two.webp"));

    const landed = written[1];
    if (!landed) throw new Error("the second write never landed");
    expect(blockIn(landed, 0)).toMatchObject({ images: [{ src: "one.webp" }] });
    expect(blockIn(landed, 1)).toMatchObject({ images: [{ src: "two.webp" }] });
  });

  it("is false, and writes nothing, once the form has dropped the block", () => {
    const { written, view, write } = mount(
      form("first draft", [images("block-1", "one.webp")]),
    );

    view.rerender({ schema: form("first draft", []) });

    expect(write("block-1", appendImage("two.webp"))).toBe(false);
    expect(written).toEqual([]);
  });
});
