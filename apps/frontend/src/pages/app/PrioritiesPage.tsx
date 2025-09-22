import React from "react";
import { useWhiteBackground } from "../../components/HtmlBackgroundManager";

const PrioritiesPage: React.FC = () => {
  useWhiteBackground();

  return (
    <div className="flex flex-col max-w-3xl mx-auto p-3 pt-6 md:pt-16 md:pt-20">
      <div className="gap-y-2 flex flex-col text-base md:text-lg">
        <p className="font-serif text-3xl md:text-4xl font-semibold">
          Our current priorities
        </p>
        <p className="text-zinc-500 mb-4 md:mb-8">
          Last updated August 27, 2025
        </p>

        <p>At this early stage, we are planning collective actions that:</p>
        <ul className="ml-4 list-decimal list-inside flex flex-col gap-y-2">
          <li>
            <span className="font-medium">
              Help us improve the organization
            </span>
            , e.g. by building community, or asking members for feedback on our
            communications.
          </li>
          <li>
            <span className="font-medium">
              Help us test small-scale versions of actions
            </span>{" "}
            we may eventually take at larger scales to address global crises.
          </li>
        </ul>
        <p>
          Per our{" "}
          <a href="/guide" target="_blank" className="text-link underline">
            process
          </a>{" "}
          for determining priorities, we are currently focused on the following
          global crises:
        </p>

        <ol className="ml-4 list-decimal list-inside flex flex-col gap-y-1">
          <li>Extreme poverty</li>
          <li>Environmental destruction</li>
          <li>Breakdown of democratic institutions</li>
          <li>Unsafe technological development</li>
        </ol>

        <p>Check back here for updates and progress on our priorities.</p>
      </div>
    </div>
  );
};

export default PrioritiesPage;
