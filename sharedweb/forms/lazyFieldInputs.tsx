import type { ComponentProps } from "react";
import { lazyFormPart } from "./lazyFormPart";
import type { RankingFieldInput } from "./RankingFieldInput";

export const LazyPhoneNumberInput = lazyFormPart(
  () => import("./PhoneNumberInputWithCountry"),
);

export const LazyRankingFieldInput = lazyFormPart<
  ComponentProps<typeof RankingFieldInput>
>(() =>
  import("./RankingFieldInput").then((module) => ({
    default: module.RankingFieldInput,
  })),
);
