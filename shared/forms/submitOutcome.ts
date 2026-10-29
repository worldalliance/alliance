/** How a form's submit went; on a validation failure, the first page with an error. */
export type SubmitOutcome = {
  submitted: boolean;
  firstInvalidPageIndex: number | null;
};

export const NOT_SUBMITTED: SubmitOutcome = {
  submitted: false,
  firstInvalidPageIndex: null,
};
