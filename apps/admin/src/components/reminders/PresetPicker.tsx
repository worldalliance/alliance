import Button, { ButtonColor } from "@alliance/sharedweb/ui/Button";
import React, { useState } from "react";
import { presetNames, ReminderPresetName, reminderPresets } from "./presets";

interface PresetPickerProps {
  dependencyDeadlineAvailable: boolean;
  onSelect: (preset: ReminderPresetName) => void;
}

const PresetPicker: React.FC<PresetPickerProps> = ({
  dependencyDeadlineAvailable,
  onSelect,
}) => {
  const [open, setOpen] = useState<boolean>(false);

  return (
    <div className="relative">
      <Button
        type="button"
        color={ButtonColor.Light}
        className="px-3 py-1 text-sm"
        onClick={() => setOpen((prev) => !prev)}
      >
        Load preset...
      </Button>
      {open && (
        <div className="absolute top-full right-0 p-2 bg-white shadow-md rounded-md">
          {presetNames.map((preset) => {
            const anchorUnavailable =
              !!reminderPresets[preset].anchorToDependencyDeadline &&
              !dependencyDeadlineAvailable;
            return (
              <Button
                key={preset}
                type="button"
                color={ButtonColor.Light}
                disabled={anchorUnavailable}
                title={
                  anchorUnavailable
                    ? "Needs an upcoming dependency deadline to anchor to; this action's cohort has none"
                    : undefined
                }
                onClick={() => {
                  onSelect(preset);
                  setOpen(false);
                }}
                className="w-full rounded-none bg-transparent! hover:bg-zinc-200/60! text-nowrap justify-start"
              >
                {preset}
              </Button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default PresetPicker;
