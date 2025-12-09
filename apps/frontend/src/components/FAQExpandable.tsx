import { useEffect, useRef } from "react";
import Expandable, { ExpandableProps } from "./Expandable";

const FAQExpandable: React.FC<ExpandableProps> = ({
  title,
  children,
  expanded,
}: ExpandableProps) => {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (expanded) {
      ref.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [expanded]);
  return (
    <Expandable title={title} expanded={expanded} ref={ref}>
      <div className="flex flex-col gap-y-4">{children}</div>
    </Expandable>
  );
};

export default FAQExpandable;
