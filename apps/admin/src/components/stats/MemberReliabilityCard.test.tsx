import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { fireEvent, render, screen } from "@testing-library/react";
import MemberReliabilityCard from "./MemberReliabilityCard";

let reliabilityStatus = 200;
let reliabilityRequests: URL[] = [];

serveApi(
  routes({
    "GET /analytics/member-reliability-window": ({ request }) => {
      reliabilityRequests.push(new URL(request.url));
      return reliabilityStatus === 200
        ? Response.json({
            weeks: 5,
            firstWeek: {
              assignedCount: 8,
              completedCount: 6,
              completionRate: 0.75,
            },
            fourthWeekOrLater: {
              assignedCount: 10,
              completedCount: 9,
              completionRate: 0.9,
            },
          })
        : Response.json({}, { status: reliabilityStatus });
    },
  }),
);

afterEach(() => {
  reliabilityStatus = 200;
  reliabilityRequests = [];
});

const weeksInput = () => screen.getByRole("spinbutton");
const submit = () =>
  fireEvent.click(screen.getByRole("button", { name: "View reliability" }));

describe("MemberReliabilityCard", () => {
  it("shows each rate for the requested weeks", async () => {
    render(<MemberReliabilityCard />);

    submit();

    await screen.findByText("75.0%");
    expect(screen.getByText("90.0%")).toBeTruthy();
    expect(screen.getByText(/6 completed \/ 8/)).toBeTruthy();
    expect(
      reliabilityRequests.map((url) => url.searchParams.get("weeks")),
    ).toEqual(["5"]);
  });

  it("refuses a week count below 1 without requesting it", async () => {
    render(<MemberReliabilityCard />);

    fireEvent.change(weeksInput(), { target: { value: "0" } });
    const form = weeksInput().closest("form");
    if (!form) throw new Error("no form");
    fireEvent.submit(form);

    await screen.findByText("Weeks must be a whole number of at least 1.");
    expect(reliabilityRequests).toEqual([]);
  });

  it("says the load failed", async () => {
    reliabilityStatus = 500;
    render(<MemberReliabilityCard />);

    submit();

    await screen.findByText(
      "Unable to load reliability data right now. Please try again soon.",
    );
  });
});
