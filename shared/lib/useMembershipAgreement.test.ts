import { act, renderHook, waitFor } from "@testing-library/react";
import type { ContractDto, ContractEventDto } from "../client";
import { WEEKLY_COMMITMENT_CONFIRMATION } from "./contract";
import { membershipAgreement } from "./copy";
import { queryWrapper } from "./testing/queryWrapper";
import { routes, serveApi } from "./testing/serveApi";
import { useMembershipAgreement } from "./useMembershipAgreement";

const DATE = "2026-03-10T12:00:00.000Z";

const contract = (id: number): ContractDto => ({
  id,
  markdown: `contract ${id}`,
  description: [],
});

const signed = (contractId: number): ContractEventDto => ({
  type: "signed",
  date: DATE,
  automatic: false,
  contractId,
});

const suspended: ContractEventDto = {
  type: "suspended",
  date: DATE,
  automatic: false,
  contractId: null,
};

const gate = () => {
  let open: () => void = () => {};
  const opened = new Promise<void>((resolve) => (open = resolve));
  return { open, opened };
};

let currentReachable = true;
let currentStatus = 200;
let actionsReachable = true;
let refusal: number | null = null;
let currentGate = gate();
let detailGate = gate();
const detailRequests: string[] = [];
const signBodies: unknown[] = [];

serveApi(
  routes({
    "GET /contract/current": async () => {
      await currentGate.opened;
      if (!currentReachable) throw new TypeError("Failed to fetch");
      return currentStatus === 200
        ? Response.json(contract(2))
        : Response.json({}, { status: currentStatus });
    },
    "GET /contract/detail/:id": async ({ params }) => {
      detailRequests.push(params.id);
      await detailGate.opened;
      return Response.json(contract(Number(params.id)));
    },
    "POST /contract/sign/:id": async ({ request }) => {
      if (!actionsReachable) throw new TypeError("Failed to fetch");
      signBodies.push(await request.json());
      return refused() ?? Response.json({ date: DATE });
    },
    "POST /contract/suspend": () => {
      if (!actionsReachable) throw new TypeError("Failed to fetch");
      return refused() ?? Response.json({ date: DATE });
    },
  }),
);

const REFUSAL = "Member does not have an active contract.";
const refused = () =>
  refusal === null
    ? undefined
    : Response.json(
        { statusCode: refusal, message: REFUSAL },
        { status: refusal },
      );

const setup = (lastContractEvent?: ContractEventDto) => {
  const refreshUser = jest.fn(() => Promise.resolve());
  const showError = jest.fn();
  const user = { lastContractEvent };
  const { result } = renderHook(
    () => useMembershipAgreement({ user, refreshUser, showError }),
    queryWrapper(),
  );
  return { result, refreshUser, showError };
};

type Agreement = ReturnType<typeof setup>["result"];

const loaded = async (result: Agreement) => {
  currentGate.open();
  await waitFor(() => expect(result.current.latestContract?.id).toBe(2));
};

const fillIn = (result: Agreement) =>
  act(() => {
    result.current.setSignedName("Jane Smith");
    result.current.setConfirmation(WEEKLY_COMMITMENT_CONFIRMATION);
  });

const status = (result: Agreement) => ({
  previousSignedContract: result.current.previousSignedContract?.id ?? null,
  latestSigned: result.current.latestSigned,
  updateAvailable: result.current.updateAvailable,
});

beforeEach(() => {
  currentReachable = true;
  currentStatus = 200;
  actionsReachable = true;
  refusal = null;
  currentGate = gate();
  detailGate = gate();
  detailRequests.length = 0;
  signBodies.length = 0;
});

describe("useMembershipAgreement status", () => {
  it("finds the latest contract signed", async () => {
    const { result } = setup(signed(2));
    await loaded(result);
    expect(status(result)).toEqual({
      previousSignedContract: null,
      latestSigned: true,
      updateAvailable: false,
    });
  });

  it("announces an update only once the previous contract has loaded", async () => {
    const { result } = setup(signed(1));
    await loaded(result);
    await waitFor(() => expect(detailRequests).toEqual(["1"]));
    expect(result.current.updateAvailable).toBe(false);

    detailGate.open();
    await waitFor(() => expect(result.current.updateAvailable).toBe(true));
    expect(status(result)).toEqual({
      previousSignedContract: 1,
      latestSigned: false,
      updateAvailable: true,
    });
  });

  it.each([
    ["a suspended member", suspended],
    ["a member who never signed", undefined],
  ])("shows %s only the latest contract", async (_, lastContractEvent) => {
    const { result } = setup(lastContractEvent);
    await loaded(result);
    expect(status(result)).toEqual({
      previousSignedContract: null,
      latestSigned: false,
      updateAvailable: false,
    });
    expect(detailRequests).toEqual([]);
  });

  it("reports nothing while the latest contract loads", async () => {
    const { result } = setup(signed(2));
    detailGate.open();
    await act(() => new Promise((resolve) => setTimeout(resolve, 50)));
    expect(result.current.latestContract).toBeUndefined();
    expect(detailRequests).toEqual([]);
    expect(status(result)).toEqual({
      previousSignedContract: null,
      latestSigned: false,
      updateAvailable: false,
    });
  });

  it.each([
    ["can't be reached", () => (currentReachable = false)],
    ["comes back with an error", () => (currentStatus = 500)],
  ])(
    "still shows what was signed when the latest contract %s",
    async (_, fail) => {
      fail();
      detailGate.open();
      const { result } = setup(signed(1));
      currentGate.open();
      await waitFor(() => expect(result.current.contractLoadFailed).toBe(true));
      await waitFor(() =>
        expect(result.current.previousSignedContract?.id).toBe(1),
      );
      expect(result.current.updateAvailable).toBe(false);
    },
  );
});

