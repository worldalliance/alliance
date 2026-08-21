import { PLACEHOLDER_CONTRACT_MARKDOWN } from "@alliance/shared/lib/contract";
import { CardStyle } from "@alliance/shared/styles/card";
import AppMarkdownWrapper from "@alliance/sharedweb/ui/AppMarkdownWrapper";
import Card from "@alliance/sharedweb/ui/Card";
import { useContract } from "../lib/useContract";

interface MemberContractProps {
  id?: string;
  className?: string;
  markdownOverride?: string;
}

const MemberContract = ({
  id,
  className,
  markdownOverride,
}: MemberContractProps) => {
  const { latestContract } = useContract();
  const content =
    markdownOverride ??
    latestContract?.markdown ??
    PLACEHOLDER_CONTRACT_MARKDOWN;

  return (
    <Card className={className} style={CardStyle.WhiteBorder} id={id}>
      <AppMarkdownWrapper markdownContent={content} />
    </Card>
  );
};

export default MemberContract;
