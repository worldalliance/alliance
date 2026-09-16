import { DisplayBlock } from "@alliance/common/forms/display-blocks";
import type { AnyField, FieldKind } from "@alliance/common/forms/form-schema";
import type { ComponentType } from "react";

export interface BaseFieldProps<T extends AnyField | DisplayBlock> {
  field: T;
  onUpdate: (updates: Partial<T>) => void;
  onRemove: () => void;
  onDragStart?: (e: React.DragEvent) => void;
  onDragEnd?: (e: React.DragEvent) => void;
  isDragging?: boolean;
  // Fields earlier on the same page; used for conditional visibility
  previousFields?: AnyField[];
}

export type FieldOfKind = { [F in AnyField as F["kind"]]: F };

export type FieldEditor<K extends FieldKind> = ComponentType<
  BaseFieldProps<FieldOfKind[K]>
>;

export interface FieldWrapperProps<T extends AnyField | DisplayBlock> {
  field: T;
  onUpdate: (updates: Partial<T>) => void;
  previousFields?: AnyField[];
  onRemove: () => void;
  children: React.ReactNode;
  onDragStart?: (e: React.DragEvent) => void;
  onDragEnd?: (e: React.DragEvent) => void;
  isDragging?: boolean;
}
