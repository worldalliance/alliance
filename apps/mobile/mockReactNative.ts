// bun's module mocks are global to the run, so two test files can't mock
// `react-native` differently. Every file that needs it mocked shares this one.
//
// An export missing from here reads back as undefined rather than throwing:
// bun snapshots the object's own properties and drops accessors, so a proxy or
// a throwing getter never runs. Add what a new test needs.
const platform = {
  OS: "ios",
  select: (choices: Record<string, string>) => choices.ios,
};

export function mockReactNative() {
  jest.mock("react-native", () => ({ Text: "RNText", Platform: platform }));

  return platform;
}
