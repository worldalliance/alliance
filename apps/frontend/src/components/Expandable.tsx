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
    <div className={`transition w-full`}>
      <div
        className={`group py-4 
            border-b border-zinc-200 hover:border-zinc-500 pb-4 flex items-center justify-between cursor-pointer`}
        onClick={toggleExpand}
      >
        <h2 className="font-ibm !font-medium !text-3xl !my-1">{title}</h2>
        <div className="text-sm text-gray-500">
          <svg
            className={`-mr-1 size-6 text-zinc-300 group-hover:text-black transition group-hover:-rotate-90 ${
              isExpanded ? "-rotate-180" : ""
            }`}
            viewBox="0 0 20 20"
            fill="currentColor"
            aria-hidden="true"
            data-slot="icon"
          >
            <path
              fillRule="evenodd"
              d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06Z"
              clipRule="evenodd"
            />
          </svg>
        </div>
      </div>
      {isExpanded && <div className="mt-6">{children}</div>}
    </div>
  );
};

export default Expandable;
