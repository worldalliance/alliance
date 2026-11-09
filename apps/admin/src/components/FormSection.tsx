import { ChevronRight } from "lucide-react";
import React, { useState } from "react";

type FormSectionProps = {
  title: string;
  description?: string;
  children: React.ReactNode;
};

const FRAME = "border border-gray-200 rounded-lg bg-white";
const HEADER = "px-4 py-3 bg-gray-50 rounded-t-lg";

const SectionHeading = ({
  title,
  description,
}: Omit<FormSectionProps, "children">) => (
  <>
    <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
    {description && (
      <p className="text-xs text-gray-500 mt-0.5">{description}</p>
    )}
  </>
);

const FormSection: React.FC<FormSectionProps> = ({
  title,
  description,
  children,
}) => (
  <div className={FRAME}>
    <div className={`${HEADER} border-b border-gray-200`}>
      <SectionHeading title={title} description={description} />
    </div>
    <div className="p-4">{children}</div>
  </div>
);

/** Opens by itself while `inUse`, until the admin toggles it. */
export const CollapsibleFormSection: React.FC<
  FormSectionProps & { inUse: boolean }
> = ({ title, description, children, inUse }) => {
  const [toggled, setToggled] = useState<boolean | null>(null);
  const [wasInUse, setWasInUse] = useState(inUse);
  if (inUse && !wasInUse) setWasInUse(true);
  const open = toggled ?? wasInUse;
  return (
    <details
      open={open}
      onToggle={(e) => {
        if (e.currentTarget.open !== open) setToggled(e.currentTarget.open);
      }}
      className={FRAME}
    >
      <summary
        className={`${HEADER} cursor-pointer [&::-webkit-details-marker]:hidden list-none flex items-start gap-2 ${open ? "border-b border-gray-200" : "rounded-b-lg"}`}
      >
        <ChevronRight
          aria-hidden
          size={16}
          className={`mt-0.5 shrink-0 text-gray-500 transition-transform ${open ? "rotate-90" : ""}`}
        />
        <div>
          <SectionHeading title={title} description={description} />
        </div>
      </summary>
      <div className="p-4">{children}</div>
    </details>
  );
};

export default FormSection;
