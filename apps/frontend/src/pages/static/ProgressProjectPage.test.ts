import { NotFoundSource } from "../../site/NotFoundPage";
import { loader } from "./ProgressProjectPage";

test("an unknown slug throws a 404 for a missing record", async () => {
  const thrown = await loader({ params: { slug: "no-such-project" } }).catch(
    (error: unknown) => error,
  );
  expect(thrown).toMatchObject({
    init: { status: 404 },
    data: NotFoundSource.MissingRecord,
  });
});
