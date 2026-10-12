import DATA from "../data.json";

type CI = { m: number; lo: number; hi: number; n: number };
export type Person = {
  c: number;
  g: string | null;
  a: string | null;
  pre: string | null;
  post: string | null;
};

export const D = DATA as unknown as {
  movementBandsMean: Record<
    "reduction" | "comparison",
    { days: CI[]; base: CI; avg: CI }
  >;
  difficultyGap: { labels: string[]; counts: number[]; n: number };
  difficulties: { rows: { label: string; before: number; after: number }[] };
  predictorPeople: Person[];
  plan: { n: number; segments: { label: string; count: number }[] };
};
