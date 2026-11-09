import { ChevronRight } from "lucide-react";
import React, { useId, useState } from "react";

type FormSectionProps = {
  title: string;
  description?: string;
  children: React.ReactNode;
};

const FRAME = "border border-gray-200 rounded-lg bg-white";
const HEADER = "px-4 py-3 bg-gray-50 rounded-t-lg";
const TITLE = "text-sm font-semibold text-gray-900";

const FormSection: React.FC<FormSectionProps> = ({
  title,
  description,
  children,
}) => (
  <div className={FRAME}>
    <div className={`${HEADER} border-b border-gray-200`}>
      <h3 className={TITLE}>{title}</h3>
      {description && (
        <p className="text-xs text-gray-500 mt-0.5">{description}</p>
      )}
    </div>
    <div className="p-4">{children}</div>
  </div>
);

/** Opens by itself once `inUse`, until the admin toggles it. */
export const CollapsibleFormSection: React.FC<
  Omit<FormSectionProps, "description"> & { inUse: boolean }
> = ({ title, children, inUse }) => {
  const [toggled, setToggled] = useState<boolean | null>(null);
  const [wasInUse, setWasInUse] = useState(inUse);
  if (inUse && !wasInUse) setWasInUse(true);
  const open = toggled ?? wasInUse;
  const contentId = useId();
  return (
    <div className={FRAME}>
      <h3 className={TITLE}>
        <button
          type="button"
          aria-expanded={open}
          aria-controls={contentId}
          onClick={() => setToggled(!open)}
          className={`${HEADER} w-full text-left cursor-pointer flex items-start gap-2 ${open ? "border-b border-gray-200" : "rounded-b-lg"}`}
        >
          <ChevronRight
            aria-hidden
            size={16}
            className={`mt-0.5 shrink-0 text-gray-500 transition-transform ${open ? "rotate-90" : ""}`}
          />
          {title}
        </button>
      </h3>
      <div id={contentId} hidden={!open} className="p-4">
        {children}
      </div>
    </div>
  );
};

export default FormSection;
