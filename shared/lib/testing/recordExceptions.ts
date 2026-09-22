import { registerAnalytics } from "../analytics";

/** Collects every `captureException` call, emptied before each test. */
export const recordExceptions = () => {
  const reported: {
    event: unknown;
    error: unknown;
    properties: unknown;
  }[] = [];
  // Recorded through the backend rather than a module mock of ../analytics:
  // bun's module mocks outlive the file that installs them, and
  // analytics.test.ts tests the real captureException.
  beforeEach(() => {
    registerAnalytics({
      capture: () => {},
      captureException: (error, properties) => {
        reported.push({
          event: properties?.event,
          error,
          properties: properties?.properties,
        });
      },
    });
    reported.length = 0;
  });
  return reported;
};
