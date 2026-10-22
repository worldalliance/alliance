import { useQuery } from "@tanstack/react-query";
import { contractGetCurrent } from "../client";
import { queryKeys } from "./queryKeys";

export function useCurrentContract() {
  return useQuery({
    queryKey: queryKeys.currentContract(),
    queryFn: () => contractGetCurrent().then((res) => res.data ?? null),
  });
}
