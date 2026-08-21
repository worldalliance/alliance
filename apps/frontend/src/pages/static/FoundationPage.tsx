import React from "react";
import { Link, href } from "react-router";
import Footer from "../../components/Footer";
import PrelaunchNavbar from "../../components/PrelaunchNavbar";
import { GuideLi, GuideOl, GuideP, GuideSection } from "./StaticDocShared";

const FoundationPage: React.FC = () => {
  return (
    <div className="min-h-screen flex flex-col bg-white">
      <PrelaunchNavbar transparent={false} absolute={false} />

      <div className="mx-6 md:mx-12 pt-8 md:pt-24 pb-56">
        <div className="flex flex-row md:gap-8 lg:gap-12 justify-center">
          <div className="flex flex-col gap-y-4 max-w-184 w-full min-w-0">
            <div className="mb-8 md:mb-12 flex flex-col">
              <h1 className="text-title-large mb-4">Foundation</h1>
              <div className="flex flex-col gap-y-6 text-base md:text-lg text-zinc-500">
                <p>
                  The following principle, aims, and priorities were{" "}
                  <Link
                    to={href("/progress/:slug", { slug: "early-governance" })}
                    className="text-link"
                  >
                    developed and approved
                  </Link>{" "}
                  by 25 founding members of the Alliance.
                </p>
              </div>
            </div>
            <div className="flex flex-col gap-y-12">
              <GuideSection>
                <GuideP>
                  The Alliance is founded on a moral principle shared by nearly
                  all cultures: we should not treat others in ways that we do
                  not want to be treated.
                </GuideP>
                <GuideP>
                  Our modern, interconnected world is shaped by decisions made
                  by billions of people. If we do not want others to disregard
                  how their decisions impact us, we cannot disregard how our
                  decisions impact them.
                </GuideP>
                <GuideP>
                  The Alliance holds itself and others accountable to this
                  principle. At times, we will seek to change external
                  institutions and individuals; at other times, we will change
                  ourselves.
                </GuideP>
                <GuideP>
                  Given this principle, the initial aim of the Alliance is to
                  create a world in which:
                </GuideP>
                <GuideOl>
                  <GuideLi>
                    Every person has the resources and freedom to achieve
                    happiness and fulfillment, as most people do not want others
                    to deprive them of such opportunity;
                  </GuideLi>
                  <GuideLi>
                    Every person lives free of political, economic, and
                    environmental insecurity, as most people do not want others
                    to impose such conditions upon them;
                  </GuideLi>
                  <GuideLi>
                    Decisions of great importance for humanity are made with
                    substantive democratic input, as most people do not want
                    others to exclude them from choices which determine their
                    future.
                  </GuideLi>
                </GuideOl>
                <GuideP>
                  Therefore, the initial priorities of the Alliance are to
                  address the following global crises, which represent great
                  differences between our world and the world we seek to create:
                  extreme poverty, environmental destruction, the decline of
                  democratic institutions, and dangerous technological
                  development.
                </GuideP>
              </GuideSection>
            </div>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default FoundationPage;
