import type { DisplayBlock } from "@alliance/common/forms/display-blocks";
import type { FormSchema } from "@alliance/common/forms/form-schema";
import {
  addressedWrite,
  findDisplayBlock,
  replaceDisplayBlock,
} from "./displayBlockById";

const images = (id: string, src: string): DisplayBlock => ({
  type: "display",
  kind: "images",
  id,
  images: [{ id: `${id}-1`, src }],
});

const schema: FormSchema = {
  pages: [
    { id: "page-1", title: "One", fields: [images("block-1", "one.webp")] },
    {
      id: "page-2",
      title: "Two",
      fields: [
        {
          type: "input",
          kind: "text",
          id: "field-1",
          label: "Name",
        },
        images("block-2", "two.webp"),
      ],
    },
  ],
  outputViews: [
    {
      type: "default",
      id: "view-1",
      blocks: [
        { id: "out-1", fieldId: "field-1" },
        images("block-3", "three.webp"),
      ],
    },
  ],
};

const record = () => {
  const calls: string[] = [];
  return { calls, write: (blockId: string) => (calls.push(blockId), true) };
};

describe("addressedWrite", () => {
  it("writes a display block by its id", () => {
    const { calls, write } = record();
    const update = addressedWrite(images("block-1", "one.webp"), write);
    if (!update) throw new Error("expected an addressed write");

    expect(update(() => ({}))).toBe(true);
    expect(calls).toEqual(["block-1"]);
  });

  it("leaves a question field unaddressed", () => {
    const field = schema.pages[1]?.fields[0];
    if (!field) throw new Error("missing field");
    expect(addressedWrite(field, record().write)).toBeUndefined();
  });

  it("leaves an output field block unaddressed", () => {
    const block = schema.outputViews[0]?.blocks[0];
    if (!block) throw new Error("missing block");
    expect(addressedWrite(block, record().write)).toBeUndefined();
  });

  it("leaves a block stored without an id unaddressed", () => {
    const { id: _id, ...withoutId } = images("block-1", "one.webp");
    expect(addressedWrite(withoutId, record().write)).toBeUndefined();
  });

  it("addresses every block findDisplayBlock answers to, and no other", () => {
    const { calls, write } = record();
    const items = [
      ...schema.pages.flatMap((page) => page.fields),
      ...schema.outputViews.flatMap((view) => view.blocks),
    ];
    const addressed = items.flatMap((item) => {
      const update = addressedWrite(item, write);
      return update ? [{ update, item }] : [];
    });

    expect(addressed).toHaveLength(3);
    for (const { update, item } of addressed) {
      update(() => ({}));
      const id = calls[calls.length - 1];
      if (!id) throw new Error("the write never landed");
      expect(findDisplayBlock(schema, id)).toBe(item);
    }
  });
});

describe("findDisplayBlock", () => {
  it("finds a block on a page the builder is not showing", () => {
    expect(findDisplayBlock(schema, "block-2")).toMatchObject({
      images: [{ src: "two.webp" }],
    });
  });

  it("finds a block in an output view", () => {
    expect(findDisplayBlock(schema, "block-3")).toMatchObject({
      images: [{ src: "three.webp" }],
    });
  });

  it("passes over an output field block sharing the id", () => {
    expect(findDisplayBlock(schema, "out-1")).toBeNull();
  });

  it("is null once the form no longer holds the block", () => {
    expect(findDisplayBlock(schema, "block-9")).toBeNull();
  });
});

const held = (blockId: string) => {
  const block = findDisplayBlock(schema, blockId);
  if (!block) throw new Error(`the form does not hold ${blockId}`);
  return block;
};

describe("replaceDisplayBlock", () => {
  it("swaps the block and leaves the rest of the form alone", () => {
    const next = replaceDisplayBlock({
      schema,
      target: held("block-2"),
      next: images("block-2", "swapped.webp"),
    });

    expect(next.pages[1]?.fields[1]).toMatchObject({
      images: [{ src: "swapped.webp" }],
    });
    expect(next.pages[1]?.fields[0]).toBe(schema.pages[1]?.fields[0]);
    expect(next.pages[0]?.fields[0]).toBe(schema.pages[0]?.fields[0]);
    expect(schema.pages[1]?.fields[1]).toMatchObject({
      images: [{ src: "two.webp" }],
    });
  });

  it("swaps a block in an output view", () => {
    const next = replaceDisplayBlock({
      schema,
      target: held("block-3"),
      next: images("block-3", "swapped.webp"),
    });

    expect(next.outputViews[0]?.blocks[1]).toMatchObject({
      images: [{ src: "swapped.webp" }],
    });
  });

  it("leaves a second block stored under the same id alone", () => {
    const twin = images("block-1", "twin.webp");
    const withTwin: FormSchema = {
      ...schema,
      pages: [
        ...schema.pages,
        { id: "page-3", title: "Three", fields: [twin] },
      ],
    };

    const next = replaceDisplayBlock({
      schema: withTwin,
      target: held("block-1"),
      next: images("block-1", "swapped.webp"),
    });

    expect(next.pages[0]?.fields[0]).toMatchObject({
      images: [{ src: "swapped.webp" }],
    });
    expect(next.pages[2]?.fields[0]).toBe(twin);
  });
});
