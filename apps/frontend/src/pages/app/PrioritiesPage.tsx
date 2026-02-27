import React from "react";
import { useWhiteBackground } from "../../components/HtmlBackgroundManager";
import { Link } from "react-router";
import InfoSubpage from "../../components/InfoSubpage";

const PrioritiesPage: React.FC = () => {
  useWhiteBackground();

  const tocSections = [
    { id: "extreme-poverty", label: "Extreme poverty", level: 2 },
    {
      id: "environmental-destruction",
      label: "Environmental destruction",
      level: 2,
    },
    {
      id: "decline-of-democratic-institutions",
      label: "The decline of democratic institutions",
      level: 2,
    },
    {
      id: "dangerous-technological-development",
      label: "Dangerous technological development",
      level: 2,
    },
  ];

  return (
    <InfoSubpage tocSections={tocSections}>
      <section className="gap-y-4 flex flex-col">
        <h1
          id="priorities"
          className="font-serif text-3xl md:text-4xl font-semibold mb-4 text-black"
        >
          Priorities
        </h1>
        <p>
          The Alliance is founded on a moral principle shared by nearly all
          cultures: one should not treat others in ways that one does not want
          to be treated.
        </p>

        <p>
          Our modern, interconnected world is shaped by decisions made by
          billions of people. If we do not want others to disregard how their
          decisions impact us, we cannot disregard how our decisions impact
          them.
        </p>

        <p>
          We decided, with twenty-five founding members, to focus the Alliance’s
          efforts on four global crises:
        </p>

        <ul className="list-disc list-inside space-y-2 pl-4">
          <li>Extreme poverty</li>
          <li>Environmental destruction</li>
          <li>The decline of democratic institutions</li>
          <li>Dangerous technological development</li>
        </ul>

        <p>
          To us, these crises represent the most egregious violations of our
          foundational moral principle. They cause, or have the potential to
          cause, enormous harm to billions of people. We believe that these
          crises persist because most people disregard how their decisions
          contribute to them, and some people sustain them intentionally.
        </p>

        <h2
          id="extreme-poverty"
          className="mt-2 text-2xl font-semibold text-black"
        >
          Extreme poverty
        </h2>

        <p>
          More than{" "}
          <Link
            to="https://blogs.worldbank.org/en/opendata/behind-the-numbers--how-we-measure-global-poverty"
            className="text-link"
          >
            800 million people
          </Link>{" "}
          live in extreme poverty, defined by the World Bank as living on less
          than $3 a day. At these income levels,{" "}
          <Link
            to="https://www.nature.com/articles/s41598-024-53280-0"
            className="text-link"
          >
            malnutrition
          </Link>
          ,{" "}
          <Link
            to="https://pmc.ncbi.nlm.nih.gov/articles/PMC8366975/"
            className="text-link"
          >
            preventable diseases
          </Link>
          , and{" "}
          <Link
            to="https://www.thelancet.com/journals/langlo/article/PIIS2214-109X(18)30059-7/fulltext"
            className="text-link"
          >
            child mortality
          </Link>{" "}
          are widespread. Progress on extreme poverty has{" "}
          <Link to="https://www.worldbank.org/en/publication/poverty-prosperity-and-planet" className="text-link">
            slowed
          </Link>{" "}
          for the first time since the 1990s because of the COVID-19 pandemic,
          increased conflict, and other factors.
        </p>

        <h2
          id="environmental-destruction"
          className="mt-2 text-2xl font-semibold text-black"
        >
          Environmental destruction
        </h2>

        <p>
          The{" "}
          <Link to="https://zenodo.org/records/3553579" className="text-link">
            primary drivers of environmental destruction
          </Link>{" "}
          are: the clearing and degradation of forests, wetlands, grasslands,
          coastal ecosystems, and other land for development and agriculture;
          overexploitation of wild plants and animals from legal and illegal
          harvesting; ecosystem disruptions from rising temperatures and
          changing weather patterns; pollution from agricultural, commercial,
          and industrial waste; and the introduction and spread of invasive
          species. The global rate of species extinction is at least{" "}
          <Link to="https://zenodo.org/records/5517457" className="text-link">
            tens to hundreds of times higher
          </Link>{" "}
          than the average rate over the past 10 million years.
        </p>

        <h2
          id="decline-of-democratic-institutions"
          className="mt-2 text-2xl font-semibold text-black"
        >
          The decline of democratic institutions
        </h2>

        <p>
          The number of countries{" "}
          <Link
            to="https://www.tandfonline.com/doi/full/10.1080/13510347.2019.1582029#d1e407"
            className="text-link"
          >
            losing democratic qualities
          </Link>{" "}
          is higher than any period since the early 1940s. Measures of global
          freedom have declined for{" "}
          <Link
            to="https://freedomhouse.org/report/freedom-world/2025/uphill-battle-to-safeguard-rights"
            className="text-link"
          >
            19 consecutive years
          </Link>
          , with political rights assessed as decreasing for over 3 billion
          people in 2024. These declines typically involve the erosion of
          judicial independence, freedom of the press, and civil liberties,
          including{" "}
          <Link
            to="https://www.tandfonline.com/doi/full/10.1080/14754835.2023.2295878"
            className="text-link"
          >
            measurable increases
          </Link>{" "}
          in human rights violations.
        </p>

        <h2
          id="dangerous-technological-development"
          className="mt-2 text-2xl font-semibold text-black"
        >
          Dangerous technological development
        </h2>

        <p>
          Several emerging technologies pose potentially catastrophic risks.
          Advances in biotechnology are{" "}
          <Link
            to="https://www.armscontrol.org/blog/2025-11-24/regulatory-gaps-benchtop-nucleic-acid-synthesis-create-biosecurity-vulnerabilities"
            className="text-link"
          >
            lowering the barriers
          </Link>{" "}
          to engineering deadly pathogens. Artificial intelligence systems{" "}
          <Link
            to="https://www.weforum.org/publications/global-risks-report-2026/in-full/global-risks-report-2026-chapter-2/#2-7-ai-at-large"
            className="text-link"
          >
            undermine
          </Link>{" "}
          trusted information and could{" "}
          <Link
            to="https://internationalaisafetyreport.org/publication/international-ai-safety-report-2025"
            className="text-link"
          >
            accelerate biological and cyber threats
          </Link>
          . A{" "}
          <Link to="https://aistatement.com/" className="text-link">
            statement
          </Link>{" "}
          signed by leading AI researchers states: “[m]itigating the risk of
          extinction from AI should be a global priority alongside other
          societal-scale risks such as pandemics and nuclear war.”
        </p>
      </section>
    </InfoSubpage>
  );
};

export default PrioritiesPage;
