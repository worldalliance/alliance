import { submitForm } from "./submitForm";

function setup({
  valid = true,
  send = async () => true,
}: {
  valid?: boolean;
  send?: (() => Promise<boolean>) | null;
} = {}) {
  const calls: string[] = [];
  const params = {
    validateAllPages: async () => ({
      isValid: valid,
      firstInvalidPageIndex: valid ? null : 1,
    }),
    send: send && (() => (calls.push("send"), send())),
    pauseSyncing: () => calls.push("pause"),
    resumeSyncing: () => calls.push("resume"),
    clearStoredDraft: () => calls.push("clear"),
  };
  return { submit: () => submitForm(params), calls };
}

describe("submitForm", () => {
  test("sends nothing when a page fails validation, and names that page", async () => {
    const { submit, calls } = setup({ valid: false });
    expect(await submit()).toEqual({
      submitted: false,
      firstInvalidPageIndex: 1,
    });
    expect(calls).toEqual([]);
  });

  test("clears the stored draft once the server takes the submission", async () => {
    const { submit, calls } = setup();
    expect(await submit()).toEqual({
      submitted: true,
      firstInvalidPageIndex: null,
    });
    expect(calls).toEqual(["pause", "send", "clear"]);
  });

  test("resumes syncing the draft when the server refuses it", async () => {
    const { submit, calls } = setup({ send: async () => false });
    expect((await submit()).submitted).toBe(false);
    expect(calls).toEqual(["pause", "send", "resume"]);
  });

  test("resumes syncing the draft when sending throws", async () => {
    const { submit, calls } = setup({
      send: async () => {
        throw new Error("offline");
      },
    });
    expect(await submit()).toEqual({
      submitted: false,
      firstInvalidPageIndex: null,
    });
    expect(calls).toEqual(["pause", "send", "resume"]);
  });

  test("sends nothing without a destination", async () => {
    const { submit, calls } = setup({ send: null });
    expect((await submit()).submitted).toBe(false);
    expect(calls).toEqual([]);
  });

  test("still names the first invalid page without a destination", async () => {
    const { submit, calls } = setup({ valid: false, send: null });
    expect(await submit()).toEqual({
      submitted: false,
      firstInvalidPageIndex: 1,
    });
    expect(calls).toEqual([]);
  });
});
