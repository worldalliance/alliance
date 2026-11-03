import { mergeOwned, type Owned } from "./ownedFields";

type Item = { name: string; detail: string };
const groups = { detail: ["detail"] } as const satisfies Record<
  "detail",
  readonly (keyof Item)[]
>;

const merge = (params: {
  current: Owned<Item, "detail"> | undefined;
  incoming: Item;
  revision: number;
  carriesDetail: boolean;
}) =>
  mergeOwned({
    current: params.current,
    incoming: params.incoming,
    revision: params.revision,
    carries: params.carriesDetail ? ["detail"] : [],
    groups,
  });

const stored = merge({
  current: undefined,
  incoming: { name: "newer", detail: "newer detail" },
  revision: 3,
  carriesDetail: true,
});

it("ignores a response older than everything it carries", () => {
  expect(
    merge({
      current: stored,
      incoming: { name: "older", detail: "older detail" },
      revision: 2,
      carriesDetail: true,
    }),
  ).toBeUndefined();
});

it("keeps a newer group when an older response carrying it lands later", () => {
  const listed = merge({
    current: stored,
    incoming: { name: "listed", detail: "" },
    revision: 4,
    carriesDetail: false,
  });
  expect(
    merge({
      current: listed,
      incoming: { name: "older", detail: "older detail" },
      revision: 2,
      carriesDetail: true,
    }),
  ).toBeUndefined();
  expect(listed?.value).toEqual({ name: "listed", detail: "newer detail" });
});

it("takes a group from an older response when nothing newer carried it", () => {
  const listed = merge({
    current: undefined,
    incoming: { name: "listed", detail: "" },
    revision: 4,
    carriesDetail: false,
  });
  expect(
    merge({
      current: listed,
      incoming: { name: "older", detail: "older detail" },
      revision: 2,
      carriesDetail: true,
    })?.value,
  ).toEqual({ name: "listed", detail: "older detail" });
});

it("takes a group from the newest response while none has carried it", () => {
  const listed = merge({
    current: undefined,
    incoming: { name: "first", detail: "first list" },
    revision: 1,
    carriesDetail: false,
  });
  expect(
    merge({
      current: listed,
      incoming: { name: "second", detail: "second list" },
      revision: 2,
      carriesDetail: false,
    })?.value,
  ).toEqual({ name: "second", detail: "second list" });
});
