import { UnrenderableReason } from "@alliance/common/forms/unrenderable";
import {
  __resetReportedUnrenderableForTests,
  UnrenderableSubject,
} from "@alliance/shared/forms/unrenderable";
import { recordExceptions } from "@alliance/shared/lib/testing/recordExceptions";
import { render } from "@testing-library/react";
import UnrenderableNotice from "./UnrenderableNotice";

const reported = recordExceptions();

beforeEach(() => __resetReportedUnrenderableForTests());

it("reports content it can't show", () => {
  render(
    <UnrenderableNotice
      subject={UnrenderableSubject.Update}
      reason={UnrenderableReason.ContentProblem}
      content={{ actionUpdateId: 4 }}
    />,
  );

  expect(reported).toHaveLength(1);
});
