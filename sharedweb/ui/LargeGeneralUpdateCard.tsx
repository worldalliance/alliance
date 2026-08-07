import type { DisplayOnlySchema } from "@alliance/common/forms/display-only-schema";
import DisplayOnlyRenderer from "@alliance/sharedweb/forms/DisplayOnlyRenderer";
import BaseButton, {
  BaseButtonVariant,
} from "@alliance/sharedweb/ui/BaseButton";
import Card from "@alliance/sharedweb/ui/Card";

export interface LargeGeneralUpdateCardProps {
  title: string;
  schema: DisplayOnlySchema | null;
  onDismiss?: () => void;
}

const LargeGeneralUpdateCard: React.FC<LargeGeneralUpdateCardProps> = ({
  title,
  schema,
  onDismiss,
}) => {
  return (
    <Card className="p-6 sm:p-8 w-full relative border-[1.5px] rounded">
      <div className="gap-y-4 flex flex-col">
        <div className="flex flex-col">
          {onDismiss && <p>General update</p>}
          <p className="text-title-small">{title}</p>
        </div>
        <div className="space-y-4">
          <DisplayOnlyRenderer schema={schema} />
          {onDismiss && (
            <BaseButton
              variant={BaseButtonVariant.LightHover}
              onClick={onDismiss}
              className="w-full"
            >
              Dismiss
            </BaseButton>
          )}
        </div>
      </div>
    </Card>
  );
};

export default LargeGeneralUpdateCard;
