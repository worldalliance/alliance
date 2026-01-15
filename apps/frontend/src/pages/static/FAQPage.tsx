import React from "react";
import Footer from "../../components/Footer";
import { Link, useSearchParams } from "react-router";

import PrelaunchNavbar from "../../components/PrelaunchNavbar";
import FAQExpandable from "../../components/FAQExpandable";
import MemberContract from "../../components/MemberContract";
import ExampleActionCardList from "../../components/ExampleActionCardList";

const FAQPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const question = searchParams.get("question");

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <PrelaunchNavbar transparent={false} absolute={false} />
      <div className="flex flex-col md:flex-row mx-2 sm:mx-4 md:mx-12 pt-8 md:pt-32 pb-56 justify-center">
        <div className="flex flex-col w-full md:w-3xl">
          <div className="mx-auto w-full mb-8">
            <h2 className="font-serif !font-semibold !text-4xl text-black">
              Frequently asked questions
            </h2>
          </div>

          <div className="flex flex-col gap-y-6 text-lg">
            <FAQExpandable
              title="What is the Alliance?"
              expanded={question === "what-is-the-alliance"}
            >
              <p>
                The Alliance is a group of people working together to improve
                the world. Members spend a fraction of their time – currently 15
                minutes a week – completing tasks on our online platform. These
                tasks are designed by a full-time strategic office to advance
                our priorities.
              </p>
              <p>
                Our long-term goal is to unite humanity behind a democratic,
                expert-developed plan to end global crises. Right now, we are
                running experiments to test our organizational structures and
                processes.
              </p>
              <p>
                We define &quot;the Alliance&quot; as the body of our members,
                not as any legal entity.
              </p>
            </FAQExpandable>
            <FAQExpandable
              title="How do I join the Alliance?"
              expanded={question === "how-do-i-join"}
            >
              <p>
                Membership is currently by invitation only. To request a signup
                link, please email{" "}
                <a
                  href="mailto:contact@worldalliance.org"
                  className="text-link"
                >
                  contact@worldalliance.org
                </a>
                .
              </p>
            </FAQExpandable>
            <FAQExpandable
              title="How is the Alliance structured?"
              expanded={question === "how-is-the-alliance-structured"}
            >
              <p>
                The Alliance is composed of a body of members and a full-time
                strategic office.
              </p>
              <ol className="list-decimal list-inside space-y-2 pl-4">
                <li>
                  The office is responsible for developing plans, and
                  corresponding tasks, that effectively advance Alliance
                  priorities.
                </li>
                <li>
                  Members are responsible for reliably completing tasks they are
                  assigned on our online platform.
                </li>
              </ol>
            </FAQExpandable>
            <FAQExpandable
              title="What are the priorities of the Alliance?"
              expanded={question === "what-are-the-priorities"}
            >
              <p>In no particular order, we are focused on:</p>
              <ol className="list-decimal list-inside space-y-2 pl-4">
                <li>Extreme poverty</li>
                <li>Environmental destruction</li>
                <li>The decline of democratic institutions</li>
                <li>Dangerous technological development</li>
              </ol>
              <p>
                Learn more about our priorities{" "}
                <Link to={"/foundation"} className="text-link">
                  here.
                </Link>
              </p>
            </FAQExpandable>
            <FAQExpandable
              title="How is the Alliance governed?"
              expanded={question === "how-is-the-alliance-governed"}
            >
              <p>
                We conduct a membership-wide oversight process that occurs on a
                regular basis. In the process, the Alliance office asks members
                what they think about the direction of the Alliance and whether
                or not they have any major concerns. The office collects and
                responds to feedback until we reach an approval threshold of
                75%.
              </p>
              <p>This procedure achieves two goals:</p>
              <ol className="list-decimal list-inside space-y-2 pl-4">
                <li>
                  Members determine the high-level goals and methods of the
                  Alliance.
                </li>
                <li>
                  The office retains the freedom to plan any action that
                  advances approved goals with approved methods. It is not
                  required to do what is most popular, nor do actions need
                  unanimous support, so it can operate efficiently and
                  effectively.
                </li>
              </ol>
              <p>
                In addition to formal governance, the office incorporates member
                input by other means. For instance, the office hosts
                discussions, asks members for action proposals, solicits
                open-ended feedback, and so on.
              </p>
              <p>
                Learn more about our governance{" "}
                <Link to={"/governance"} className="text-link">
                  here.
                </Link>
              </p>
            </FAQExpandable>
            <FAQExpandable
              title="What is expected of members?"
              expanded={question === "what-is-expected-of-members"}
            >
              <p>
                Members are expected to complete all tasks they are assigned on
                time. Members are not required to contribute to the Alliance
                financially.
              </p>

              <p>
                We define members of the Alliance as individuals that have
                signed and abide by the following membership contract.
              </p>

              <MemberContract id="contract" />
            </FAQExpandable>
            <FAQExpandable
              title="How are actions designed and selected?"
              expanded={question === "how-are-actions-designed-and-selected"}
            >
              <p>
                Action design is a creative, open-ended process that searches
                for levers of change that members can pull. The office draws
                inspiration from many places, including life experiences,
                subject matter experts, and member suggestions.
              </p>

              <p>
                The office selects actions according to several criteria,
                including the quality of the experience they provide to members,
                the impact they achieve, and how they help the Alliance learn
                and build capacity.
              </p>
            </FAQExpandable>
            <FAQExpandable title="What are some examples of actions?">
              <p>
                Right now, we are taking small-scale actions focused on
                learning, not direct impact. Here are examples of actions we
                have taken recently:
              </p>

              <ExampleActionCardList />
            </FAQExpandable>
            <FAQExpandable
              title="Why are tasks not optional?"
              expanded={question === "why-are-tasks-not-optional"}
            >
              <p>
                Reliability is the foundation of the Alliance. Since the office
                knows exactly who and how many members will complete tasks, it
                can design concrete and effective action plans.
              </p>

              <p>For example:</p>
              <ol className="list-decimal list-inside space-y-2 pl-4">
                <li>
                  The office was able to motivate a group of cafes to adopt a
                  sustainable policy before members took action because it could
                  promise that members would help them attain media coverage
                  later.
                </li>
                <li>
                  The office was able to design a statistically meaningful
                  experiment because it knew how many members would participate.
                </li>
              </ol>
              <p>
                Strategically, the Alliance operates like a sports team,
                orchestra, or company—not like a loose crowd. A crowd can be
                large and energetic, but it is unpredictable: people drift in
                and out, and no one knows exactly who will act when needed. By
                contrast, a sports team, orchestra, or company can set specific
                goals and execute precise strategies because every person will
                show up and do their part.
              </p>

              <p>
                In the long run, the willingness of members to take actions that
                are inconvenient or do not personally benefit them will allow
                people with many different interests from around the world to
                help each other. Given the urgency of global crises, we
                prioritize effective action over perfect consensus.
              </p>
            </FAQExpandable>
            <FAQExpandable
              title="What if I do not, or cannot, complete a task?"
              expanded={question === "cannot-complete-a-task"}
            >
              <p>
                If you have already spent 15 minutes completing tasks in a given
                week, you can withdraw from your remaining tasks without
                affecting your membership status.
              </p>

              <p>
                If you have a moral objection to a task, you can withdraw from
                that task without affecting your membership status.
              </p>

              <p>
                Otherwise, a member who misses 2 or more of the last 10 tasks
                will have their contract suspended and will be unable to
                participate in Alliance governance.
              </p>

              <p>
                Former members can rejoin the Alliance by re-signing the
                contract.
              </p>
            </FAQExpandable>
            <FAQExpandable
              title="Who runs the Alliance?"
              expanded={question === "who-runs-the-alliance"}
            >
              <p>
                The Alliance is run by Sidney Hough and Mark Xu. The full list
                of Alliance staff can be found{" "}
                <Link to={"/people"} className="text-link">
                  here
                </Link>
                .
              </p>
            </FAQExpandable>
            <FAQExpandable
              title="How is the Alliance funded?"
              expanded={question === "how-is-the-alliance-funded"}
            >
              <p>
                Initial funding for the Alliance was provided by{" "}
                <a href="https://barnes.page/" className="text-link">
                  Elizabeth Barnes
                </a>
                . Funds are managed by the Alliance Foundation, a 501(c)(3)
                nonprofit organization.
              </p>
            </FAQExpandable>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default FAQPage;
