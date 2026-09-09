import type { TextStyle } from "react-native";

const resolve = {
  asked: null as { classNames: string; fontScale: number } | null,
  answer: {} as TextStyle,
};

/**
 * Stubs the two hooks `useWholePointLineHeight` resolves through and records
 * what the resolve was asked for. Shared because bun's module mocks are global
 * to the run, so two test files stubbing these differently would fight — and
 * that reach is the whole run, not the files calling this, so every mobile test
 * sees the stubs.
 */
export function mockStyleHooks() {
  jest.mock("./lib/style/useFontScale", () => ({ useFontScale: () => 1.235 }));
  jest.mock("./lib/style/useWholePointClassNames", () => ({
    useWholePointClassNames: (classNames: string, fontScale: number) => {
      resolve.asked = { classNames, fontScale };

      return classNames === "" ? {} : resolve.answer;
    },
  }));

  return resolve;
}
