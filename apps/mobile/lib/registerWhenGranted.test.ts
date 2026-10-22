import { expect, it, mock } from "bun:test";
import type { AppStateStatus } from "react-native";
import { registerWhenGranted } from "./registerWhenGranted";

const setup = () => {
  let listener: (state: AppStateStatus) => void = () => {};
  let finishFirst = () => {};
  let granted = false;
  const register = mock(() => {});
  const stop = registerWhenGranted({
    appState: {
      addEventListener: (_type: "change", next: typeof listener) => {
        listener = next;
        return { remove: () => {} };
      },
    },
    first: new Promise<void>((resolve) => (finishFirst = resolve)),
    readGranted: async () => granted,
    register,
  });
  const settle = () => new Promise((resolve) => setTimeout(resolve, 0));
  return {
    register,
    stop,
    grant: () => (granted = true),
    revoke: () => (granted = false),
    finishFirst: async () => {
      finishFirst();
      await settle();
    },
    foreground: async () => {
      listener("active");
      await settle();
    },
    foregroundThenStop: async () => {
      listener("active");
      stop();
      await settle();
    },
  };
};

it("registers once permission is granted while the app was away", async () => {
  const { register, grant, finishFirst, foreground } = setup();
  await finishFirst();

  await foreground();
  expect(register).not.toHaveBeenCalled();

  grant();
  await foreground();
  await foreground();
  expect(register).toHaveBeenCalledTimes(1);
});

it("leaves a grant from the first registration's prompt to it", async () => {
  const { register, grant, finishFirst, foreground } = setup();

  grant();
  await foreground();
  await finishFirst();
  await foreground();

  expect(register).not.toHaveBeenCalled();
});

it("registers again after permission is revoked and granted back", async () => {
  const { register, grant, revoke, finishFirst, foreground } = setup();
  grant();
  await finishFirst();

  revoke();
  await foreground();
  grant();
  await foreground();

  expect(register).toHaveBeenCalledTimes(1);
});

it("doesn't register once stopped, even mid-check", async () => {
  const { register, grant, finishFirst, foregroundThenStop } = setup();
  await finishFirst();

  grant();
  await foregroundThenStop();

  expect(register).not.toHaveBeenCalled();
});

it("logs a failed permission read instead of throwing", async () => {
  const error = mock(() => {});
  const original = console.error;
  console.error = error;
  try {
    registerWhenGranted({
      appState: { addEventListener: () => ({ remove: () => {} }) },
      first: Promise.resolve(),
      readGranted: () => Promise.reject(new Error("boom")),
      register: () => {},
    });
    await new Promise((resolve) => setTimeout(resolve, 0));
  } finally {
    console.error = original;
  }

  expect(error).toHaveBeenCalledTimes(1);
});
