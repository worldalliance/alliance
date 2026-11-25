import { LaunchSection } from "../../../components/suite-launch/launchBlockers";
import { CheckboxField } from "../../../ui/templates/Form";
import { Banner, BannerTone } from "../../../ui/templates/Banner";

/**
 * The member contract's breaches, first on the page. Accepting holds only for
 * these violations: the page asks again once they change.
 */
export function ContractCheck({
  violations,
  accepted,
  onAcceptedChange,
}: {
  violations: string[];
  accepted: boolean;
  onAcceptedChange: (accepted: boolean) => void;
}) {
  return (
    <div id={LaunchSection.Contract} className="scroll-mt-6">
      <Banner inline tone={BannerTone.Danger}>
        <div className="flex flex-col gap-3">
          <h2 className="text-heading font-semibold text-danger">
            This launch breaks the member contract
          </h2>
          <ul className="list-disc pl-5 font-medium">
            {violations.map((violation) => (
              <li key={violation}>{violation}</li>
            ))}
          </ul>
          <CheckboxField
            label="Launch anyway, breaking the contract"
            checked={accepted}
            onChange={(event) => onAcceptedChange(event.target.checked)}
          />
        </div>
      </Banner>
    </div>
  );
}
