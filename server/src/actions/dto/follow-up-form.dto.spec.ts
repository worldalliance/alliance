import { Form } from "src/tasks/entities/form.entity";
import { FollowUpForm } from "../entities/follow-up-form.entity";
import { FollowUpFormDto } from "./follow-up-form.dto";

describe("FollowUpFormDto", () => {
  it("leaves the form's slug out of what members receive", () => {
    const form = Object.assign(new Form(), {
      id: 3,
      title: "Check-in",
      slug: "f1",
    });
    const followUpForm = Object.assign(new FollowUpForm(), {
      id: 9,
      actionId: 4,
      formId: form.id,
      form,
    });

    const json = JSON.parse(JSON.stringify(new FollowUpFormDto(followUpForm)));

    expect(json.form).toEqual(
      expect.objectContaining({ id: 3, title: "Check-in" }),
    );
    expect(json.form).not.toHaveProperty("slug");
  });
});
