import React, {
  ReactNode,
  CSSProperties,
  useRef,
  useEffect,
  useState,
  useMemo,
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
  dotSize = 20,
  lineColor = "#CBD5E0", // gray-300
  className,
}) => {
  const halfDot = useMemo(() => dotSize / 2 - 0.5, [dotSize]);

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
    width: dotSize,
    height: dotSize,
    aspectRatio: 1,
    borderRadius: "50%",
    position: "absolute",
    left: "-10px",
    top: 0,
    bottom: 0,
  };

  return (
    <div className={`relative pl-2 ${className ?? ""}`}>
      {/* vertical line */}
      <div
        className="absolute top-0 bottom-0 mt-[20px] -ml-[1px]"
        style={lineStyle}
      />

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
              className="border-3 border-white flex items-center justify-center bg-[#318dde] mt-[20px]"
            >
              <div className="w-2 h-2 bg-white rounded-full" />
            </div>
            {/* content */}
            <div className="pl-4">{child}</div>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default Timeline;
