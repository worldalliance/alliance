interface ExampleActionCategoryListProps {
  textSize?: "base" | "lg";
}

const ExampleActionCategoryList: React.FC<ExampleActionCategoryListProps> = ({
  textSize = "base",
}: ExampleActionCategoryListProps) => {
  const textSizeClasses = {
    base: "text-base",
    lg: "text-lg",
  };

  return (
    <table
      className={`w-full ${textSizeClasses[textSize]} border-collapse`}
    >
      <thead>
        <tr className="text-left text-zinc-900 border border-zinc-200">
          <th className="font-semibold p-4 border border-zinc-200 text-green">
            Category
          </th>
          <th className="font-semibold p-4 text-green">Examples</th>
        </tr>
      </thead>
      <tbody>
        <tr className="border border-zinc-200">
          <td className="align-top p-4 border border-zinc-200 md:whitespace-nowrap text-zinc-900 font-semibold">
            Economic shifts
          </td>
          <td className="p-4 border border-zinc-200 text-zinc-900">
            <ul className="list-disc list-inside space-y-1">
              <li>
                We could enforce an ethical standard on an industry by asking
                members to only purchase from companies that meet it.
              </li>
              <li>
                We could coordinate individual waste reductions to meet global
                waste reduction targets.
              </li>
              <li>
                We could create healthier social media apps and all switch to
                them at once.
              </li>
            </ul>
          </td>
        </tr>
        <tr className="border border-zinc-200">
          <td className="align-top p-4 border border-zinc-200 md:whitespace-nowrap text-zinc-900 font-semibold">
            Pooled funding
          </td>
          <td className="p-4 border border-zinc-200 text-zinc-900">
            <ul className="list-disc list-inside space-y-1">
              <li>
                We could pay large teams to undertake impactful work that could
                otherwise only be conducted by volunteers.
              </li>
              <li>
                We could fund entrepreneurial and educational programs in
                low-income countries to help build sustainable economies.
              </li>
              <li>We could incubate non-profit, democratic media companies.</li>
            </ul>
          </td>
        </tr>
        <tr className="border border-zinc-200">
          <td className="align-top p-4 border border-zinc-200 md:whitespace-nowrap text-zinc-900 font-semibold">
            Social pressure
          </td>
          <td className="p-4 border border-zinc-200 text-zinc-900">
            <ul className="list-disc list-inside space-y-1">
              <li>
                We could direct public attention to an AI company and demand a
                specific safety policy.
              </li>
              <li>
                We could run a membership-wide education campaign to create
                global support for an enforceable biodiversity treaty.
              </li>
            </ul>
          </td>
        </tr>
        <tr className="border border-zinc-200">
          <td className="align-top p-4 border border-zinc-200 md:whitespace-nowrap text-zinc-900 font-semibold">
            Direct action
          </td>
          <td className="p-4 text-zinc-900">
            <ul className="list-disc list-inside space-y-1">
              <li>
                We could design and participate in the world’s largest citizen
                science projects.
              </li>
              <li>
                We could create and participate in massive ecosystem restoration
                programs.
              </li>
            </ul>
          </td>
        </tr>
      </tbody>
    </table>
  );
};

export default ExampleActionCategoryList;
