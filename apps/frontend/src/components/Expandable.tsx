import React, { useState, PropsWithChildren } from "react";

export interface ExpandableProps extends PropsWithChildren {
  expanded?: boolean;
  title: string;
  ref?: React.Ref<HTMLDivElement>;
}

const Expandable: React.FC<ExpandableProps> = ({
  expanded = false,
  title,
  children,
  ref,
}) => {
  const [isExpanded, setIsExpanded] = useState(expanded);

  const toggleExpand = () => {
    setIsExpanded(!isExpanded);
  };

  return (
    <div className={`transition w-full`} ref={ref}>
      <div
        className={`group py-2 
            border-b border-zinc-200 hover:border-zinc-500 flex items-center justify-between cursor-pointer`}
        onClick={toggleExpand}
      >
        <h2 className="!font-semibold !text-2xl !my-1">{title}</h2>
        <div className="text-sm text-zinc-500">
          <svg
            className={`-mr-1 size-7 text-zinc-400 group-hover:text-black transition group-hover:-rotate-90 ${
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
