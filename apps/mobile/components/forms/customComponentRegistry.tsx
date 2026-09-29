import {
  buildCustomComponentRegistry,
  CustomComponentId,
} from "@alliance/shared/forms/customComponents";
import ExampleContractComponent from "./ExampleContractComponent";
import ShareInfoPubliclyToggleComponent from "./ShareInfoPubliclyToggleComponent";
import ShareUrlComponent from "./ShareUrlComponent";

export const customComponentRegistry = buildCustomComponentRegistry({
  [CustomComponentId.ExampleContract]: ExampleContractComponent,
  [CustomComponentId.ActionShareUrl]: ShareUrlComponent,
  [CustomComponentId.ShareUrl]: ShareUrlComponent,
  [CustomComponentId.ShareInfoPubliclyToggle]: ShareInfoPubliclyToggleComponent,
});

export const getCustomComponentById = (id: string | undefined | null) =>
  customComponentRegistry.find((component) => component.id === id);
