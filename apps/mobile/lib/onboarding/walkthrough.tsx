import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  View,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type StyleProp,
  type ViewStyle,
} from "react-native";

export enum WalkthroughAnchor {
  CurrentTask = "current-task",
  GroupsTab = "groups-tab",
  Group = "group",
  MembershipLink = "membership-link",
  AwayRanges = "away-ranges",
  TaskList = "task-list",
}

export type AnchorBox = {
  top: number;
  left: number;
  width: number;
  height: number;
};

type ScrollBy = (delta: number) => void;

type WalkthroughContextValue = {
  boxes: Partial<Record<WalkthroughAnchor, AnchorBox>>;
  activeAnchor: WalkthroughAnchor | null;
  setActiveAnchor: (anchor: WalkthroughAnchor | null) => void;
  report: (anchor: WalkthroughAnchor, box: AnchorBox | null) => void;
  /** The focused screen's scroller, so an anchor below the fold can be reached. */
  scrollBy: ScrollBy | null;
  setScrollBy: (scrollBy: ScrollBy | null) => void;
  /** Height of the app's own bottom chrome, which the dialogue sits above. */
  chromeBottom: number;
  setChromeBottom: (height: number) => void;
};

const WalkthroughContext = createContext<WalkthroughContextValue | null>(null);

export function WalkthroughAnchorProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [boxes, setBoxes] = useState<
    Partial<Record<WalkthroughAnchor, AnchorBox>>
  >({});
  const [activeAnchor, setActiveAnchor] = useState<WalkthroughAnchor | null>(
    null,
  );
  const [scrollBy, setScrollBy] = useState<ScrollBy | null>(null);
  const [chromeBottom, setChromeBottom] = useState(0);

  const report = useCallback(
    (anchor: WalkthroughAnchor, box: AnchorBox | null) => {
      setBoxes((previous) => {
        const current = previous[anchor];
        if (box === null) {
          if (!current) return previous;
          const next = { ...previous };
          delete next[anchor];
          return next;
        }
        if (
          current &&
          Math.abs(current.top - box.top) < 1 &&
          Math.abs(current.left - box.left) < 1 &&
          Math.abs(current.width - box.width) < 1 &&
          Math.abs(current.height - box.height) < 1
        ) {
          return previous;
        }
        return { ...previous, [anchor]: box };
      });
    },
    [],
  );

  const value = useMemo(
    () => ({
      boxes,
      activeAnchor,
      setActiveAnchor,
      report,
      scrollBy,
      setScrollBy,
      chromeBottom,
      setChromeBottom,
    }),
    [boxes, activeAnchor, report, scrollBy, chromeBottom],
  );

  return (
    <WalkthroughContext.Provider value={value}>
      {children}
    </WalkthroughContext.Provider>
  );
}

export function useWalkthroughAnchors() {
  const context = useContext(WalkthroughContext);
  if (!context) {
    throw new Error("useWalkthroughAnchors outside WalkthroughAnchorProvider");
  }
  return context;
}

/** Wraps whatever a walkthrough step points at, reporting where it landed. */
export function Anchor({
  name,
  className,
  style,
  children,
}: {
  name: WalkthroughAnchor;
  className?: string;
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
}) {
  const context = useContext(WalkthroughContext);
  const ref = useRef<View>(null);
  const active = context?.activeAnchor === name;

  const measure = useCallback(() => {
    if (!context) return;
    ref.current?.measureInWindow((left, top, width, height) => {
      if (!width || !height) {
        context.report(name, null);
        return;
      }
      context.report(name, { top, left, width, height });
    });
  }, [context, name]);

  // Per frame while this anchor is the one being pointed at: a scroll or a
  // drawer sliding open fires no layout, and anything slower visibly lags.
  useEffect(() => {
    if (!active) return;
    let frame = 0;
    const tick = () => {
      measure();
      frame = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(frame);
  }, [active, measure]);

  return (
    <View ref={ref} className={className} style={style} onLayout={measure}>
      {children}
    </View>
  );
}

/**
 * Spread onto the scrollable a walkthrough step points into, so a step whose
 * anchor sits below the fold can bring it up rather than spotlighting nothing.
 */
/** Either scrolling API in use here: ScrollView's, and LegendList's. */
type Scrollable =
  | { scrollTo: (options: { y: number; animated?: boolean }) => void }
  | {
      scrollToOffset: (params: { offset: number; animated?: boolean }) => void;
    };

export function useWalkthroughScroll() {
  const context = useContext(WalkthroughContext);
  const offset = useRef(0);
  const scroller = useRef<Scrollable | null>(null);

  useEffect(() => {
    if (!context) return;
    const { setScrollBy } = context;
    setScrollBy(() => (delta: number) => {
      const node = scroller.current;
      if (!node) return;
      const y = Math.max(offset.current + delta, 0);
      if ("scrollTo" in node) {
        node.scrollTo({ y, animated: true });
        return;
      }
      node.scrollToOffset({ offset: y, animated: true });
    });
    return () => setScrollBy(null);
    // Only the setter matters; re-running on every box change would thrash it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [context?.setScrollBy]);

  return {
    // A callback ref, so this fits any scrollable that can scrollTo rather
    // than only a bare ScrollView.
    ref: (node: Scrollable | null) => {
      scroller.current = node;
    },
    scrollEventThrottle: 32,
    onScroll: (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      offset.current = event.nativeEvent.contentOffset.y;
    },
  };
}

/**
 * Reports the tab bar's height, so the walkthrough's own controls clear it
 * rather than covering the navigation a step is pointing at.
 */
export function useReportChromeBottom() {
  const context = useContext(WalkthroughContext);

  return (event: LayoutChangeEvent) => {
    context?.setChromeBottom(event.nativeEvent.layout.height);
  };
}
