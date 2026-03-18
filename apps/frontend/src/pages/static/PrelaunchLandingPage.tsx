import React from "react";
import { useQueries } from "@tanstack/react-query";
import { Link, href } from "react-router";
import PrelaunchNavbar from "../../components/PrelaunchNavbar";
import alliancePeople from "../../assets/alliance_people.webp";
import { actionsFindOne } from "@alliance/shared/client";
import type { ActionDto } from "@alliance/shared/client";
import Spinner from "@alliance/sharedweb/ui/Spinner";
import { ChevronRight } from "lucide-react";
import Footer from "../../components/Footer";

const FEATURED_ACTION_IDS: number[] = [81, 79, 76, 75];

function usePrelaunchActions() {
  const results = useQueries({
    queries: FEATURED_ACTION_IDS.map((id) => ({
      queryKey: ["actions", "featured", id],
      queryFn: () =>
        actionsFindOne({ path: { id } }).then(
          (r) => r.data as ActionDto | undefined,
        ),
    })),
  });
  const actions = results
    .map((r) => r.data)
    .filter((a): a is ActionDto => a != null);
  const isPending = results.some((r) => r.isPending);
  return { actions, isPending };
}

function PreviewActionCard({ action }: { action: ActionDto }) {
  return (
    <Link
      to={href("/actions/:id", { id: action.id.toString() })}
      className="group relative flex flex-row items-start justify-between gap-4 rounded-lg bg-white p-4 lg:p-6 hover:bg-zinc-50"
    >
      <div className="flex flex-col gap-1 min-w-0 flex-1">
        <p className="text-lg lg:text-xl font-medium text-black">
          {action.name}
        </p>
        <p className="text-zinc-500 text-base lg:text-lg">
          {action.shortDescription}
        </p>
      </div>
      <ChevronRight className="h-5 w-5 shrink-0 text-green" aria-hidden />
    </Link>
  );
}

const PrelaunchLandingPage: React.FC = () => {
  const { actions, isPending } = usePrelaunchActions();

  return (
    <div className="flex flex-col">
      <PrelaunchNavbar transparent={false} absolute={false} showLogo={false} />

      <div className="flex-1 flex flex-col mx-auto w-full bg-white">
        <section className="bg-white w-full px-8 py-12 lg:py-24">
          <div className="flex items-start justify-center mb-12">
            <div className="flex flex-col gap-y-3 lg:gap-y-8 max-w-[700px]">
              <p className="font-berlingske uppercase font-medium font-serif text-3xl lg:text-4xl text-black text-center">
                The Alliance
              </p>
              <div className="flex flex-col gap-y-3 lg:gap-y-6 text-zinc-900 text-lg sm:text-xl lg:text-2xl text-center">
                <p>
                  The Alliance is a global group of people cooperating to
                  improve the world. We require dependable time commitments from
                  members, which allows us to plan and execute precise,
                  effective actions.
                </p>
                <p>
                  We are in an experimental, invite-only phase. We aim to give
                  members, and ultimately a significant proportion of humanity,
                  the ability to make deliberate, large-scale change.
                </p>
              </div>
            </div>
          </div>
          <div className="flex flex-col items-center mx-auto gap-y-4 lg:max-w-[1000px]">
            <img
              src={alliancePeople}
              alt="Alliance members"
              className="w-full lg:max-h-screen object-contain rounded-md"
            />
            <p className="text-center text-zinc-500 text-base lg:text-lg">
              A few members gathered in San Francisco, California
            </p>
          </div>
        </section>

        <section className="bg-page w-full mx-auto px-8 py-12 lg:py-24">
          <div className="max-w-[1000px] flex flex-col items-center justify-start gap-y-4 lg:gap-y-6 mx-auto">
            <p className="text-heading-public text-black w-full">
              Recent actions
            </p>
            {isPending ? (
              <div className="flex justify-center py-8">
                <Spinner size="large" />
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 lg:gap-4 w-full">
                {actions.map((action) => (
                  <PreviewActionCard key={action.id} action={action} />
                ))}
              </div>
            )}
          </div>
        </section>
      </div>
      <Footer />
    </div>
  );
};

export default PrelaunchLandingPage;
