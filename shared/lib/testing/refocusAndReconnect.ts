import { focusManager, onlineManager } from "@tanstack/react-query";
import { act } from "@testing-library/react";
import { queryWrapper } from "./queryWrapper";

export const refetchingWrapper = () =>
  queryWrapper({ refetchOnWindowFocus: true, refetchOnReconnect: true })
    .wrapper;

export const refocusAndReconnect = async (settle: () => Promise<void>) => {
  act(() => {
    focusManager.setFocused(false);
    focusManager.setFocused(true);
    onlineManager.setOnline(false);
    onlineManager.setOnline(true);
  });
  await settle();
  focusManager.setFocused(undefined);
};
