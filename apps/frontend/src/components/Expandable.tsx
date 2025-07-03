import React, { useState, PropsWithChildren } from "react";

interface ExpandableProps extends PropsWithChildren {
  expanded?: boolean;
  title: string;
}

const Expandable: React.FC<ExpandableProps> = ({
  expanded = false,
  title,
  children,
}) => {
  const [isExpanded, setIsExpanded] = useState(expanded);

  const toggleExpand = () => {
    setIsExpanded(!isExpanded);
  };

  return (
    <div className="border border-gray-400 py-3 px-4 w-full">
      <div
        className="flex items-center justify-between cursor-pointer"
        onClick={toggleExpand}
      >
        <h2 className="font-avenir text-2xl">{title}</h2>
        <span className="text-sm text-gray-500">{isExpanded ? "▲" : "▼"}</span>
      </div>
      {isExpanded && <div className="mt-2">{children}</div>}
    </div>
  );
};

export default Expandable;
