import { useMemo } from "react";
import { TextStyle } from "react-native";
import { useResolveClassNames } from "uniwind";
import { lineHeightForWholePoints } from "./lineHeight";

export function useWholePointClassNames(
  classNames: string,
  fontScale: number,
): TextStyle {
  const style = useResolveClassNames(classNames);

  return useMemo(
    () =>
      typeof style.lineHeight === "number"
        ? {
            ...style,
            lineHeight: lineHeightForWholePoints({
              lineHeight: style.lineHeight,
              fontScale,
            }),
          }
        : style,
    [style, fontScale],
  );
}
