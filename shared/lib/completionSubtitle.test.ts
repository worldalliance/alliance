import type { FormSchema } from "@alliance/common/forms/form-schema";
import { completionSubtitle } from "./completionSubtitle";
import { taskFlow } from "./copy";

const schema = (subtitle?: string): FormSchema => ({
  pages: [],
  outputViews: [],
  completionSubtitle: subtitle,
});

it.each([
  ["set", "  Welcome to the Alliance! ", "Welcome to the Alliance!"],
  ["unset", undefined, taskFlow.completeUpdate],
  ["empty", "", taskFlow.completeUpdate],
  ["blank", "   ", taskFlow.completeUpdate],
])("shows %s subtitles as %j", (_, subtitle, shown) => {
  expect(completionSubtitle(schema(subtitle))).toBe(shown);
});
