import type { CustomComponentField } from "@alliance/common/forms/form-schema";
import type { ComponentType } from "react";
import type { UserDto } from "../client";

export type CustomComponentConfigFieldType = "string" | "number" | "boolean";

export interface CustomComponentConfigField {
  name: string;
  label?: string;
  description?: string;
  type: CustomComponentConfigFieldType;
  defaultValue?: string | number | boolean;
}

export interface CustomComponentProps {
  field: CustomComponentField;
  value: string | null;
  onChange: (value: string) => void;
  user?: Omit<UserDto, "email">;
  disabled?: boolean;
  isOutputView?: boolean;
  required?: boolean;
}

export enum CustomComponentId {
  ExampleContract = "example-contract",
  ActionShareUrl = "action-share-url",
  ShareUrl = "share-url",
  ShareInfoPubliclyToggle = "share-info-publicly-toggle",
}

export interface CustomComponentDefinition {
  id: CustomComponentId;
  label: string;
  description?: string;
  component: ComponentType<CustomComponentProps>;
  defaultValue?: string;
  configFields?: CustomComponentConfigField[];
}

const customComponentMetadata: Record<
  CustomComponentId,
  Omit<CustomComponentDefinition, "id" | "component">
> = {
  [CustomComponentId.ExampleContract]: {
    label: "Example Contract Component",
    description: "Example component showing use of user data",
  },
  [CustomComponentId.ActionShareUrl]: {
    label: "Action Share URL Component",
    description: "Component to share the URL of an action",
    configFields: [
      {
        name: "actionId",
        label: "Action ID",
        description:
          "Specify which action to reference. Defaults to the current action when left blank.",
        type: "number",
      },
    ],
  },
  [CustomComponentId.ShareUrl]: {
    label: "Share External URL",
    description:
      "Component to share an admin-configured external URL with the user's share code appended.",
    configFields: [
      {
        name: "externalTargetId",
        label: "External Share Target ID",
        description:
          "ID of the admin-configured external share target. Manage targets in the admin panel.",
        type: "number",
      },
    ],
  },
  [CustomComponentId.ShareInfoPubliclyToggle]: {
    label: "Share Info Publicly Toggle",
    description: "Toggle a member's public profile visibility setting.",
  },
};

export const buildCustomComponentRegistry = (
  components: Record<CustomComponentId, ComponentType<CustomComponentProps>>,
) => {
  const customComponentRegistry: CustomComponentDefinition[] = Object.values(
    CustomComponentId,
  ).map((id) => ({
    id,
    ...customComponentMetadata[id],
    component: components[id],
  }));
  return {
    customComponentRegistry,
    getCustomComponentById: (id: string | undefined | null) =>
      customComponentRegistry.find((component) => component.id === id),
  };
};
