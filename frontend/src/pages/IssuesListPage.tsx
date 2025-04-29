import React from "react";
import Navbar, { NavbarPage } from "../components/Navbar";
import ProblemAreaCard, {
  ProblemAreaCardProps,
} from "../components/ProblemAreaCard";
import { useAuth } from "../context/AuthContext";
import LandingNavbar from "../components/LandingNavbar";

const IssuesListPage: React.FC = () => {
  // Sample todo items data
  const issues: ProblemAreaCardProps[] = [
    {
      name: "Environment",
      href: "environment",
      description:
        "Unrestrained technological development, in particular the development of artificial intelligence, degrades the world’s information ecosystems, displaces human interaction, and threatens global catastrophe. It is amenable to awareness campaigns, protests, and boycotts.",
    },
    {
      name: "Poverty",
      href: "environment",
      description:
        "Environmental damage compounds every day in the vectors of climate change and land development, causing disasters and depriving future generations of a diverse and healthy planet. It is amenable to land conservation, investment in renewables, boycotts, and other direct interventions. Experts believe global biodiversity loss can be substantially curtailed with less than a fifth of America’s yearly tax collections. Solar geoengineering offers a potentially cost-effective route to reduce global warming and could become a project of international importance as a result of widespread democratic deliberation.",
    },
    {
      name: "Emerging Technologies",
      href: "poverty",
      description:
        "Extreme poverty prevents billions of humans from engaging with the rest of civilization and every day causes suffering and death. It is amenable to cash and technology transfers; the elimination of extreme poverty can be achieved with less than one percent of global annual income each year.",
    },
    {
      name: "Global Governance",
      href: "emerging-technologies",
      description:
        "The world’s information ecosystems are under threat from a variety of sources, including disinformation, censorship, and the rise of authoritarian regimes. It is amenable to awareness campaigns, protests, and boycotts.",
    },
  ];

  const { isAuthenticated } = useAuth();

  return (
    <>
      {isAuthenticated && (
        <Navbar currentPage={NavbarPage.Dashboard} format="horizontal" />
      )}
      {!isAuthenticated && <LandingNavbar />}
      <div className="flex flex-row min-h-screen">
        <div className="w-[80%] mx-auto items-center justify-center p-10 flex flex-col flex-nowrap">
          <h1 className="text-[#111] font-font text-5xl font-extrabold mb-8 text-center">
            Alliance Priorities
          </h1>
          <div className="grid grid-cols-2 gap-x-6 w-full flex-1">
            {issues.map((issue) => (
              <ProblemAreaCard
                name={issue.name}
                description={issue.description}
                href={`/issues/${issue.href}`}
                key={issue.name}
              />
            ))}
          </div>
        </div>
      </div>
    </>
  );
};

export default IssuesListPage;
