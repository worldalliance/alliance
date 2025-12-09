import React from "react";
import Footer from "../../components/Footer";
import MarkdownWrapper from "../../components/MarkdownWrapper";
import PrelaunchNavbar from "../../components/PrelaunchNavbar";
import Card, { CardStyle } from "@alliance/shared/ui/Card";
import chevronRight from "../../assets/icons8-expand-arrow-96.png";
import { Link, href } from "react-router";

const FoundationPage: React.FC = () => {
  return (
    <div className="min-h-screen flex flex-col bg-white">
      <PrelaunchNavbar transparent={false} absolute={false} />
      <div className="flex flex-col md:flex-row mx-2 sm:mx-4 md:mx-12 pt-8 md:pt-32 pb-56 justify-center">
        <div className="flex flex-col max-w-[46rem]">
          <div className="mx-auto w-full mb-2">
            <h2 className="font-serif !font-semibold !text-4xl text-black">
              Foundation
            </h2>
          </div>

          <Link
            to={href("/progress/:slug", { slug: "early-governance" })}
            className="mb-8"
          >
            <Card
              style={CardStyle.White}
              className="mt-4 p-4 md:p-4 text-lg cursor-pointer hover:bg-zinc-50 flex flex-row gap-x-4 items-center justify-between"
            >
              <p className="text-base">
                The following principle, aims, and priorities were developed and
                approved by 25 founding members of the Alliance.
              </p>
              <img src={chevronRight} className="w-4 h-4 rotate-270" />
            </Card>
          </Link>

          <div className="flex flex-col gap-y-6">
            <MarkdownWrapper
              id="foundation"
              className=""
              markdownContent="
The founding principle of the Alliance is that one should not treat others in ways that one does not want to be treated. The Alliance holds itself and others accountable to this principle.

From this principle follow the aims of the Alliance:
1. That every person has the resources and freedom to achieve happiness and fulfillment, as most people do not want others to deprive them of such opportunity;
2. That every person lives free of political, economic, and environmental insecurity, as most people do not want others to impose such conditions upon them;
3. That decisions of great importance for humanity are made with substantive democratic input, as most people do not want others to exclude them from choices which determine their future.

Therefore, the initial priorities of the Alliance are to address the following global crises, which represent great differences between our world and the world we seek to create: extreme poverty, environmental destruction, the decline of democratic institutions, and dangerous technological development.
"
            />
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default FoundationPage;
