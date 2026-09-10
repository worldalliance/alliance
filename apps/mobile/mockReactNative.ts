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

// The stubs no test asserts on are there because uniwind's native runtime reads
// them as it loads.
export function mockReactNative() {
  jest.mock("react-native", () => ({
    Text: "RNText",
    Platform: platform,
    Appearance: { getColorScheme: () => "light" },
    Dimensions: {
      get: () => ({ width: 390, height: 844 }),
      addEventListener: () => ({ remove: () => {} }),
    },
    I18nManager: { isRTL: false },
    PixelRatio: { get: () => 3, getFontScale: () => 1 },
    StyleSheet: { hairlineWidth: 1 },
  }));

  return platform;
}
