export interface ExampleActionCategoryCardProps {
  title: string;
  description: string;
}

const ExampleActionCategoryCard: React.FC<ExampleActionCategoryCardProps> = ({
  title,
  description,
}: ExampleActionCategoryCardProps) => {
  return (
    <div className="flex flex-col border border-zinc-200 rounded p-6 bg-white">
      <p className="text-xl font-ibm font-medium">{title}</p>
      <p className="text-lg font-ibm">{description}</p>
    </div>
  );
};

export default ExampleActionCategoryCard;
