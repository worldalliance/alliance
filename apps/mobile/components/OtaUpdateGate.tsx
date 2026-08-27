import { ExceptionEvent } from "@alliance/common/analytics";
import { captureException } from "@alliance/shared/lib/analytics";
import { StatusBar } from "expo-status-bar";
import {
  Component,
  useCallback,
  useEffect,
  useState,
  type ErrorInfo,
  type ReactNode,
} from "react";
import { Image, View } from "react-native";
import {
  SPLASH_BACKGROUND_COLOR,
  SPLASH_IMAGE,
  SPLASH_IMAGE_WIDTH,
} from "../constants/splash";
import { OtaGatePhase } from "../lib/otaGateMachine";
import { hideSplash } from "../lib/splash";
import { useOtaUpdateGate } from "../lib/useOtaUpdateGate";
import Button, { ButtonColor } from "./system/Button";
import ProgressBar from "./system/ProgressBar";
import Text, { TextStyle } from "./system/Text";

// A fast download finishes before anyone reads a button. Holding the skip
// control back keeps it from flashing on screen for users who never needed it.
const SKIP_VISIBLE_AFTER_MS = 4_000;

// Whether the gate draws something of its own in this phase. The splash comes
// down as soon as it does. The phases that draw nothing leave it up, one until
// the check ends, the other until the app itself is on screen.
const DRAWS_SCREEN: Record<OtaGatePhase, boolean> = {
  [OtaGatePhase.Checking]: false,
  [OtaGatePhase.Downloading]: true,
  [OtaGatePhase.Applying]: true,
  [OtaGatePhase.Open]: false,
};

const UpdatingScreen = ({
  progress,
  onSkip,
}: {
  progress: number | null;
  onSkip: (() => void) | null;
}) => (
  <View
    className="flex-1 items-center justify-center px-10"
    style={{ backgroundColor: SPLASH_BACKGROUND_COLOR }}
  >
    <StatusBar style="dark" />
    <Image
      source={SPLASH_IMAGE}
      // The source art is square, so the splash's width is both dimensions.
      style={{ width: SPLASH_IMAGE_WIDTH, height: SPLASH_IMAGE_WIDTH }}
      resizeMode="contain"
    />
    <View className="absolute bottom-24 left-10 right-10 gap-3">
      <ProgressBar percentage={progress === null ? null : progress * 100} />
      <Text type={TextStyle.Secondary} className="text-center text-sm">
        Updating Alliance…
      </Text>
      {onSkip && (
        <Button
          title="Continue without updating"
          color={ButtonColor.Transparent}
          onPress={onSkip}
        />
      )}
    </View>
  </View>
);

/**
 * Shows a splash-alike progress screen while a freshly published update
 * downloads, then reloads into it. Calls `onOpen` once there is nothing left to
 * wait for, including in development, where `expo-updates` is disabled.
 */
const Gate = ({ onOpen }: { onOpen: () => void }) => {
  const { phase, progress, skip } = useOtaUpdateGate();
  const [skipVisible, setSkipVisible] = useState(false);

  useEffect(() => {
    if (!DRAWS_SCREEN[phase]) return;
    hideSplash();
  }, [phase]);

  useEffect(() => {
    if (phase === OtaGatePhase.Open) onOpen();
  }, [phase, onOpen]);

  useEffect(() => {
    if (phase !== OtaGatePhase.Downloading) return;
    const timer = setTimeout(() => setSkipVisible(true), SKIP_VISIBLE_AFTER_MS);
    return () => clearTimeout(timer);
  }, [phase]);

  switch (phase) {
    // The native splash is still up and covers the whole screen. Rendering the
    // app underneath it would run mount effects we are about to throw away by
    // reloading, so render nothing.
    case OtaGatePhase.Checking:
      return null;

    case OtaGatePhase.Downloading:
      return (
        <UpdatingScreen
          progress={progress}
          onSkip={skipVisible ? skip : null}
        />
      );

    // The reload screen covers this within a frame or two. It only stays up
    // long enough to read if the reload stalls, and there is nothing left to
    // skip by then, so the control would be a button that does nothing.
    case OtaGatePhase.Applying:
      return <UpdatingScreen progress={1} onSkip={null} />;

    // The app takes over in the commit after this one.
    case OtaGatePhase.Open:
      return null;

    default:
      throw new Error(`unknown gate phase: ${phase satisfies never}`);
  }
};

/**
 * The gate is the only thing that hides the splash, so a crash inside it would
 * otherwise leave the splash up forever with no way to reach the app. Falls
 * through to the app on the bundle we already have, which is the same answer
 * the gate gives for every other kind of failure.
 */
class GateBoundary extends Component<
  { children: ReactNode; onCrash: () => void },
  { crashed: boolean }
> {
  state = { crashed: false };

  static getDerivedStateFromError() {
    return { crashed: true };
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    captureException(ExceptionEvent.OtaGateCrashed, error, {
      componentStack: info.componentStack,
    });
    this.props.onCrash();
  }

  render() {
    return this.state.crashed ? null : this.props.children;
  }
}

/**
 * Holds the app behind the gate until an update has landed or there is nothing
 * to wait for. The app renders as the gate's sibling rather than its child, so
 * the boundary above covers the gate and nothing else, and an app crash keeps
 * failing the way it did before the gate existed.
 */
const OtaUpdateGate = ({ children }: { children: ReactNode }) => {
  const [open, setOpen] = useState(false);
  const onOpen = useCallback(() => setOpen(true), []);

  useEffect(() => {
    if (!open) return;
    hideSplash();
  }, [open]);

  if (open) return children;

  return (
    <GateBoundary onCrash={onOpen}>
      <Gate onOpen={onOpen} />
    </GateBoundary>
  );
};

export default OtaUpdateGate;
