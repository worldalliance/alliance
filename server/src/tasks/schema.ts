/* eslint-disable @typescript-eslint/no-explicit-any */
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DisplayBlock } from './display-blocks';

// field-kinds.ts
export type FieldKind =
  | 'text'
  | 'textarea'
  | 'email'
  | 'number'
  | 'phone'
  | 'checkbox'
  | 'radio'
  | 'select'
  | 'multiselect'
  | 'date'
  | 'file';

type Option<V extends string = string> = { label: string; value: V };

export type FormValue = string | number | boolean | string[];

interface BaseField<TKind extends FieldKind> {
  id: string;
  kind: TKind;
  label: string;
  description?: string;
  required?: boolean;
  defaultValue?: FormValue | null;

  visibleIf?: Condition;
  requiredIf?: Condition;

  width?: 'full' | '1/2' | '1/3';
}

// Conditions reference other field ids; we type this late with a helper (see defineForm)
export type Condition =
  | { when: string; equals: string | number | boolean | null }
  | { expr: string };

// Specialized fields:

export type TextField = BaseField<'text'> & {
  placeholder?: string;
  minLength?: number;
  maxLength?: number;
  pattern?: string; // regex string (runtime checked)
};

export type TextareaField = BaseField<'textarea'> & {
  rows?: number;
  maxLength?: number;
};

export type EmailField = BaseField<'email'>;
export type PhoneField = BaseField<'phone'> & {
  placeholder?: string;
  pattern?: string;
};
export type NumberField = BaseField<'number'> & {
  min?: number;
  max?: number;
  step?: number;
};

export type CheckboxField = BaseField<'checkbox'>;
export type RadioField = BaseField<'radio'> & { options: Option<string>[] };

export type SelectField = BaseField<'select'> & { options: Option<string>[] };

export type MultiSelectField = BaseField<'multiselect'> & {
  options: Option<string>[];
};

export type DateField = BaseField<'date'>; // ISO date string
// Persist file answers as string URL/key
export type FileField = BaseField<'file'>;

export type AnyField =
  | TextField
  | TextareaField
  | EmailField
  | PhoneField
  | NumberField
  | CheckboxField
  | RadioField
  | SelectField
  | MultiSelectField
  | DateField
  | FileField;

export class Page {
  id: string;
  title?: string;
  description?: string;
  fields: Array<AnyField | DisplayBlock>;
}

export class FormSchema {
  @ApiProperty()
  title: string;
  @ApiPropertyOptional()
  description?: string;
  @ApiProperty({ type: Page, isArray: true })
  pages: Page[];
  @ApiPropertyOptional()
  submit?: { label?: string };
}

export function isQuestionField(
  field: AnyField | DisplayBlock,
): field is AnyField {
  return 'label' in field;
}

export function isQuestionVisible(
  element: AnyField | DisplayBlock,
  formData: Record<string, FormValue>,
): boolean {
  const cond = element.visibleIf;
  if (cond) {
    const evalCond = (c: Condition): boolean => {
      if ('expr' in c) {
        return true;
      }
      const val = formData[c.when];
      // If condition expects a boolean (checkbox controllers), coerce undefined → false
      if (typeof c.equals === 'boolean') {
        return Boolean(val) === c.equals;
      }
      if (Array.isArray(val) && c.equals) {
        // multiselect: treat equals as "includes"
        return val.includes(c.equals as string);
      }
      return val === c.equals;
    };
    if (!evalCond(cond)) return false;
  }
  return true;
}
