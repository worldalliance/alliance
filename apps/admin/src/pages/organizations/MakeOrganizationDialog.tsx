import type { CampaignDto } from "@alliance/shared/client/types.gen";
import { useRef, useState } from "react";
import { adminRefusalMessage } from "../../lib/adminRefusal";
import { useUpdateCampaignAdmin } from "../../lib/useCampaignsAdmin";
import Button, { ButtonVariant } from "../../ui/Button";
import Modal, {
  ModalActions,
  ModalBody,
  ModalFooter,
  ModalHeader,
  ModalTitle,
} from "../../ui/Modal";
import { Select } from "../../ui/Select";
import { Field } from "../../ui/templates/Form";
import { useToast } from "../../ui/ToastProvider";

export function MakeOrganizationDialog({
  campaigns,
  onClose,
}: {
  /** The campaigns that aren't organizations yet. */
  campaigns: readonly CampaignDto[];
  onClose: () => void;
}) {
  const { success } = useToast();
  const [campaignId, setCampaignId] = useState("");
  const [pickError, setPickError] = useState<string | null>(null);
  const [refusal, setRefusal] = useState<string | null>(null);
  const campaignRef = useRef<HTMLSelectElement>(null);
  const designate = useUpdateCampaignAdmin({
    onError: (error) =>
      setRefusal(
        adminRefusalMessage(
          error,
          "Couldn't make the campaign an organization.",
        ),
      ),
  });

  return (
    <Modal
      onClose={onClose}
      dismissDisabled={designate.isPending}
      initialFocus={campaignRef}
    >
      <form
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          const campaign = campaigns.find(
            (candidate) => String(candidate.id) === campaignId,
          );
          if (!campaign) {
            setPickError("Choose a campaign");
            return;
          }
          setRefusal(null);
          designate.mutate(
            { id: campaign.id, body: { kind: "organization" } },
            {
              onSuccess: () => {
                success("Campaign made an organization", campaign.name);
                onClose();
              },
            },
          );
        }}
      >
        <ModalHeader>
          <ModalTitle>Make a campaign an organization</ModalTitle>
        </ModalHeader>
        <ModalBody>
          <Field
            label="Existing campaign"
            // From the server's campaign update, which refuses the way back
            // once waitlist links or entries exist.
            help="As an organization it can own a group and waitlist links. Once it has links or entries, it stays an organization."
            error={pickError}
          >
            {(control) => (
              <Select
                {...control}
                ref={campaignRef}
                value={campaignId}
                disabled={designate.isPending}
                onChange={(event) => {
                  setCampaignId(event.target.value);
                  setPickError(null);
                }}
              >
                <option value="">Choose a campaign</option>
                {campaigns.map((campaign) => (
                  <option key={campaign.id} value={campaign.id}>
                    {campaign.name}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        </ModalBody>
        <ModalFooter error={refusal}>
          <ModalActions>
            <Button
              variant={ButtonVariant.Default}
              onClick={onClose}
              disabled={designate.isPending}
            >
              Cancel
            </Button>
            <Button
              variant={ButtonVariant.Primary}
              type="submit"
              busy={designate.isPending}
            >
              Make organization
            </Button>
          </ModalActions>
        </ModalFooter>
      </form>
    </Modal>
  );
}
