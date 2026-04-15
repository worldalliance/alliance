import type {
  KeyboardEvent,
  MouseEvent,
  PointerEvent,
  ReactNode,
} from "react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@alliance/shared/styles/util";

type ConfettiPiece = {
  id: string;
  color: string;
  dx: number;
  dy: number;
  rotation: number;
  delay: number;
  size: number;
  shape: "circle" | "bar";
};

type ConfettiBurst = {
  id: number;
  originX: number;
  originY: number;
  pieces: ConfettiPiece[];
};

export type ConfettiWrapperRenderProps = {
  disabled: boolean;
  isRunning: boolean;
  onClick: (event: MouseEvent<HTMLElement>) => void;
  onKeyDown: (event: KeyboardEvent<HTMLElement>) => void;
  onPointerDown: (event: PointerEvent<HTMLElement>) => void;
};

export interface ConfettiWrapperProps {
  children: (props: ConfettiWrapperRenderProps) => ReactNode;
  className?: string;
  disabled?: boolean;
  onTrigger: () => void | Promise<void>;
}

const CONFETTI_COLORS = [
  "#22c55e",
  "#fb7185",
  "#f59e0b",
  "#38bdf8",
  "#a78bfa",
  "#f97316",
] as const;

const BURST_LIFETIME_MS = 900;
const POINTER_ACTIVATION_WINDOW_MS = 1500;

function createConfettiPieces(seed: number): ConfettiPiece[] {
  return Array.from({ length: 14 }, (_, index) => {
    const angle = (-100 + index * 15 + seed * 11) * (Math.PI / 180);
    const distance = 22 + ((index + seed) % 4) * 7;
    const verticalLift = 12 + ((index * 3 + seed) % 18);
    return {
      id: `${seed}-${index}`,
      color: CONFETTI_COLORS[(index + seed) % CONFETTI_COLORS.length],
      dx: Math.cos(angle) * distance,
      dy: Math.sin(angle) * distance - verticalLift,
      rotation: -180 + ((index * 47 + seed * 29) % 360),
      delay: index % 2 === 0 ? 0 : 40,
      size: 5 + ((index + seed) % 4),
      shape: index % 3 === 0 ? "circle" : "bar",
    };
  });
}

const confettiStyles = `
@keyframes share-confetti-pop {
  0% {
    opacity: 0;
    transform: translate3d(0, 0, 0) scale(0.35) rotate(0deg);
  }
  12% {
    opacity: 1;
  }
  100% {
    opacity: 0;
    transform:
      translate3d(var(--confetti-x), var(--confetti-y), 0)
      scale(1)
      rotate(var(--confetti-rotate));
  }
}
`;

export default function ConfettiWrapper({
  children,
  className,
  disabled = false,
  onTrigger,
}: ConfettiWrapperProps) {
  const burstIdRef = useRef(0);
  const burstTimeoutsRef = useRef<number[]>([]);
  const wrapperRef = useRef<HTMLSpanElement | null>(null);
  const lastPointerDownRef = useRef<{
    clientX: number;
    clientY: number;
    timestamp: number;
  } | null>(null);
  const [bursts, setBursts] = useState<ConfettiBurst[]>([]);
  const [isRunning, setIsRunning] = useState(false);

  useEffect(() => {
    return () => {
      burstTimeoutsRef.current.forEach((timeoutId) =>
        window.clearTimeout(timeoutId),
      );
    };
  }, []);

  const queueBurst = (originX: number, originY: number) => {
    burstIdRef.current += 1;
    const burstId = burstIdRef.current;
    const burst = {
      id: burstId,
      originX,
      originY,
      pieces: createConfettiPieces(burstId),
    };

    setBursts((current) => [...current, burst]);

    const timeoutId = window.setTimeout(() => {
      burstTimeoutsRef.current = burstTimeoutsRef.current.filter(
        (currentTimeoutId) => currentTimeoutId !== timeoutId,
      );
      setBursts((current) =>
        current.filter((currentBurst) => currentBurst.id !== burstId),
      );
    }, BURST_LIFETIME_MS);

    burstTimeoutsRef.current.push(timeoutId);
  };

  const runTrigger = async (originX: number, originY: number) => {
    if (disabled || isRunning) {
      return;
    }

    setIsRunning(true);

    try {
      await onTrigger();
    } catch {
      setIsRunning(false);
      return;
    }

    setIsRunning(false);

    if (
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      return;
    }

    queueBurst(originX, originY);
  };

  const handlePointerDown = (event: PointerEvent<HTMLElement>) => {
    if (!event.isPrimary || event.button !== 0) {
      lastPointerDownRef.current = null;
      return;
    }

    lastPointerDownRef.current = {
      clientX: event.clientX,
      clientY: event.clientY,
      timestamp: Date.now(),
    };
  };

  const handleClick = (event: MouseEvent<HTMLElement>) => {
    if (disabled || isRunning) {
      event.preventDefault();
      return;
    }

    const wrapperRect = wrapperRef.current?.getBoundingClientRect();

    if (!wrapperRect) {
      return;
    }

    const pointerActivation =
      event.detail > 0 &&
      lastPointerDownRef.current !== null &&
      Date.now() - lastPointerDownRef.current.timestamp <=
        POINTER_ACTIVATION_WINDOW_MS;
    const keyboardActivation =
      event.detail === 0 && document.activeElement === event.currentTarget;

    if (!pointerActivation && !keyboardActivation) {
      return;
    }

    const pointerDown = lastPointerDownRef.current;
    const originX = pointerActivation
      ? pointerDown!.clientX - wrapperRect.left
      : wrapperRect.width / 2;
    const originY = pointerActivation
      ? pointerDown!.clientY - wrapperRect.top
      : wrapperRect.height / 2;

    lastPointerDownRef.current = null;
    void runTrigger(originX, originY);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key !== "Enter" && event.key !== " ") {
      return;
    }

    lastPointerDownRef.current = null;
  };

  return (
    <span
      ref={wrapperRef}
      className={cn("relative isolate inline-flex overflow-visible", className)}
    >
      <style>{confettiStyles}</style>
      <span className="pointer-events-none absolute inset-0 overflow-visible">
        {bursts.map((burst) =>
          burst.pieces.map((piece) => (
            <span
              key={`${burst.id}-${piece.id}`}
              className="absolute"
              style={{
                animationName: "share-confetti-pop",
                animationDuration: "700ms",
                animationTimingFunction: "cubic-bezier(0.2, 0.8, 0.2, 1)",
                animationFillMode: "forwards",
                animationDelay: `${piece.delay}ms`,
                backgroundColor: piece.color,
                borderRadius: piece.shape === "circle" ? "9999px" : "2px",
                height: piece.shape === "circle" ? `${piece.size}px` : "4px",
                left: `${burst.originX}px`,
                top: `${burst.originY}px`,
                width: piece.shape === "circle" ? `${piece.size}px` : `${piece.size + 3}px`,
                marginLeft:
                  piece.shape === "circle"
                    ? `${piece.size / -2}px`
                    : `${(piece.size + 3) / -2}px`,
                marginTop:
                  piece.shape === "circle" ? `${piece.size / -2}px` : "-2px",
                ["--confetti-x" as string]: `${piece.dx}px`,
                ["--confetti-y" as string]: `${piece.dy}px`,
                ["--confetti-rotate" as string]: `${piece.rotation}deg`,
              }}
            />
          )),
        )}
      </span>
      {children({
        disabled: disabled || isRunning,
        isRunning,
        onClick: handleClick,
        onKeyDown: handleKeyDown,
        onPointerDown: handlePointerDown,
      })}
    </span>
  );
}
