import { useMemo } from "react";
import { TextStyle } from "react-native";
import { useResolveClassNames } from "uniwind";
import { wholePointStyle } from "./lineHeight";

export function useWholePointClassNames(
  classNames: string,
  fontScale: number,
): TextStyle {
  const style = useResolveClassNames(classNames);

  return useMemo(
    () => wholePointStyle({ style, fontScale, classNames }),
    [style, fontScale, classNames],
  );
}
