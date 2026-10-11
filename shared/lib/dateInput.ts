const padDatePart = (value: number) => String(value).padStart(2, "0");

/** A date input's value for an instant: its calendar date in local time. */
export const dateToInputValue = (value: string | Date) => {
  const date = new Date(value);
  return [
    String(date.getFullYear()).padStart(4, "0"),
    padDatePart(date.getMonth() + 1),
    padDatePart(date.getDate()),
  ].join("-");
};

export const todayDateInputValue = () => dateToInputValue(new Date());
