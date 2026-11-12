const PROJECT = "Safer Chatbots for Children";
const TIME = "This will be ~1 hour of work.";
const SCHEDULE = "This project will run through Early 2027.";

export function koraConfirmationEmail(params: {
  name: string;
  projectUrl: string;
}): {
  subject: string;
  context: {
    name: string;
    project: string;
    time: string;
    schedule: string;
    url: string;
  };
} {
  return {
    subject: `Thank you for signing up for ${PROJECT}`,
    context: {
      name: params.name,
      project: PROJECT,
      time: TIME,
      schedule: SCHEDULE,
      url: params.projectUrl,
    },
  };
}

export function koraConfirmationText(params: {
  name: string;
  projectUrl: string;
}): string {
  return [
    `Hi ${params.name}, thank you for signing up for ${PROJECT} with the Alliance!`,
    TIME,
    `You can see a demo task here: ${params.projectUrl}`,
    SCHEDULE,
  ].join("\n\n");
}
