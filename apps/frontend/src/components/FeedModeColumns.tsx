import { cn } from "@alliance/shared/styles/util";
import Button, { ButtonColor } from "@alliance/sharedweb/ui/Button";
import {
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

export enum FeedMode {
  Friends = "friends",
  Everyone = "everyone",
}

const MODE_OFFSET: Record<FeedMode, string> = {
  [FeedMode.Friends]: "translateX(0%)",
  [FeedMode.Everyone]: "translateX(-50%)",
};

interface FeedModeColumnsProps {
  renderColumn: (mode: FeedMode) => ReactNode;
  trailing?: ReactNode;
}

/** Friends/everyone tabs over two side-by-side columns that slide between modes, sized to the active one. */
const FeedModeColumns = ({ renderColumn, trailing }: FeedModeColumnsProps) => {
  const [mode, setMode] = useState(FeedMode.Friends);
  const columnsRef = useRef<Partial<Record<FeedMode, HTMLDivElement | null>>>(
    {},
  );

  const [activeHeight, setActiveHeight] = useState<number | undefined>(
    undefined,
  );

  const updateHeight = useCallback(() => {
    const el = columnsRef.current[mode];
    if (el) setActiveHeight(el.offsetHeight);
  }, [mode]);

  useEffect(() => {
    const observer = new ResizeObserver(updateHeight);
    for (const el of Object.values(columnsRef.current)) {
      if (el) observer.observe(el);
    }

    window.addEventListener("resize", updateHeight);
    requestAnimationFrame(updateHeight);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", updateHeight);
    };
  }, [mode, updateHeight]);

  return (
    <>
      <div className="mx-auto flex flex-row gap-x-2 mb-4 w-full justify-between items-center">
        <div className=" flex flex-row gap-x-2 justify-start">
          {Object.values(FeedMode).map((m) => (
            <Button
              color={ButtonColor.Transparent}
              key={m}
              onClick={() => setMode(m)}
              aria-pressed={m === mode}
              className={cn(
                "!border-b-[2px] rounded-none",
                m === mode
                  ? "border-b-green! text-black"
                  : "border-b-transparent! hover:border-b-zinc-200! text-zinc-500",
              )}
            >
              <p className="capitalize text-base">{m}</p>
            </Button>
          ))}
        </div>
        {trailing}
      </div>

      <div
        className="relative overflow-hidden bg-white"
        style={{ height: activeHeight }}
      >
        <div
          className="flex w-[200%] transition-transform duration-200 ease-out motion-reduce:transition-none"
          style={{ transform: MODE_OFFSET[mode] }}
        >
          {Object.values(FeedMode).map((m) => (
            <div key={m} className="w-1/2">
              <div
                ref={(el) => {
                  columnsRef.current[m] = el;
                }}
              >
                {renderColumn(m)}
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
};

export default FeedModeColumns;
