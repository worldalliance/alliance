import type { QuoteBlock } from "@alliance/common/forms/display-blocks";
import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ToastProvider } from "../../../../ui/ToastProvider";
import { EditableQuoteBlock } from "./EditableQuoteBlock";

const KEY = "1762925939234.webp";

serveApi(
  routes({
    "GET /user/list": () =>
      Response.json([
        {
          id: 7,
          name: "Ada",
          profilePicture: `https://cdn.example.org/${KEY}`,
          storedProfilePicture: KEY,
        },
      ]),
  }),
);

const block: QuoteBlock = {
  type: "display",
  kind: "quote",
  id: "quote-1",
  text: "Worth it",
};

it("picks a member by keyboard, storing their picture as its upload key", async () => {
  const onUpdate = jest.fn();
  render(
    <ToastProvider>
      <EditableQuoteBlock
        block={block}
        onUpdate={onUpdate}
        onRemove={() => {}}
      />
    </ToastProvider>,
    queryWrapper(),
  );

  const search = await screen.findByRole("combobox", { name: "Member" });
  await waitFor(() => expect(search.hasAttribute("disabled")).toBe(false));
  fireEvent.keyDown(search, { key: "ArrowDown" });
  fireEvent.input(search, { target: { value: "Ada" } });
  await screen.findByRole("option", { name: /Ada/ });
  fireEvent.keyDown(search, { key: "Enter" });
  await waitFor(() => expect(onUpdate).toHaveBeenCalled());

  expect(onUpdate).toHaveBeenCalledWith(
    expect.objectContaining({ userId: 7, userProfilePicture: KEY }),
  );
});
