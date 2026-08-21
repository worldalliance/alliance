import { cn } from "@alliance/shared/styles/util";
import { ChevronDown } from "lucide-react";
import { useState } from "react";
import { useOutsideClick } from "../../sharedweb/lib/useOutsideClick";

type EnumType = Record<string, string | number>;

type KVPair<T extends EnumType> = {
  [K in keyof T]: [key: K, value: T[K]];
}[keyof T];

type DropdownSelectProps<T extends EnumType> = {
  titleOverride?: string;
  options: T;
  secondaryLabel?: (args: KVPair<T>) => string | undefined;
  value: T[keyof T];
  onChange: (args: KVPair<T>) => void;
  /** Option keys that render as visually distinguished button-style items */
  buttonOptionKeys?: (keyof T)[];
  /** Icons for different keys */
  keyIcons?: Record<keyof T, React.ReactNode>;
  size?: "small" | "medium" | "large";
  dropdownAlignment?: "left" | "right";
  dropdownWidth?: "small" | "medium" | "large";
};

function DropdownSelect<T extends EnumType>({
  titleOverride,
  options,
  secondaryLabel,
  value,
  onChange,
  buttonOptionKeys,
  keyIcons,
  size = "medium",
  dropdownAlignment = "left",
  dropdownWidth = "small",
}: DropdownSelectProps<T>) {
  const [isOpen, setIsOpen] = useState(false);

  const ref = useOutsideClick(() => setIsOpen(false));
  const isButtonOption = (key: keyof T) =>
    Boolean(buttonOptionKeys?.includes(key));

  const sizeClass = {
    small: "text-sm",
    medium: "text-base",
    large: "text-lg",
  }[size];

  const dropdownWidthClass = {
    small: "w-[220px]",
    medium: "w-[280px]",
    large: "w-[340px]",
  }[dropdownWidth];

  return (
    <div className="relative">
      <button
        className={cn(
          "border border-grey-2 text-black bg-white hover:bg-zinc-50 px-3 rounded-sm py-2 flex flex-row gap-x-2 items-center",
          sizeClass,
        )}
        style={{
          fontWeight: 450,
        }}
        onClick={() => setIsOpen(!isOpen)}
      >
        <span>{titleOverride ?? value}</span> <ChevronDown size="15" />
      </button>
      <div
        className={cn(
          "absolute z-10 top-[calc(100% - 30px)] mt-0.5",
          dropdownAlignment === "left" ? "left-0" : "right-0",
          dropdownWidthClass,
          "bg-white border border-gray-2 overflow-hidden rounded",
          isOpen ? "flex flex-col" : "hidden",
        )}
        ref={ref}
      >
        {(Object.entries(options) as KVPair<T>[]).map(([key, value]) => {
          const asButton = isButtonOption(key as keyof T);
          return (
            <button
              key={`${String(key)}-${value}`}
              onClick={() => {
                onChange([key, value]);
                setIsOpen(false);
              }}
              className={cn(
                "px-3 pr-3 py-2 text-left",
                asButton
                  ? "text-green bg-zinc-50 hover:bg-zinc-100 font-medium"
                  : "hover:bg-zinc-50",
                sizeClass,
              )}
              style={{
                fontWeight: asButton ? 500 : 450,
              }}
            >
              <div className="flex flex-row justify-between items-center">
                <div className="flex flex-row gap-x-2 items-center">
                  {keyIcons?.[key as keyof T] && (
                    <div className="flex items-center justify-center w-4 h-4">
                      {keyIcons[key as keyof T]}
                    </div>
                  )}
                  <span>{value}</span>
                </div>
                {secondaryLabel?.([key, value]) && (
                  <span className="text-zinc-500 !font-mono">
                    {secondaryLabel([key, value])}
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default DropdownSelect;