describe("useMembershipAgreement retry", () => {
  it("loads the latest contract on retry after a failed load", async () => {
    currentStatus = 500;
    const { result } = setup();
    currentGate.open();
    await waitFor(() => expect(result.current.contractLoadFailed).toBe(true));

    currentStatus = 200;
    act(() => result.current.retryContractLoad());

    await waitFor(() => expect(result.current.latestContract?.id).toBe(2));
    expect(result.current.contractLoadFailed).toBe(false);
  });
});

describe("useMembershipAgreement signing", () => {
  it("can't sign until the latest contract has loaded", () => {
    const { result } = setup();
    fillIn(result);
    expect(result.current.canSign).toBe(false);
  });

  it("can't sign a contract that failed to load", async () => {
    currentReachable = false;
    const { result } = setup();
    currentGate.open();
    await waitFor(() => expect(result.current.contractLoadFailed).toBe(true));
    fillIn(result);
    expect(result.current.canSign).toBe(false);
  });

  it("signs the latest contract and refreshes the member", async () => {
    const { result, refreshUser, showError } = setup();
    await loaded(result);
    fillIn(result);
    expect(result.current.canSign).toBe(true);

    await act(() => result.current.sign());

    expect(signBodies).toEqual([{ signedName: "Jane Smith" }]);
    expect(result.current.lastContractEvent).toEqual(signed(2));
    expect(result.current.latestSigned).toBe(true);
    expect(result.current.confirmation).toBe("");
    expect(refreshUser).toHaveBeenCalledTimes(1);
    expect(showError).not.toHaveBeenCalled();
  });

  it("records a suspension", async () => {
    const { result, refreshUser } = setup(signed(2));
    await loaded(result);
    expect(result.current.latestSigned).toBe(true);

    await act(() => result.current.suspend());

    expect(result.current.lastContractEvent?.type).toBe("suspended");
    expect(result.current.latestSigned).toBe(false);
    expect(refreshUser).toHaveBeenCalledTimes(1);
  });

  it("reports a signature that never reached the server", async () => {
    actionsReachable = false;
    const { result, refreshUser, showError } = setup();
    await loaded(result);
    fillIn(result);

    await act(() => result.current.sign());

    expect(showError).toHaveBeenCalledTimes(1);
    expect(refreshUser).not.toHaveBeenCalled();
    expect(result.current.lastContractEvent).toBeNull();
    expect(result.current.confirmation).toBe(WEEKLY_COMMITMENT_CONFIRMATION);
    expect(result.current.isSubmitting).toBe(false);
  });

  it("reports a suspension that never reached the server", async () => {
    actionsReachable = false;
    const { result, refreshUser, showError } = setup(signed(2));
    await loaded(result);

    await act(() => result.current.suspend());

    expect(showError).toHaveBeenCalledTimes(1);
    expect(refreshUser).not.toHaveBeenCalled();
    expect(result.current.latestSigned).toBe(true);
    expect(result.current.isSubmitting).toBe(false);
  });

  it("reports a refused signature with the server's reason", async () => {
    refusal = 400;
    const { result, refreshUser, showError } = setup();
    await loaded(result);
    fillIn(result);

    await act(() => result.current.sign());

    expect(showError.mock.calls).toEqual([[REFUSAL]]);
    expect(refreshUser).not.toHaveBeenCalled();
    expect(result.current.lastContractEvent).toBeNull();
    expect(result.current.confirmation).toBe(WEEKLY_COMMITMENT_CONFIRMATION);
  });

  it("reports a refused suspension with the server's reason", async () => {
    refusal = 400;
    const { result, refreshUser, showError } = setup(signed(2));
    await loaded(result);

    await act(() => result.current.suspend());

    expect(showError.mock.calls).toEqual([[REFUSAL]]);
    expect(refreshUser).not.toHaveBeenCalled();
    expect(result.current.latestSigned).toBe(true);
  });

  it.each([
    [401, membershipAgreement.signSessionExpired],
    [500, membershipAgreement.signFailed],
  ])("reports a signature refused with %i as %j", async (status, message) => {
    refusal = status;
    const { result, showError } = setup();
    await loaded(result);
    fillIn(result);

    await act(() => result.current.sign());

    expect(showError.mock.calls).toEqual([[message]]);
  });

  it.each([
    [401, membershipAgreement.suspendSessionExpired],
    [500, membershipAgreement.suspendFailed],
  ])("reports a suspension refused with %i as %j", async (status, message) => {
    refusal = status;
    const { result, showError } = setup(signed(2));
    await loaded(result);

    await act(() => result.current.suspend());

    expect(showError.mock.calls).toEqual([[message]]);
  });
});
