import { useSearchParams } from "react-router";

export const MOCK_PARAM = "mock";

/** `?mock=1` swaps the member's real actions for the authored draft list. */
export function useMockTasks(): boolean {
  const [searchParams] = useSearchParams();
  return searchParams.get(MOCK_PARAM) === "1";
}
