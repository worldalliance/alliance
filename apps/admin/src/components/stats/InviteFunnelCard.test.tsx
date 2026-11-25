import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { render } from "@testing-library/react";
import { openChartData } from "../../lib/testing/chartData";
import InviteFunnelCard from "./InviteFunnelCard";

serveApi(
  routes({
    "GET /analytics/invite-funnel": () =>
      Response.json({
        invitesCreated: 10,
        invitesUsed: 4,
        contractSigned: 0,
        onboardingCompleted: 0,
      }),
  }),
);

it("lists each step's count and its share of the step before", async () => {
  render(<InviteFunnelCard />, queryWrapper());

  expect(await openChartData("Invite conversion funnel")).toEqual([
    ["Invites created", "10", "—"],
    ["Invites used", "4", "40%"],
    ["Signed contract", "0", "0%"],
    ["Finished onboarding", "0", "—"],
  ]);
});
