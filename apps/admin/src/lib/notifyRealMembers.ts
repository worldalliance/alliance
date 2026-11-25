export const notifyRealMembersText = (count: number | "many") =>
  `I am going to notify ${count} real members`;

/** For a notice that reaches people who may not be members, such as Kora's waitlist participants. */
export const notifyRealPeopleText = (count: number | "many") =>
  `I am going to notify ${count} real people`;
