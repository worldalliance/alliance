import Card, { CardStyle } from "@alliance/shared/ui/Card";
import React from "react";
import ExampleActionCategoryCard from "../../components/ExampleActionCategoryCard";
import Footer from "../../components/Footer";
import MarkdownWrapper from "../../components/MarkdownWrapper";
import MemberContract from "../../components/MemberContract";
import PrelaunchNavbar from "../../components/PrelaunchNavbar";

const GuidePage: React.FC = () => {
  return (
    <div className="min-h-screen flex flex-col bg-white">
      <PrelaunchNavbar transparent={false} absolute={false} />
      <div className="flex flex-col md:flex-row mx-6 md:mx-12 lg:mr-40 gap-8 lg:gap-18 pt-8 md:pt-32 pb-56 justify-center">
        <aside className="min-w-80">
          <div className="flex flex-col md:sticky top-12 pr-8 lg:pr-18 md:border-r border-zinc-200">
            <h2 className="font-serif !font-semibold !text-xl md:!text-2xl max-w-2xl mb-4">
              Table of Contents
            </h2>
            <ol className="flex flex-col gap-y-1 *:hover:underline">
              <li>
                <a href="#goals" className="">
                  Goals
                </a>
              </li>
              <li>
                <a href="#structure" className="">
                  Structure
                </a>
              </li>
              <li>
                <a href="#priorities" className="">
                  How do we determine priorities?
                </a>
              </li>
              <li>
                <a href="#membership" className="">
                  What does it mean to be a member?
                </a>
              </li>
              <li className="ml-4">
                <a href="#contract" className="">
                  Contract
                </a>
              </li>
              <li>
                <a href="#governance" className="">
                  Governance
                </a>
              </li>
            </ol>
          </div>
        </aside>
        <div className="flex flex-col max-w-[46rem]">
          <div className="mx-auto w-full mb-4 md:mb-16">
            <h2 className="font-serif !font-medium !text-4xl md:!text-6xl mb-3 text-black">
              Guide to the Alliance
            </h2>
            <p className="text-base md:text-lg text-zinc-600">
              Information about the Alliance in recommended reading order. If
              you think you are likely to become a member, you do not need to
              read everything—we will walk you through the information when you
              sign up.
            </p>
          </div>
          <Card className="mb-6 p-6" style={CardStyle.Navy}>
            <p>
              This guide was developed and approved by 25 founding members of
              the Alliance. Learn more about the process{" "}
              <a href="/progress/early-governance" className="underline">
                here
              </a>
              .
            </p>
          </Card>

          <MarkdownWrapper
            id="goals"
            className=""
            markdownContent="
# Goals

The Alliance is nonideological. The goals, structure, membership expectations, and process we describe in this guide all derive from the wants and needs expressed by members and from robust evidence about the wants and needs of humanity.

We believe that the chief purpose of civilization is to serve individuals and future generations in their pursuit of fulfillment and happiness. We want to create a world in which every individual has the resources and freedom to achieve happiness and fulfillment, humanity’s most important decisions are made with democratic input, and people live free of political, economic, and environmental insecurity.

Therefore, as a starting point, we seek to address urgent global crises that harm or will harm billions of current and future people.

"
          />
          <MarkdownWrapper
            id="structure"
            className="mt-6"
            markdownContent="

# Structure

Our structure has two key components:
1. **Commitment-based membership.** We each dependably make a small amount of our time and resources available to the Alliance.
2. **Central strategy.** We are served by a strategic office that designs collective actions to ensure they are effective. The strategic office breaks actions into easy-to-follow steps and communicates with members over an online platform.

These two components are mutually dependent. Without a strategic office, members do not have concrete plans to act on. Without members that can be counted upon, the strategic office cannot make concrete plans.

Analogously, companies require:
1. Leadership to track the big picture and coordinate employee activity.
2. Employees that can be counted on to perform the tasks requested of them.

When either component is missing, individuals are only able to take isolated actions or simple, one-off collective actions.

In return for their commitment, members’ contributions have a massively amplified impact. The Alliance will be able to plan in advance, coordinate flexibly, wield clear leverage, act proactively rather than reactively, and learn from experience.

Simply put, our structure enables the same tight cooperation that makes corporations, governments, and other formal organizations coherent and effective.

We are capable of working together in many possible arrangements for many purposes. A few broad categories of collective actions we can take together include:

"
          />
          <div className="grid grid-cols-2 md:grid-cols-2 gap-3 my-6 w-full max-w-4xl mx-auto">
            <ExampleActionCategoryCard
              title="Collective funding"
              description="We pool funding for specific initiatives and projects within the Alliance and with our partners."
            />
            <ExampleActionCategoryCard
              title="Economic pressure"
              description="We coordinate shifts in our consumer behavior to encourage ethical practices and eliminate harmful practices."
            />
            <ExampleActionCategoryCard
              title="Social pressure"
              description="We target messages at decision-makers and direct public attention to important issues."
            />
            <ExampleActionCategoryCard
              title="Synced communication"
              description="We learn from and deliberate with one another through a central channel that builds a base of common knowledge."
            />
            <ExampleActionCategoryCard
              title="Direct action"
              description="We use our time and skills to advance certain causes, improve local and online communities, and more."
            />
            <ExampleActionCategoryCard
              title="Collective governance"
              description="We maintain and improve the Alliance by engaging in deliberations and other processes for feedback."
            />
          </div>
          <MarkdownWrapper
            id="priorities"
            className="mt-2"
            markdownContent="

# How do we determine priorities?

We balance foundational moral principles, democratic input, and pragmatic considerations in determination of priorities.

## Morality
We believe that the establishment of an explicit moral foundation is important for priority-setting, is necessary to avoid risks associated with majority decision-making, and establishes a shared framework that will prevent members from talking past one another in deliberation.

In assessment of morality, we hew to a universal and unbiased principle that nearly all cultures share: that one should not treat others as one would not like to be treated by them. This includes respecting other’s preferred way of being treated, within reasonable limits.

More concretely, we believe that a fundamental tradeoff in civilization is one between individual autonomy and individual protections from the actions of others. In an ideal civilization, everyone would be free to do anything except to impose unwanted influences on others.

For example, this shared morality is violated in global crises such as environmental destruction, which involves parties non-consensually imposing heavy costs on billions of current and future people.

## Democratic input
We plan actions that satisfy both:
1. The collective interests of humanity, as we can best determine using unbiased data about global preferences and the aforementioned moral reasoning.
2. The collective interests of members, as we can determine through internal democratic processes.

We expect nearly complete overlap between these two categories. However, we will not pursue member interests that we perceive to negatively impact humanity at large. And, conversely, we will not pursue general human interests to which a majority of members are opposed.

To determine member interests, the strategic office will solicit input by running polls and deliberations, soliciting proposals, and so on.

The Alliance will also undergo a periodic [course adjustment](#governance) process to check that members feel their contributions are well-utilized and their voices are heard.

## Pragmatic considerations
The Alliance aims to address urgent problems faced by civilization. This work involves unavoidable tradeoffs:
1. We will often need to prioritize issues based on their scale, tractability, and time-sensitivity.
2. It will not be possible to consult and satisfy every stakeholder in every action that we take.
3. It will not be possible for every decision to be made with full member consensus. The strategic office will address serious operational concerns with its plans, but our mission would be severely impeded by extensive debate about every action.

We accept our decision-making process will inevitably contain imperfections and we will seek to minimize their harm.
"
          />
          <MarkdownWrapper
            id="membership"
            className="mt-6"
            markdownContent="
# What does it mean to be a member?

Alliance members are individuals that have committed to cooperate with one another to build a better future for all.

When you take action as a member, you can do so with confidence that everyone else is playing their part. Likewise, when others take action, they are depending on you to play your part.

## Dependability
The Alliance's ability to plan actions depends on members reliably taking the actions assigned to them. Moreover, when individuals are not reliable, others are forced to compensate and trust degrades.

Effective cooperation is not achieved by pursuit of some idealistic harmony: it is achieved by working through uncertainty, disagreement, and inconvenience in order to reach a common goal.

Our common goal is not to create a future that is perfect from the perspective of every member, but to create a future that members agree is significantly better than the future that would occur otherwise. Therefore, members abide by a *democratic process that decides actions* rather than decide individually whether or not to participate in every action. Similarly, a democratic society depends on citizens following every law, not only the laws they agree with.

We recognize the risks associated with collective decision-making. To mitigate these risks, we put limits on the total amount of time and resources required from members, and our governance procedures ensure that members approve of the overall goals and direction of the Alliance.

## Contract
The following constitutes the basic promise that current members make to one another:
"
          />

          <div className="my-4">
            <MemberContract id="contract" />
          </div>
          <MarkdownWrapper
            id="required-investment"
            markdownContent="

## Example actions
Eventually, we will focus on actions that achieve direct impact. Today, we are in an experimental phase in which we are learning from members and refining the early shape of the Alliance.

Early members may take part in:
- Shaping early governance processes.
- Talking to friends and family about the Alliance.
- Testing the Alliance online platform.
- Reading about and discussing Alliance priorities with other members.
- Participating in small-scale (less than $1/day) donation-pooling experiments.
"
          />
          <MarkdownWrapper
            id="governance"
            className="mt-6"
            markdownContent="
# Governance
Our governance depends on a periodic “course adjustment” process:
1. In course adjustment, we will ask members what they think about the direction of the Alliance and whether or not they have any major concerns. We will collect common feedback, respond publicly with our plans to address the feedback, collect more feedback, and continue to iterate until the majority of members are satisfied.
2. Course adjustment will re-occur once 10 actions have been taken and 3 months have passed since the last course adjustment
3. As a backstop, course adjustment can occur at any time if requested by more than 50% of members.

The specific goal of course adjustment is to have more than 75% of members believe that:
1. 80% of their contributions to the Alliance will advance causes they support after course adjustment.
2. Their major concerns will be addressed after course adjustment.

This governance procedure will be in effect prior to public launch. When we are close to our public launch, we will collectively develop a set of more complex and formal procedures.

"
          />
        </div>
        {/* <aside className="w-80"></aside> */}
      </div>
      <Footer />
    </div>
  );
};

export default GuidePage;
