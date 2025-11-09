import React from "react";
import { useWhiteBackground } from "../../components/HtmlBackgroundManager";
import { Link } from "react-router";
import CenterLayout from "@alliance/shared/ui/CenterLayout";

const PrioritiesPage: React.FC = () => {
  useWhiteBackground();

  return (
    <CenterLayout>
      <div className="md:mt-8 gap-y-4 flex flex-col text-base md:text-lg">
        <p className="font-serif text-3xl md:text-4xl font-medium">
          Our priorities
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
            we may eventually take at large scales to address global crises.
          </li>
        </ul>
        <p>
          Per our{" "}
          <a href="/guide" target="_blank" className="text-link underline">
            process
          </a>{" "}
          for determining priorities, we are currently focused on the following
          crises:
        </p>

        <ol className="ml-4 list-decimal list-inside flex flex-col gap-y-1">
          <li>Extreme poverty</li>
          <li>Environmental destruction</li>
          <li>Breakdown of democratic institutions</li>
          <li>Unsafe technological development</li>
        </ol>

        <p>
          Check back here for updates, progress, and general information about
          the state of the organization.
        </p>

        <p>
          If you have questions or feedback, you can schedule a call with a{" "}
          <Link
            to="https://calendly.com/d/ctcw-j4f-bp3/talk-to-a-staff-member"
            className="text-link"
          >
            staff member
          </Link>
          .
        </p>
      </div>
    </CenterLayout>
  );
};

export default PrioritiesPage;
