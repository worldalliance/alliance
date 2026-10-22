import { renderHook, waitFor } from "@testing-library/react";
import { queryWrapper } from "./testing/queryWrapper";
import { routes, serveApi } from "./testing/serveApi";
import { useFormWithdrawalsAdmin } from "./useFormWithdrawalsAdmin";

let requested: string[] = [];
let status = 200;

serveApi(
  routes({
    "GET /actions/withdrawals/byForm/:formId": ({ params }) => {
      requested.push(params.formId);
      if (status !== 200) return Response.json({}, { status });
      return Response.json([
        { userId: 3, declineReason: "busy", isMoral: false, outOfTime: true },
        { userId: 8, declineReason: null, isMoral: true, outOfTime: false },
      ]);
    },
  }),
);

beforeEach(() => {
  requested = [];
  status = 200;
});

it("keys the form's withdrawals by user id", async () => {
  const { result } = renderHook(
    () => useFormWithdrawalsAdmin(5),
    queryWrapper(),
  );

  await waitFor(() => expect(result.current.withdrawnUserMap.size).toBe(2));
  expect(result.current.withdrawnUserMap.get(3)?.declineReason).toBe("busy");
  expect(result.current.withdrawnUserMap.get(8)?.isMoral).toBe(true);
  expect(requested).toEqual(["5"]);
});

it("requests nothing without a form id", async () => {
  const { result } = renderHook(
    () => useFormWithdrawalsAdmin(undefined),
    queryWrapper(),
  );

  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(result.current.withdrawnUserMap.size).toBe(0);
  expect(requested).toEqual([]);
});

it("reports a failed load", async () => {
  status = 500;
  const { result } = renderHook(
    () => useFormWithdrawalsAdmin(5),
    queryWrapper(),
  );

  await waitFor(() => expect(result.current.isLoadingError).toBe(true));
  expect(result.current.withdrawnUserMap.size).toBe(0);
});
