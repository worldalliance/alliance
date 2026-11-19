import type { AppStateStatus } from "react-native";

export const fakeAppState = (currentState: AppStateStatus = "active") => {
  // One registration per add, as React Native's EventEmitter keeps them.
  const registrations = new Set<{
    listener: (state: AppStateStatus) => void;
  }>();
  return {
    appState: {
      currentState,
      addEventListener: (
        _type: "change",
        listener: (state: AppStateStatus) => void,
      ) => {
        const registration = { listener };
        registrations.add(registration);
        return {
          remove: () => {
            registrations.delete(registration);
          },
        };
      },
    },
    change: (state: AppStateStatus) => {
      for (const { listener } of [...registrations]) listener(state);
    },
  };
};
