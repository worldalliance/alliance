import { milliseconds } from "date-fns";
import { millisecondsInDay } from "date-fns/constants";
import { useEffect, useMemo, useRef, useState } from "react";

const DATE_WIDTH = milliseconds({ days: 14 });

const NewActionTimeline = () => {
  const [viewWidth, setViewWidth] = useState(milliseconds({ days: 7 }));
  const [viewCenter, setViewCenter] = useState(new Date().getTime());

  const startDate = useMemo(
    () => new Date(new Date().getTime() - DATE_WIDTH / 2),
    [],
  );
  const endDate = useMemo(
    () => new Date(startDate.getTime() + DATE_WIDTH),
    [startDate],
  );

  const outerRef = useRef<HTMLDivElement>(null);

  const timeToPixel = (date: number) => {
    return (
      ((date - viewCenter + viewWidth / 2) / viewWidth) *
      (outerRef.current?.clientWidth ?? 1000)
    );
  };

  useEffect(() => {
    const canvas = outerRef.current;
    if (!canvas) return;

    const handleScroll = (event: WheelEvent) => {
      event.preventDefault();

      const { deltaX, deltaY } = event;

      setViewWidth((old) => old + (deltaY * old) / 1000);
      setViewCenter((old) => old + (deltaX * old) / 2000);
    };

    canvas.addEventListener("wheel", handleScroll);
    return () => {
      canvas.removeEventListener("wheel", handleScroll);
    };
  }, []);

  const dates = useMemo((): Date[] => {
    const nRange =
      (endDate.getTime() - startDate.getTime()) / millisecondsInDay;
    const dates: Date[] = [];
    for (let i = 0; i <= nRange; i++) {
      dates.push(new Date(startDate.getTime() + i * millisecondsInDay));
    }
    return dates;
  }, [startDate, endDate]);

  return (
    <div className="w-full min-h-36 bg-zinc-100 relative" ref={outerRef}>
      {dates.map((date, index) => (
        <div
          key={index}
          className="absolute top-4 bottom-0 bg-zinc-100 text-sm text-zinc-600 font-mono pt-1"
          style={{
            left: `${timeToPixel(
              startDate.getTime() + index * millisecondsInDay,
            )}px`,
            fontWeight: 450,
          }}
        >
          <div className="absolute top-0 left-0 right-0 m-auto w-[1.5px] h-1 bg-zinc-600"></div>
          {date.getDate()}
        </div>
      ))}
      <div
        style={{
          left: timeToPixel(Date.now()),
          width: "1px",
          top: "0px",
          height: "100%",
        }}
        className="absolute bg-blue-500"
      ></div>
    </div>
  );
};

export default NewActionTimeline;
