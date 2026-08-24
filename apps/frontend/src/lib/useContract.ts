import { contractGetCurrent } from "@alliance/shared/client";
import { PLACEHOLDER_CONTRACT_MARKDOWN } from "@alliance/shared/lib/contract";
import { useQuery } from "@tanstack/react-query";

export function useContract() {
  const { data: latestContract } = useQuery({
    queryKey: ["contractGetCurrent"],
    queryFn: () => contractGetCurrent().then((res) => res.data ?? null),
    initialData: {
      id: 1,
      markdown: PLACEHOLDER_CONTRACT_MARKDOWN,
      description: [],
    },
  });

  return { latestContract };
}
