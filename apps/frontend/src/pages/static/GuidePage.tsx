import React from "react";
import ExampleActionCategoryCard from "../../components/ExampleActionCategoryCard";
import Footer from "../../components/Footer";
import MarkdownWrapper from "../../components/MarkdownWrapper";
import MemberContract from "../../components/MemberContract";
import PrelaunchNavbar from "../../components/PrelaunchNavbar";

import { href } from "react-router";
import ResourceButton from "../../components/ResourceButton";
import ExampleActionCardList from "../../components/ExampleActionCardList";

const GuidePage: React.FC = () => {
  return (
    <div className="min-h-screen flex flex-col bg-white">
      <PrelaunchNavbar transparent={false} absolute={false} />
      <div className="flex flex-col md:flex-row mx-2 sm:mx-4 md:mx-12 lg:mr-40 gap-8 lg:gap-18 pt-8 md:pt-32 pb-56 justify-center">
        <aside className="min-w-80">
          <div className="border p-3 flex flex-col md:sticky top-12 md:pr-8 lg:pr-18 md:border-r md:border-y-0 md:border-l-0 border-zinc-200">
            <h2 className="!font-semibold !text-lg md:!text-xl max-w-2xl mb-4">
              Table of contents
            </h2>
            <ol className="flex flex-col gap-y-1 *:hover:underline">
              <li>
                <a href="#priorities" className="">
                  Priorities
                </a>
              </li>
              <li>
                <a href="#structure" className="">
                  How we work
                </a>
              </li>
              <li>
                <a href="#governance" className="">
                  How we make decisions
                </a>
              </li>
              <li>
                <a href="#resources" className="">
                  Resources
                </a>
              </li>
            </ol>
          </div>
        </aside>
        <div className="flex flex-col max-w-[46rem]">
          <div className="mx-auto w-full mb-4 md:mb-6">
            <h2 className="font-serif font-bold text-3xl md:text-5xl mb-3 text-black">
              Guide to the Alliance
            </h2>
          </div>

          <div className="flex flex-col gap-y-4">
            <MarkdownWrapper
              id="introduction"
              className=""
              markdownContent="
The Alliance is a group of individuals cooperating to improve the world. Each member spends a small fraction of their time completing tasks that advance our shared goals.

Our long-term goal is to unite humanity behind a global, expert-developed plan to end global crises. Right now, we are running experiments to test our organizational structures and processes.
"
            />

            <div>
              <MarkdownWrapper
                id="priorities"
                markdownContent="
            
# Priorities

Our immediate goal is to end global crises that harm or will harm billions of current and future people. In no particular order, we are focused on:

1. Extreme poverty
2. Environmental destruction
3. The decline of democratic institutions
4. Dangerous technological development

"
              />
            </div>

            <div>
              <MarkdownWrapper
                id="structure"
                markdownContent="

# How we work

## Responsibilities and trust

The Alliance is composed of a body of members and a full-time strategic office.

1. The responsibility of the office is to develop plans, and corresponding tasks, that effectively advance Alliance priorities.
2. The responsibility of members is to reliably complete tasks assigned on our online platform.

"
              />

              <div className="my-12 flex flex-col gap-y-4">
                <MemberContract id="contract" />
                <p className="text-center text-sm text-zinc-800">
                  Our current membership contract
                </p>
              </div>

              <MarkdownWrapper
                id="structure-2"
                markdownContent="

The foundation of the Alliance is trust.

1. The office trusts members to complete tasks, which allows the office to plan effectively. We maintain this trust with our membership contract, which restricts membership to those that can keep their agreements.
2. Members trust the office to develop effective plans, which makes their duty as simple as completing their assigned tasks. We maintain this trust with governance processes and with regular communication between members and the office.

"
              />

              <MarkdownWrapper
                id="structure-3"
                markdownContent="

## Current and future coordination

Right now, we are taking small-scale actions focused on learning, not direct impact. Here are examples of actions we have taken recently:

"
              />

              <div className="my-8">
                <ExampleActionCardList />
              </div>

              <MarkdownWrapper
                id="structure-4"
                markdownContent="

As the Alliance grows, we plan to bring together experts from diverse fields to make increasingly impactful, long-term plans. Our online platform will enable direct communication between these experts and millions of members to enact rapid, large-scale change.

A few broad categories of actions include:

"
              />

              <div className="grid grid-cols-2 rounded border border-zinc-200 mt-8 w-full max-w-4xl mx-auto">
                <ExampleActionCategoryCard
                  title="Pooled funding"
                  description="We can pool funding for ambitious initiatives, some of which would otherwise depend on governments."
                  example="For example, we could fund and oversee an independent scientific and industrial coalition to decarbonize the global economy."
                />
                <ExampleActionCategoryCard
                  title="Economic pressure"
                  description="We can shift our consumption to encourage ethical practices and eliminate harmful practices."
                  example="For example, we could enforce a transparency standard by asking members to only purchase from companies that meet it."
                />
                <ExampleActionCategoryCard
                  title="Social pressure"
                  description="We can target messages at decision-makers and direct public attention to important issues."
                  example="For example, we could run an individualized education campaign to support a multilateral AI governance treaty."
                />
                <ExampleActionCategoryCard
                  title="Central communication"
                  description="We can establish a base of common knowledge to build agreement over time."
                  example="For example, we could ask members to spend a small amount of time each week reading the same news."
                />
                <ExampleActionCategoryCard
                  title="Direct action"
                  description="We can use our own skills and resources to advance our priorities."
                  example="For example, we could design and participate in the largest citizen science projects in history."
                />
                <ExampleActionCategoryCard
                  title="Collective governance"
                  description="We can maintain, improve, and govern the Alliance."
                  example="For example, we could use random member assemblies to deliberate contentious issues."
                />
              </div>
            </div>

            <MarkdownWrapper
              id="governance"
              markdownContent="

# How we make decisions

Members provide input and participate in governance that ensures approval of the overall direction of the Alliance. 

Meanwhile, the office has the freedom to make any plans that advance our high-level priorities and make effective use of members’ time and resources.

## The office plans actions
Planning actions is a creative, open-ended process that searches for levers of change which members can pull.

In ideation for and development of an action plan, the office weighs many considerations. For instance:
- How does the action relate to the priorities of the Alliance?
- Will the action produce a tangible impact on the world?
- Will the action make effective use of members’ time?
- Will the action have any compounding effects – for instance, by providing an educational opportunity or growing the Alliance’s network?

## Members oversee the office
Our governance guarantees that the majority of members believe the majority of their contributions improve the world.

We conduct a membership-wide oversight process that occurs on a regular basis, or whenever it is requested by a majority of members. In the process, the office asks members what they think about the direction of the Alliance and whether or not they have any major concerns. The office collects and responds to feedback until we reach an approval threshold of 75%.

This procedure achieves two goals:
1. Members determine the high-level goals and methods of the Alliance.
2. The office retains the freedom to plan any action that advances approved goals with approved methods. It is not required to do what is most popular, nor do actions need unanimous support, so it can operate efficiently and effectively.

It is inevitable, though rare, that some members are assigned tasks whose justifications they do not agree with. Given the urgency of global crises, it is important that we collectively prioritize action over perfect consensus.

In addition to formal governance, the office incorporates member input by other means. For instance, the office hosts discussions, asks members for action proposals, solicits open-ended feedback, and so on.
"
            />

            <div className="flex flex-col gap-y-2">
              <MarkdownWrapper
                id="resources"
                markdownContent="

# Resources

"
              />

              <ResourceButton className="mt-4" to={href("/foundation")}>
                <p className="text-base">
                  <span className="font-semibold">Our foundation</span>{" "}
                  describes how we derived our priorities.
                </p>
              </ResourceButton>

              <ResourceButton to={href("/governance")}>
                <p className="text-base">
                  <span className="font-semibold">Our governance</span>{" "}
                  describes office and member obligations.
                </p>
              </ResourceButton>

              <ResourceButton to={href("/faq")}>
                <p className="text-base">
                  <span className="font-semibold">Our FAQ</span> answers common
                  questions.
                </p>
              </ResourceButton>
            </div>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default GuidePage;
