export interface ExampleActionCategoryCardProps {
  title: string;
  description: string;
  example: string;
}

const ExampleActionCategoryCard: React.FC<ExampleActionCategoryCardProps> = ({
  title,
  description,
  example,
}: ExampleActionCategoryCardProps) => {
  return (
    <div className="flex flex-col p-4 bg-white border-r border-b border-zinc-200 [&:nth-child(2n)]:border-r-0 [&:nth-last-child(-n+2)]:border-b-0">
      <p className="text-base text-green font-semibold">{title}</p>
      <p className="text-base text-zinc-900">{description}</p>

      <p className="text-base text-zinc-500 mt-4">{example}</p>
    </div>
  );
};

export default ExampleActionCategoryCard;
