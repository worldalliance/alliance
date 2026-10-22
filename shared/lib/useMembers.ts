import { useQuery } from "@tanstack/react-query";
import { userMembers } from "../client";
import { queryKeys } from "./queryKeys";

/** Every member, whatever their contract state. */
export const useMembers = () =>
  useQuery({
    queryKey: queryKeys.members(),
    queryFn: () => userMembers({ throwOnError: true }).then((res) => res.data),
  });
