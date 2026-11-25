import { act, renderHook, waitFor } from "@testing-library/react";
import type { UpdateProfileDto } from "../client";
import { queryWrapper } from "./testing/queryWrapper";
import { routes, serveApi } from "./testing/serveApi";
import { useSettingsAutosave } from "./useSettingsAutosave";

const TAKEN = "+14155550123";
const REFUSAL =
  "This phone number is already linked to an account. Enter a different number.";

let sent: UpdateProfileDto[] = [];
let refusalSent: () => void = () => {};
let refusalHeld: Promise<void> = Promise.resolve();
let nameSent: () => void = () => {};
let nameHeld: Promise<void> = Promise.resolve();

serveApi(
  routes({
    "POST /user/update": async ({ request }) => {
      const body: UpdateProfileDto = await request.json();
      sent.push(body);
      if (body.phoneNumber === TAKEN) {
        refusalSent();
        await refusalHeld;
      }
      if (body.name !== undefined) {
        nameSent();
        await nameHeld;
      }
      return body.phoneNumber === TAKEN
        ? Response.json({ message: REFUSAL }, { status: 409 })
        : Response.json({ id: 7 });
    },
    "GET /auth/me": () => Response.json({ user: { id: 7 } }),
  }),
);

beforeEach(() => {
  sent = [];
  refusalSent = () => {};
  refusalHeld = Promise.resolve();
  nameSent = () => {};
  nameHeld = Promise.resolve();
});

const mount = () => {
  const view = renderHook(() => useSettingsAutosave(7, "US"), {
    wrapper: queryWrapper().wrapper,
  });
  act(() =>
    view.result.current.setSavedProfile({
      name: "Ada",
      phoneNumber: "+14155552671",
    }),
  );
  return view;
};

describe("useSettingsAutosave", () => {
  it("shows a refused number on its field and still saves the other edits", async () => {
    const { result } = mount();

    act(() =>
      result.current.updateEditableUser({ name: "Grace", phoneNumber: TAKEN }),
    );

    await waitFor(() => expect(sent).toHaveLength(2));
    expect(sent).toEqual([
      { name: "Grace", phoneNumber: TAKEN },
      { name: "Grace" },
    ]);
    await waitFor(() => expect(result.current.saveStatus).toBe("blocked"));
    expect(result.current.phoneNumberError).toBe(REFUSAL);
    expect(result.current.saveError).toBeNull();
    expect(result.current.editableUser?.phoneNumber).toBe(TAKEN);
  });

  it("sends the number again once the member changes it", async () => {
    const { result } = mount();
    act(() => result.current.updateEditableUser({ phoneNumber: TAKEN }));
    await waitFor(() => expect(result.current.phoneNumberError).toBe(REFUSAL));

    act(() =>
      result.current.updateEditableUser({ phoneNumber: "+14155550199" }),
    );

    await waitFor(() => expect(result.current.saveStatus).toBe("saved"));
    expect(sent.at(-1)).toEqual({ phoneNumber: "+14155550199" });
    expect(result.current.phoneNumberError).toBeNull();
  });

  it("sends a number typed while the refusal of the last one was on its way", async () => {
    let release = () => {};
    refusalHeld = new Promise((resolve) => {
      release = resolve;
    });
    const sentTaken = new Promise<void>((resolve) => {
      refusalSent = resolve;
    });
    const { result } = mount();

    act(() => result.current.updateEditableUser({ phoneNumber: TAKEN }));
    await act(() => sentTaken);
    act(() =>
      result.current.updateEditableUser({ phoneNumber: "+14155550199" }),
    );
    await act(async () => release());

    await waitFor(() => expect(result.current.saveStatus).toBe("saved"));
    expect(sent.at(-1)).toEqual({ phoneNumber: "+14155550199" });
    expect(result.current.phoneNumberError).toBeNull();
  });

  it("sends a refused number again when the member re-enters it", async () => {
    const { result } = mount();
    act(() => result.current.updateEditableUser({ phoneNumber: TAKEN }));
    await waitFor(() => expect(result.current.phoneNumberError).toBe(REFUSAL));
    act(() =>
      result.current.updateEditableUser({ phoneNumber: "+14155550199" }),
    );
    await waitFor(() => expect(result.current.saveStatus).toBe("saved"));
    const before = sent.length;

    act(() => result.current.updateEditableUser({ phoneNumber: TAKEN }));

    await waitFor(() => expect(sent).toHaveLength(before + 1));
    expect(sent.at(-1)).toEqual({ phoneNumber: TAKEN });
    await waitFor(() => expect(result.current.phoneNumberError).toBe(REFUSAL));
  });

  it("does not hold a refusal past a reload of the saved profile", async () => {
    const { result } = mount();
    act(() => result.current.updateEditableUser({ phoneNumber: TAKEN }));
    await waitFor(() => expect(result.current.phoneNumberError).toBe(REFUSAL));

    act(() =>
      result.current.setSavedProfile({ name: "Ada", phoneNumber: TAKEN }),
    );

    expect(result.current.phoneNumberError).toBeNull();
    expect(result.current.saveStatus).toBe("saved");
  });

  it("offers to confirm a typed number only once it is saved", async () => {
    const { result } = mount();
    expect(result.current.confirmablePhoneNumber).toBe("+14155552671");

    act(() =>
      result.current.updateEditableUser({ phoneNumber: "+14155550199" }),
    );

    expect(result.current.confirmablePhoneNumber).toBeNull();
    await waitFor(() =>
      expect(result.current.confirmablePhoneNumber).toBe("+14155550199"),
    );
  });

  it("keeps a number confirmed while another field's save was on its way", async () => {
    let release = () => {};
    nameHeld = new Promise((resolve) => {
      release = resolve;
    });
    const sentName = new Promise<void>((resolve) => {
      nameSent = resolve;
    });
    const { result } = mount();
    act(() => result.current.updateEditableUser({ phoneNumber: TAKEN }));
    await waitFor(() => expect(result.current.phoneNumberError).toBe(REFUSAL));
    act(() => result.current.updateEditableUser({ name: "Grace" }));
    await act(() => sentName);

    act(() => result.current.phoneNumberConfirmed(TAKEN));
    await act(async () => release());

    await waitFor(() => expect(result.current.saveStatus).toBe("saved"));
    expect(result.current.confirmablePhoneNumber).toBe(TAKEN);
    expect(sent.filter((body) => body.phoneNumber === TAKEN)).toHaveLength(1);
  });
});
