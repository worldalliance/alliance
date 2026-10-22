import type { CustomComponentProps } from "@alliance/shared/forms/customComponents";
import { useShareInfoPubliclyToggle } from "@alliance/shared/forms/useShareInfoPubliclyToggle";
import { CardStyle } from "@alliance/shared/styles/card";
import Card from "../../ui/Card";
import YesNoToggle from "../../ui/YesNoToggle";
import { OptionalLabelPrefix } from "../OptionalLabelPrefix";

const ShareInfoPubliclyToggleComponent = (props: CustomComponentProps) => {
  const { field, isOutputView, required } = props;
  const toggle = useShareInfoPubliclyToggle(props);

  return (
    <Card
      style={CardStyle.White}
      className="flex flex-row gap-x-4 items-center justify-between"
    >
      <div>
        {!(required ?? field.required) && !isOutputView && (
          <OptionalLabelPrefix />
        )}
        <label className="block font-medium mb-1">{toggle.label}</label>
        <p className="text-zinc-500">{toggle.description}</p>
      </div>
      <YesNoToggle
        value={toggle.value}
        onChange={toggle.toggle}
        disabled={toggle.disabled}
        ariaLabel={toggle.label}
      />
    </Card>
  );
};

export default ShareInfoPubliclyToggleComponent;
