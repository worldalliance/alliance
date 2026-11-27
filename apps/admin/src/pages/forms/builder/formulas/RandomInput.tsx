import type { InputModeHelp } from "./VariableHelpModal";

export const RANDOM_INPUT_HELP: InputModeHelp = {
  notes:
    "A whole number from 0 up. Each member gets their own, the same on every visit and device, and each random input picks separately. Take it modulo a list's length to pick one entry.",
  example: (input) => `["A", "B", "C"][${input} % 3]`,
};
