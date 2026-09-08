import { useMyCommunities } from "@alliance/shared/lib/useMyCommunities";
import { useGlobalSearchParams, usePathname, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { useWindowDimensions, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAppDrawer } from "../../lib/AppDrawerContext";
import {
  motion,
  onboardingColors,
  useOnboardingScale,
} from "../../lib/onboarding/scale";
import {
  useWalkthroughAnchors,
  WalkthroughAnchor,
  type AnchorBox,
} from "../../lib/onboarding/walkthrough";
import {
  WALKTHROUGH_ENTRY_PARAM,
  WALKTHROUGH_PARAM,
  WALKTHROUGH_STEPS,
  type WalkthroughContext,
} from "../../lib/onboarding/walkthroughSteps";
import Button, { ButtonColor, ButtonSize } from "../system/Button";
import Text, { FontWeight } from "../system/Text";

const PADDING = 8;

const SHADE = "rgba(0,0,0,0.6)";

/** Clear space kept between an anchor and the edges it is scrolled between. */
const SAFE_GAP = 16;

/** Enough to settle a smooth scroll, without letting a fight run forever. */
const MAX_SCROLLS = 4;

const SCROLL_SETTLE_MS = 420;

/**
 * How far to scroll to bring `box` into the band above the dialogue. An anchor
 * taller than the band gets its head pinned to the top instead.
 */
function scrollDelta(box: AnchorBox, safeBottom: number) {
  const top = SAFE_GAP;
  const bottom = safeBottom - SAFE_GAP;
  if (box.height > bottom - top || box.top < top) return box.top - top;
  if (box.top + box.height > bottom) return box.top + box.height - bottom;
  return 0;
}

/**
 * Four shades and a ring, each easing to the anchor on the UI thread, so a
 * step change glides rather than jumping between two boxes.
 */
function Spotlight({
  box,
  visible,
}: {
  box: AnchorBox | undefined;
  visible: boolean;
}) {
  const { width, height } = useWindowDimensions();

  // Clamped to the window: an anchor taller than the screen would otherwise
  // make shades thousands of pixels long.
  const target = box
    ? {
        top: Math.max(box.top - PADDING, 0),
        bottom: Math.min(box.top + box.height + PADDING, height),
        left: Math.max(box.left - PADDING, 0),
        right: Math.min(box.left + box.width + PADDING, width),
      }
    : { top: 0, bottom: height, left: 0, right: width };

  const top = useSharedValue(target.top);
  const bottom = useSharedValue(target.bottom);
  const left = useSharedValue(target.left);
  const right = useSharedValue(target.right);
  const settled = useRef(false);

  useEffect(() => {
    // The first box lands where it is; later ones travel there.
    const to = (value: number) =>
      settled.current
        ? withTiming(value, { duration: motion.spotlightMs })
        : value;
    top.value = to(target.top);
    bottom.value = to(target.bottom);
    left.value = to(target.left);
    right.value = to(target.right);
    settled.current = true;
  }, [
    target.top,
    target.bottom,
    target.left,
    target.right,
    top,
    bottom,
    left,
    right,
  ]);

  const topShade = useAnimatedStyle(() => ({ height: top.value }));
  const bottomShade = useAnimatedStyle(() => ({ top: bottom.value }));
  const leftShade = useAnimatedStyle(() => ({
    top: top.value,
    width: left.value,
    height: Math.max(bottom.value - top.value, 0),
  }));
  const rightShade = useAnimatedStyle(() => ({
    top: top.value,
    left: right.value,
    height: Math.max(bottom.value - top.value, 0),
  }));
  const ring = useAnimatedStyle(() => ({
    top: top.value,
    left: left.value,
    width: Math.max(right.value - left.value, 0),
    height: Math.max(bottom.value - top.value, 0),
    opacity: visible ? 1 : 0,
  }));

  const shade = {
    position: "absolute" as const,
    backgroundColor: SHADE,
  };

  return (
    <>
      <Animated.View style={[shade, { top: 0, left: 0, right: 0 }, topShade]} />
      <Animated.View
        style={[shade, { left: 0, right: 0, bottom: 0 }, bottomShade]}
      />
      <Animated.View style={[shade, { left: 0 }, leftShade]} />
      <Animated.View style={[shade, { right: 0 }, rightShade]} />
      <Animated.View
        pointerEvents="none"
        style={[
          {
            position: "absolute",
            borderRadius: 10,
            borderWidth: 2,
            borderColor: "rgba(255,255,255,0.85)",
          },
          ring,
        ]}
      />
    </>
  );
}

export function Walkthrough() {
  // Global, not local: this overlay is mounted in the layout, where the
  // focused route's own params are not in scope.
  const params = useGlobalSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const scale = useOnboardingScale();
  const insets = useSafeAreaInsets();
  const { selectedCommunity } = useMyCommunities();
  const { boxes, activeAnchor, setActiveAnchor, scrollBy, chromeBottom } =
    useWalkthroughAnchors();
  const { height: windowHeight } = useWindowDimensions();
  const { openDrawer, closeDrawer } = useAppDrawer();

  // The parameter only starts the tour; the step it is on lives here after
  // that. Clearing a parameter does not stick — an empty `params` merges, and
  // the global value outlives the navigation that dropped it — so a tour driven
  // by the URL could never be dismissed.
  const [index, setIndex] = useState(-1);
  const [dialogueTop, setDialogueTop] = useState<number | null>(null);
  const entered = useRef<string | null>(null);
  const step0 = params[WALKTHROUGH_PARAM];
  const nonce = params[WALKTHROUGH_ENTRY_PARAM];
  const entry = typeof step0 === "string" ? `${step0}:${nonce ?? ""}` : null;

  useEffect(() => {
    if (entry === null || entered.current === entry) return;
    entered.current = entry;
    setIndex(Number(step0));
  }, [entry, step0]);

  const step = WALKTHROUGH_STEPS[index];
  const onStepPath = Boolean(step) && pathname === step.path;

  useEffect(() => {
    setActiveAnchor(step && onStepPath ? (step.anchor ?? null) : null);
  }, [step, onStepPath, setActiveAnchor]);

  useEffect(() => {
    if (!step || onStepPath) return;
    router.replace(step.path);
  }, [step, onStepPath, router]);

  const targetBox = activeAnchor ? boxes[activeAnchor] : undefined;

  // The dialogue covers the foot of the screen, so an anchor is scrolled into
  // what is left above it rather than to the window's own middle.
  const scrollsDone = useRef(0);
  useEffect(() => {
    scrollsDone.current = 0;
  }, [index]);

  useEffect(() => {
    if (!targetBox || !scrollBy) return;
    const delta = scrollDelta(targetBox, dialogueTop ?? windowHeight * 0.62);
    if (Math.abs(delta) <= 8 || scrollsDone.current >= MAX_SCROLLS) return;
    scrollsDone.current += 1;
    const timer = setTimeout(() => scrollBy(delta), SCROLL_SETTLE_MS);
    return () => clearTimeout(timer);
  }, [targetBox, scrollBy, windowHeight, dialogueTop]);

  // The drawer holds the membership link, so the step that names it opens it.
  const needsDrawer = step?.anchor === WalkthroughAnchor.MembershipLink;

  useEffect(() => {
    if (!needsDrawer) return;
    openDrawer();
    return () => closeDrawer();
  }, [needsDrawer, openDrawer, closeDrawer]);

  if (!step || !onStepPath) return null;

  const context: WalkthroughContext = {
    groupName: selectedCommunity?.name ?? null,
  };
  // An anchor still off-screen loses the spotlight rather than drawing a
  // degenerate one; the step keeps its say either way.
  const onScreen =
    targetBox !== undefined &&
    targetBox.top + targetBox.height > 0 &&
    targetBox.top < windowHeight;
  const spotlight = onScreen ? targetBox : undefined;
  const isLast = index + 1 === WALKTHROUGH_STEPS.length;

  const close = () => setIndex(-1);

  const advance = () => {
    const next = index + 1;
    if (next >= WALKTHROUGH_STEPS.length) {
      close();
      return;
    }
    setIndex(next);
    if (WALKTHROUGH_STEPS[next].path !== pathname) {
      router.replace(WALKTHROUGH_STEPS[next].path);
    }
  };

  return (
    <View
      style={{ position: "absolute", inset: 0 }}
      testID="vr-walkthrough-ready"
    >
      <Spotlight box={spotlight} visible={spotlight !== undefined} />

      <View
        accessibilityRole="alert"
        onLayout={(event) => setDialogueTop(event.nativeEvent.layout.y)}
        className="absolute inset-x-3 rounded-xl p-4"
        style={{
          bottom: step.dockBottom
            ? insets.bottom + 12
            : Math.max(chromeBottom, insets.bottom) + 12,
          backgroundColor: onboardingColors.panelGreen,
          shadowColor: "#000",
          shadowOpacity: 0.7,
          shadowRadius: 30,
          shadowOffset: { width: 0, height: 18 },
          elevation: 12,
        }}
      >
        <View className="flex-row items-start justify-between gap-4">
          <Text
            weight={FontWeight.Semibold}
            className="flex-1 text-white"
            style={{ fontSize: scale.body }}
          >
            {step.title(context)}
          </Text>
          <Text className="text-white/60" style={{ fontSize: scale.caption }}>
            {index + 1} of {WALKTHROUGH_STEPS.length}
          </Text>
        </View>
        <Text
          className="mt-1 text-white/85"
          style={{ fontSize: scale.ui, lineHeight: scale.ui * 1.35 }}
        >
          {step.body(context)}
        </Text>
        <View className="mt-3 flex-row gap-3">
          <Button
            color={ButtonColor.Transparent}
            size={ButtonSize.Custom}
            className="min-h-11 flex-1 rounded-lg border border-white/70 py-3"
            onPress={close}
          >
            <Text className="text-white" weight={FontWeight.Medium}>
              Skip
            </Text>
          </Button>
          <Button
            color={ButtonColor.White}
            size={ButtonSize.Custom}
            className="min-h-11 flex-1 rounded-lg border-transparent py-3"
            onPress={advance}
            testID="vr-walkthrough-next"
          >
            <Text
              weight={FontWeight.Medium}
              style={{ color: onboardingColors.panelGreen }}
            >
              {isLast ? "Get started" : "Next"}
            </Text>
          </Button>
        </View>
      </View>
    </View>
  );
}
