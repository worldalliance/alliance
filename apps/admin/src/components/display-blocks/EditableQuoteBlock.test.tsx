import type { QuoteBlock } from "@alliance/common/forms/display-blocks";
import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { ToastProvider } from "@alliance/sharedweb/ui/ToastProvider";
import { fireEvent, render, screen } from "@testing-library/react";
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

it("stores the picked member's picture as its upload key", async () => {
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

  fireEvent.change(
    await screen.findByPlaceholderText("(Optional) Select user by name or id"),
    { target: { value: "Ada" } },
  );
  fireEvent.click(await screen.findByRole("button", { name: /Ada/ }));

  expect(onUpdate).toHaveBeenCalledWith(
    expect.objectContaining({ userId: 7, userProfilePicture: KEY }),
  );
});
