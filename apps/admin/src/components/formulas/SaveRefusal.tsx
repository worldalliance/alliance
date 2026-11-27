import React from "react";
import Button, { ButtonVariant } from "../../ui/Button";
import { Banner, BannerTone } from "../../ui/templates/Banner";

export type Refusal = { message: string; outdated: boolean };

/** Why a save failed, with Reload when what the admin edited changed meanwhile. */
const SaveRefusal: React.FC<{
  refusal: Refusal | null;
  onReload: () => void;
}> = ({ refusal, onReload }) =>
  refusal === null ? null : (
    <Banner
      inline
      tone={BannerTone.Danger}
      action={
        refusal.outdated && (
          <Button
            size="small"
            variant={ButtonVariant.Default}
            onClick={onReload}
          >
            Reload
          </Button>
        )
      }
    >
      {refusal.message}
    </Banner>
  );

export default SaveRefusal;
