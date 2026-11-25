import { fireEvent, screen } from "@testing-library/react";
import { testAuthUser } from "../../stories/testData";
import { authValue } from "../../testing/authValue";
import ActionTaskPanelForm from "../ActionTaskPanelForm";
import {
  action,
  LAZY_PART_TIMEOUT,
  openFirstQuestionScreen,
  renderFlow,
  serveTaskFlow,
  setServedSchema,
  taskSchema,
} from "./TaskFlow.testing";

serveTaskFlow();

const findPhoneInput = () =>
  screen.findByRole(
    "textbox",
    { name: /Phone/ },
    { timeout: LAZY_PART_TIMEOUT },
  );

const member = { ...testAuthUser, phoneNumber: "+14155552671" };

beforeEach(() => {
  const [intro, questions, last] = taskSchema.pages;
  setServedSchema({
    ...taskSchema,
    pages: [
      intro,
      {
        ...questions,
        fields: [
          ...questions.fields,
          {
            id: "phone",
            type: "input",
            kind: "phone",
            label: "Phone",
            autoExtractUserData: true,
          },
        ],
      },
      last,
    ],
  });
});

const page = (preview: boolean) => (
  <ActionTaskPanelForm
    taskFormId={9}
    onCompleteAction={preview ? null : () => {}}
    onAbandonAction={() => {}}
    onFormStarted={() => {}}
    onDeadlinePassed={() => {}}
    preview={preview}
    action={action}
  />
);

it("starts a live task's profile phone question at the member's number, with a code to confirm it", async () => {
  renderFlow({ page: page(false), auth: authValue({ user: member }) });
  await openFirstQuestionScreen();

  expect(
    await screen.findByText("Confirm your number so we know it’s right."),
  ).toBeTruthy();
  expect(screen.getByRole("button", { name: "Send code" })).toBeTruthy();
  expect(((await findPhoneInput()) as HTMLInputElement).value).toContain("555");
});

it("offers no code in a staff preview", async () => {
  renderFlow({ page: page(true), auth: authValue({ user: member }) });
  await openFirstQuestionScreen();

  await findPhoneInput();
  expect(screen.queryByRole("button", { name: "Send code" })).toBeNull();
});

it("offers no code to staff acting as the member", async () => {
  renderFlow({
    page: page(false),
    auth: authValue({ user: member, isImpersonation: true }),
  });
  await openFirstQuestionScreen();

  await findPhoneInput();
  expect(screen.queryByRole("button", { name: "Send code" })).toBeNull();
});

it("offers no code to a guest", async () => {
  renderFlow({ page: page(false), auth: authValue() });
  await openFirstQuestionScreen();

  fireEvent.change(await findPhoneInput(), {
    target: { value: "+14155552671" },
  });
  expect(((await findPhoneInput()) as HTMLInputElement).value).toContain(
    "2671",
  );
  expect(screen.queryByRole("button", { name: "Send code" })).toBeNull();
});
