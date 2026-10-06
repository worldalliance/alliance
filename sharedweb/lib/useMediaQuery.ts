import { useEffect, useState } from "react";

type UseMediaQueryOptions = {
  defaultValue?: boolean;
};

export function useMediaQuery(
  query: string,
  { defaultValue = false }: UseMediaQueryOptions = {},
): boolean {
  const [matches, setMatches] = useState<boolean>(defaultValue);

  useEffect(() => {
    const matchMedia = window.matchMedia(query);

    const handleChange = () => {
      setMatches(matchMedia.matches);
    };

    handleChange();

    matchMedia.addEventListener("change", handleChange);

    return () => {
      matchMedia.removeEventListener("change", handleChange);
    };
  }, [query]);

  return matches;
}

export type { UseMediaQueryOptions };
