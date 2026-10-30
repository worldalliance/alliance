export const welcomeMessage = `Thanks for opting in to action notifications from the Alliance! You'll get a text here when a new action is ready to complete. Reply STOP to opt out.`;

export const suspensionMessage = `You missed an assigned non-optional task in each of the last 3 weeks you had tasks, so we've suspended your Alliance agreement automatically. `;

export const reinstatementMessage = "Your agreement has been reinstated.";

export const reinstatementTextMessage = (link: string) =>
  `${reinstatementMessage} Task assignment resumes with the next action. ${link}`;
