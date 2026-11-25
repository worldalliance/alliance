import React from "react";
import Button, { ButtonColor } from "../../ui/Button";

export type Refusal = { message: string; outdated: boolean };

/** Why a save failed, with Reload when what the admin edited changed meanwhile. */
const SaveRefusal: React.FC<{
  refusal: Refusal | null;
  onReload: () => void;
}> = ({ refusal, onReload }) =>
  refusal === null ? null : (
    <div
      role="alert"
      className="border border-red-300 bg-red-50 rounded p-3 text-sm text-red-800 max-w-3xl space-y-2"
    >
      <p>{refusal.message}</p>
      {refusal.outdated && (
        <Button size="small" color={ButtonColor.White} onClick={onReload}>
          Reload
        </Button>
      )}
    </div>
  );

export default SaveRefusal;
