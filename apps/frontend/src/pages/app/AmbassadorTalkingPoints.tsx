import React from "react";
import { Link } from "react-router";
import {
  headingClassName,
  listClassName,
  subheadingClassName,
} from "./ambassadorsPageStyles";

const AmbassadorTalkingPoints: React.FC = () => (
  <>
    <h2 id="talking-points" className={headingClassName}>
      Talking points
    </h2>
    <h3 className={subheadingClassName}>Actions</h3>
    <p>
      It can be helpful to give some examples of actions. In the past, we have:
    </p>
    <ul className={listClassName}>
      <li>
        Run the first ever large-scale behavioral study on eating less animal
        products, alongside Stanford researcher Seth Ariel Green:{" "}
        <a href="https://plantbasedstudy.org/" className="text-link">
          https://plantbasedstudy.org/
        </a>
      </li>
      <li>
        Created a comprehensive public map on police surveillance spending in
        California, the first of its kind:{" "}
        <a href="https://ca-police-ai.netlify.app/" className="text-link">
          https://ca-police-ai.netlify.app/
        </a>
      </li>
      <li>
        Temporarily avoided unnecessary purchases in order to donate more than
        $2,500 collectively to Helen Keller International.
      </li>
      <li>
        Posted 3 expert- and member-informed comments on US federal dockets
        about AI policy.
      </li>
      <li>
        Held a discussion with current and former EPA employees about the repeal
        of the Endangerment Finding.
      </li>
    </ul>

    <h3 className={subheadingClassName}>Reliability and contract</h3>
    <p>
      People may ask why there is a consistent commitment and why there is a
      contract. Some points to emphasize include:
    </p>
    <ul className={listClassName}>
      <li>Reliability is what lets the Alliance plan actions precisely.</li>
      <li>It also lets members know they can count on each other.</li>
      <li>The commitment is capped at 15 minutes per week.</li>
      <li>Members can suspend their contract at any time.</li>
      <li>
        Members can mark themselves away for emergencies, travel, vacation, or
        other conflicts.
      </li>
      <li>
        Members can opt out of actions they believe are immoral or that take
        longer than 15 minutes.
      </li>
    </ul>

    <h3 className={subheadingClassName}>Experts</h3>
    <p>
      Some people find it helpful to hear that the Alliance is supported by
      experts who provide general guidance as well as help us design specific
      actions.
    </p>
    <p>
      Here is our list of experts who have chosen to make their information
      public:{" "}
      <Link to="/people#expert-group" className="text-link">
        worldalliance.org/people#expert-group
      </Link>
      .
    </p>
    <p>
      In general, it can be helpful to emphasize that the Alliance takes rigor
      and effectiveness seriously. Experts are part of how we do this.
    </p>

    <h3 className={subheadingClassName}>Roadmap</h3>
    <p>
      The Alliance is currently focused on learning from early actions. The goal
      is to understand how to grow and sustain the platform, which types of
      actions work, how members respond, and what systems need to improve before
      scaling.
    </p>
    <p>
      This learning phase is meant to build toward an eventual public launch,
      which we currently expect in around a year, with around 10,000 members.
    </p>
    <p>
      After public launch, the priority will shift from learning toward direct
      impact. At that scale, the Alliance could attempt much more ambitious
      actions: coordinated consumer shifts, pooled funding for large projects,
      mass public comments, pressure campaigns, citizen science projects,
      ecosystem restoration, or synchronized changes in how members spend money
      and time.
    </p>
  </>
);

export default AmbassadorTalkingPoints;
