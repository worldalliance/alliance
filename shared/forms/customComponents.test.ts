import {
  buildCustomComponentRegistry,
  CustomComponentId,
} from "./customComponents";

const Example = () => null;
const Other = () => null;

const { customComponentRegistry, getCustomComponentById } =
  buildCustomComponentRegistry({
    [CustomComponentId.ExampleContract]: Example,
    [CustomComponentId.ActionShareUrl]: Other,
    [CustomComponentId.ShareUrl]: Other,
    [CustomComponentId.ShareInfoPubliclyToggle]: Other,
  });

it("lists every custom component once", () => {
  expect(customComponentRegistry.map((c) => c.id)).toEqual(
    Object.values(CustomComponentId),
  );
});

it("looks a component up by its id", () => {
  expect(
    getCustomComponentById(CustomComponentId.ExampleContract)?.component,
  ).toBe(Example);
  expect(getCustomComponentById("retired-component")).toBeUndefined();
  expect(getCustomComponentById(null)).toBeUndefined();
});
