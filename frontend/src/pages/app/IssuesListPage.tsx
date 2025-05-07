import React from "react";
import IssueCard, { IssueCardProps } from "../../components/IssueCard";
import { useAuth } from "../../context/AuthContext";
import NewNavbar from "../../components/NewNavbar";

const IssuesListPage: React.FC = () => {
  // Sample todo items data
  const issues: IssueCardProps[] = [
    {
      name: "Environment",
      href: "environment",
      description:
        "Environmental damage compounds every day in the vectors of climate change and land development, causing disasters and depriving future generations of a diverse and healthy planet. ",
    },
    {
      name: "Poverty",
      href: "poverty",
      description:
        "Extreme poverty prevents billions of humans from engaging with the rest of civilization and every day causes suffering and death. It is amenable to cash and technology transfers; the elimination of extreme poverty can be achieved with less than one percent of global annual income each year.",
    },
    {
      name: "Technological Risk",
      href: "technology",
      description:
        "Unrestrained technological development, in particular the development of artificial intelligence, degrades the world’s information ecosystems, displaces human interaction, and threatens global catastrophe. It is amenable to awareness campaigns, protests, and boycotts.",
    },
    {
      name: "Global Governance",
      href: "governance",
      description:
        "The world’s information ecosystems are under threat from a variety of sources, including disinformation, censorship, and the rise of authoritarian regimes. ",
    },
  ];

  return (
    <>
      <NewNavbar />
      <div className="flex flex-col items-center">
        <div className="container mx-auto items-center justify-center p-10 flex flex-col flex-nowrap">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full flex-1">
            {issues.map((issue) => (
              <IssueCard
                name={issue.name}
                description={issue.description}
                href={`/issues/${issue.href}`}
                key={issue.name}
              />
            ))}
          </div>
        </div>
        <p>
          Read about our priorities and methodology on the{" "}
          <a href="/platform/resources" className="text-blue-500">
            resources
          </a>{" "}
          page
        </p>
      </div>
    </>
  );
};

export default IssuesListPage;
