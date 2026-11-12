import { renderFile } from "pug";
import {
  koraConfirmationEmail,
  koraConfirmationText,
} from "./kora-confirmation-copy";

const params = {
  name: "Ada",
  projectUrl: "https://example.org/projects/safer-chatbots-for-children",
};

const REQUIRED = [
  "thank you for signing up",
  "~1 hour of work",
  "demo task",
  "https://example.org/projects/safer-chatbots-for-children",
  "This project will run through Early 2027.",
];

it("puts every required element in the text", () => {
  const text = koraConfirmationText(params).toLowerCase();
  for (const element of REQUIRED) {
    expect(text).toContain(element.toLowerCase());
  }
});

it("gives the email template everything it renders", () => {
  const { subject, context } = koraConfirmationEmail(params);
  expect(subject).toBe(
    "Thank you for signing up for Safer Chatbots for Children",
  );
  expect(context).toEqual({
    name: "Ada",
    project: "Safer Chatbots for Children",
    time: "This will be ~1 hour of work.",
    schedule: "This project will run through Early 2027.",
    url: params.projectUrl,
  });
});

it("renders the email with the name escaped and the link clickable", () => {
  const { context } = koraConfirmationEmail({ ...params, name: "<b>Ada</b>" });
  const html = renderFile(
    `${__dirname}/../mail/templates/kora-signup-confirmation.pug`,
    context,
  );
  expect(html).toContain("Hi &lt;b&gt;Ada&lt;/b&gt;,");
  expect(html).toContain(
    `<a href="${params.projectUrl}">${params.projectUrl}</a>`,
  );
  expect(html).toContain("This will be ~1 hour of work.");
  expect(html).toContain("This project will run through Early 2027.");
});
