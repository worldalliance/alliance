import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { LOAD_FAILED_FALLBACK } from "../../ui/templates/States";
import { MemberReliabilityPanel } from "./MemberReliabilityPanel";

let reliabilityStatus = 200;
let reliabilityMessage = "Internal server error";
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
        : Response.json(
            { message: reliabilityMessage },
            { status: reliabilityStatus },
          );
    },
  }),
);

afterEach(() => {
  reliabilityStatus = 200;
  reliabilityMessage = "Internal server error";
  reliabilityRequests = [];
});

const weeksInput = () => screen.getByRole("spinbutton");
const submit = () =>
  fireEvent.click(screen.getByRole("button", { name: "View reliability" }));

describe("MemberReliabilityPanel", () => {
  it("shows each rate for the requested weeks", async () => {
    render(<MemberReliabilityPanel />, queryWrapper());

    submit();

    await screen.findByText("75.0%");
    expect(screen.getByText("90.0%")).toBeTruthy();
    expect(screen.getByText(/6 completed \/ 8/)).toBeTruthy();
    expect(
      reliabilityRequests.map((url) => url.searchParams.get("weeks")),
    ).toEqual(["5"]);
  });

  it("refuses a week count below 1 without requesting it", async () => {
    render(<MemberReliabilityPanel />, queryWrapper());

    fireEvent.change(weeksInput(), { target: { value: "0" } });
    const form = weeksInput().closest("form");
    if (!form) throw new Error("no form");
    fireEvent.submit(form);

    await screen.findByText("Enter a whole number of weeks, 1 or more");
    expect(reliabilityRequests).toEqual([]);
  });

  it("says the load failed", async () => {
    reliabilityStatus = 500;
    render(<MemberReliabilityPanel />, queryWrapper());

    submit();

    await screen.findByText("Couldn't load member reliability");
    expect(screen.getByText(LOAD_FAILED_FALLBACK)).toBeTruthy();
  });

  it("loads the same week count again when reapplied after a failure", async () => {
    reliabilityStatus = 500;
    render(<MemberReliabilityPanel />, queryWrapper());
    submit();
    await screen.findByText("Couldn't load member reliability");

    reliabilityStatus = 200;
    submit();

    await screen.findByText("75.0%");
    expect(screen.queryByText("Couldn't load member reliability")).toBeNull();
    expect(
      reliabilityRequests.map((url) => url.searchParams.get("weeks")),
    ).toEqual(["5", "5"]);
  });

  it("says why a refused load failed", async () => {
    reliabilityStatus = 403;
    reliabilityMessage = "Admins only";
    render(<MemberReliabilityPanel />, queryWrapper());

    submit();

    await screen.findByText("Admins only");
    expect(screen.queryByText("75.0%")).toBeNull();
  });

  it("hides the shown rates when a later load fails", async () => {
    render(<MemberReliabilityPanel />, queryWrapper());
    submit();
    await screen.findByText("75.0%");

    reliabilityStatus = 500;
    fireEvent.change(weeksInput(), { target: { value: "8" } });
    submit();

    await screen.findByText("Couldn't load member reliability");
    await waitFor(() => expect(screen.queryByText("75.0%")).toBeNull());
  });
});
