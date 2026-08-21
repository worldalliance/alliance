import { CardStyle } from "@alliance/shared/styles/card";
import Card from "@alliance/sharedweb/ui/Card";

interface MemberQuoteCardProps {
  quote: string;
  author: string;
  showAuthor?: boolean;
}

const MemberQuoteCard = ({
  quote,
  author,
  showAuthor,
}: MemberQuoteCardProps) => {
  return (
    <Card className="p-4 md:p-8 flex flex-col gap-y-3" style={CardStyle.White}>
      <p>{quote}</p>
      {showAuthor && <p className="text-zinc-500">{author}</p>}
    </Card>
  );
};

export default MemberQuoteCard;
