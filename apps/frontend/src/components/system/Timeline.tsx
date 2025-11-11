import React, {
  CSSProperties,
  ReactNode,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

interface TimelineProps {
  children: ReactNode[];
  lineWidth?: number;
  dotSize?: number;
  lineColor?: string;
  dotColor?: string;
  className?: string;
}

const Timeline: React.FC<TimelineProps> = ({
  children,
  lineWidth = 2,
  dotSize = 12,
  lineColor = "var(--color-zinc-200)",
  className,
}) => {
  const halfDot = useMemo(() => dotSize / 2, [dotSize]);

  const bottomElementRef = useRef<HTMLLIElement>(null);

  const [lineStyle, setLineStyle] = useState<CSSProperties>({
    width: lineWidth,
    backgroundColor: lineColor,
    top: halfDot,
    bottom: bottomElementRef.current
      ? bottomElementRef.current.clientHeight - halfDot
      : 0,
  });

  useEffect(() => {
    setLineStyle({
      width: lineWidth,
      backgroundColor: lineColor,
      top: halfDot,
      bottom: bottomElementRef.current
        ? bottomElementRef.current.clientHeight - halfDot
        : 0,
    });
  }, [bottomElementRef, lineWidth, lineColor, halfDot]);

  const dotBaseStyle: CSSProperties = {
    width: dotSize + 6,
    height: dotSize + 6,
    border: `3px solid white`,
    aspectRatio: 1,
    borderRadius: "50%",
    position: "absolute",
    left: `-${dotSize / 2 + 3}px`,
    top: 0,
    bottom: 0,
  };

  return (
    <div className={`relative pl-2 ${className ?? ""}`}>
      {/* vertical line */}
      <div className="absolute top-0 bottom-0 -ml-[1px]" style={lineStyle} />

      <ul className="space-y-6">
        {React.Children.map(children, (child, index) => (
          <li
            className="relative"
            key={index}
            ref={index === children.length - 1 ? bottomElementRef : null}
          >
            {/* timeline dot */}
            <div
              style={{ ...dotBaseStyle }}
              className={`relative ${
                index === 0 ? "bg-green" : "bg-zinc-200"
              } mt-1 flex items-center justify-center`}
            ></div>
            {/* content */}
            <div className="pl-6">{child}</div>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default Timeline;
