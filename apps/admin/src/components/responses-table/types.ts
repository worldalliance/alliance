import type { FormResponseDto } from "@alliance/shared/client";
import type { CellContent } from "./cells";
import type { QuestionColumn } from "./columns";

export enum MetaColumnId {
  Respondent = "respondent",
  Submitted = "submitted",
  Variant = "variant",
  Withdrawal = "withdrawal",
  ResponseId = "responseId",
  UserId = "userId",
}

export enum ColumnKind {
  Meta = "meta",
  Question = "question",
}

export type TableColumn =
  | { kind: ColumnKind.Meta; id: MetaColumnId; label: string }
  | {
      kind: ColumnKind.Question;
      id: string;
      label: string;
      question: QuestionColumn;
    };

export type ResponseRow = {
  response: FormResponseDto;
  cells: Record<string, CellContent>;
};
