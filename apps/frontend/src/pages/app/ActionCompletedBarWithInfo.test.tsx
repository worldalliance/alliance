import { ActionDto } from "@alliance/shared/client";
import { makeAction } from "@alliance/shared/lib/testFixtures";
import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { render, screen } from "@testing-library/react";
import ActionCompletedBarWithInfo from "./ActionCompletedBarWithInfo";

let replyMemberCount: () => Response;

serveApi(routes({ "POST /user/nmembers": () => replyMemberCount() }));

beforeEach(() => {
  replyMemberCount = () => Response.json({ count: 1200 });
});

const renderBar = (action: ActionDto) => {
  const { wrapper } = queryWrapper();
  return render(
    <ActionCompletedBarWithInfo
      action={action}
      friendActivities={[]}
      showInfoTooltip
    />,
    { wrapper },
  ).container;
};

it("explains the denominator of a regular action's count", async () => {
  const container = renderBar(
    makeAction({ usersCompleted: 3, usersJoined: 10 }),
  );

  await screen.findByText("3 / 10 members completed");
  expect(container.querySelector(".lucide-info")).not.toBeNull();
});

it("shows no denominator explanation on an optional action", async () => {
  const container = renderBar(
    makeAction({ optional: true, usersCompleted: 3, usersJoined: 10 }),
  );

  await screen.findByText("3 members completed");
  expect(container.querySelector(".lucide-info")).toBeNull();
});

it("shows no denominator explanation beside the signed member count", async () => {
  const container = renderBar(makeAction({ onboarding: true }));

  await screen.findByText("1200 members");
  expect(container.querySelector(".lucide-info")).toBeNull();
});

it("requests no signed member count for a regular action", async () => {
  let requests = 0;
  replyMemberCount = () => {
    requests += 1;
    return Response.json({ count: 1200 });
  };
  renderBar(makeAction({ usersCompleted: 3, usersJoined: 10 }));

  await screen.findByText("3 / 10 members completed");
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(requests).toBe(0);
});

it("draws the full bar while the signed member count loads", async () => {
  const container = renderBar(makeAction({ onboarding: true }));

  screen.getByText("... members");
  expect(container.querySelector<HTMLElement>(".bg-green")?.style.width).toBe(
    "100%",
  );

  await screen.findByText("1200 members");
  expect(screen.queryByText("... members")).toBeNull();
});

it("says the signed member count is unavailable, with an empty bar", async () => {
  replyMemberCount = () => new Response(null, { status: 500 });
  const container = renderBar(makeAction({ onboarding: true }));

  await screen.findByText("Member count unavailable", {}, { timeout: 2500 });
  expect(container.querySelector(".bg-green")).toBeNull();
  expect(container.querySelector(".bg-zinc-100")).not.toBeNull();
});
