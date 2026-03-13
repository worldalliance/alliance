import React from "react";
import Footer from "../../../components/Footer";
import PrelaunchNavbar from "../../../components/PrelaunchNavbar";

const RestaurantGuidePage: React.FC = () => {
  return (
    <div className="min-h-screen flex flex-col bg-white">
      <PrelaunchNavbar transparent={false} absolute={false} />
      <div className="flex-1 max-w-6xl mx-auto pt-12 md:pt-28 pb-56 px-5 flex flex-col gap-y-16 md:gap-y-24">
        <div className="text-center">
          <h1 className="text-title mb-6">Opt-In Implementation Guide</h1>
          <p className="text-zinc-900 text-base md:text-lg max-w-3xl mx-auto">
            Step-by-step instructions to configure your ordering platforms and
            require a mandatory yes/no utensil selection.
          </p>
        </div>

        <div className="w-full">
          <h2 className="text-title-small mb-8 text-center">
            Delivery Platforms
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="border border-zinc-200 p-6 rounded bg-white">
              <h3 className="text-xl font-medium text-zinc-900 mb-6">
                DoorDash
              </h3>
              <ol className="list-decimal text-zinc-800 space-y-4 pl-4 text-sm md:text-base">
                <li>
                  Log in to the <strong>DoorDash Merchant Portal</strong>.
                </li>
                <li>
                  Navigate to <strong>Settings</strong> in the left sidebar.
                </li>
                <li>
                  Click <strong>Store Settings</strong>.
                </li>
                <li>
                  Scroll to <strong>Single-Use Items</strong>.
                </li>
                <li>
                  Toggle on{" "}
                  <strong>
                    "Require customers to request single-use items"
                  </strong>
                  .
                </li>
                <li>
                  Click <strong>Save</strong>.
                </li>
              </ol>
            </div>

            <div className="border border-zinc-200 p-6 rounded bg-white">
              <h3 className="text-xl font-medium text-zinc-900 mb-6">
                Uber Eats
              </h3>
              <ol className="list-decimal text-zinc-800 space-y-4 pl-4 text-sm md:text-base">
                <li>
                  Log in to <strong>Uber Eats Manager</strong>.
                </li>
                <li>
                  Click the <strong>Settings</strong> icon in the sidebar.
                </li>
                <li>
                  Navigate to the <strong>General</strong> tab.
                </li>
                <li>
                  Scroll to <strong>Utensils and single-use items</strong>.
                </li>
                <li>
                  Toggle the setting to <strong>On</strong>.
                </li>
                <li>
                  Click <strong>Save</strong>.
                </li>
              </ol>
            </div>

            <div className="border border-zinc-200 p-6 rounded bg-white">
              <h3 className="text-xl font-medium text-zinc-900 mb-6">
                Grubhub
              </h3>
              <ol className="list-decimal text-zinc-800 space-y-4 pl-4 text-sm md:text-base">
                <li>
                  Log in to <strong>Grubhub for Restaurants</strong>.
                </li>
                <li>
                  Go to the left sidebar and select <strong>Settings</strong>.
                </li>
                <li>
                  Click on <strong>Menu</strong>.
                </li>
                <li>
                  Find the <strong>Single-use items</strong> section.
                </li>
                <li>Enable the toggle to require diner opt-in.</li>
                <li>
                  Click <strong>Save changes</strong>.
                </li>
              </ol>
            </div>
          </div>
        </div>

        <div className="w-full">
          <h2 className="text-title-small mb-8 text-center">
            Direct Ordering Systems
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="border border-zinc-200 p-6 rounded bg-zinc-50">
              <h3 className="text-lg font-medium text-zinc-900 mb-4">Toast</h3>
              <ol className="list-decimal text-zinc-800 space-y-3 pl-4 text-sm md:text-base">
                <li>
                  Go to <strong>Menus</strong> &gt;{" "}
                  <strong>Modifier Groups</strong>.
                </li>
                <li>
                  Click <strong>+ Add Modifier Group</strong> and name it
                  "Include Utensils?".
                </li>
                <li>
                  Under <strong>Properties</strong>, set{" "}
                  <strong>Required?</strong> to Yes.
                </li>
                <li>
                  Set <strong>Min Selections</strong> to 1 and{" "}
                  <strong>Max Selections</strong> to 1.
                </li>
                <li>
                  Add two Modifier Options: "Yes" ($0.00) and "No" ($0.00).
                </li>
                <li>Attach this group to your takeout and delivery menus.</li>
                <li>
                  <strong>Publish</strong> your changes.
                </li>
              </ol>
            </div>

            <div className="border border-zinc-200 p-6 rounded bg-zinc-50">
              <h3 className="text-lg font-medium text-zinc-900 mb-4">Square</h3>
              <ol className="list-decimal text-zinc-800 space-y-3 pl-4 text-sm md:text-base">
                <li>
                  Go to your Square Dashboard and select <strong>Items</strong>{" "}
                  &gt; <strong>Modifiers</strong>.
                </li>
                <li>
                  Click <strong>Create Modifier Set</strong>.
                </li>
                <li>Name it "Include Utensils?".</li>
                <li>Add two options: "Yes" and "No" (both priced at $0.00).</li>
                <li>Apply this set to your online menu items.</li>
                <li>
                  Edit the item settings and toggle{" "}
                  <strong>Require Modifier</strong> to On.
                </li>
                <li>
                  <strong>Save</strong> your changes.
                </li>
              </ol>
            </div>
          </div>
        </div>

        <div className="w-full border-t border-zinc-100 pt-16">
          <h2 className="text-title-small mb-8 text-center">
            Staff Operations
          </h2>
          <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white border border-zinc-200 rounded p-6">
              <h4 className="font-bold text-zinc-900 mb-2">
                1. Relocate Inventory
              </h4>
              <p className="text-zinc-700 text-sm">
                Move utensils away from the primary bagging station to break the
                habit of automatic inclusion.
              </p>
            </div>
            <div className="bg-white border border-zinc-200 rounded p-6">
              <h4 className="font-bold text-zinc-900 mb-2">
                2. Ticket Visibility
              </h4>
              <p className="text-zinc-700 text-sm">
                Ensure your digital kitchen displays or printed tickets clearly
                highlight the "Yes/No" utensil modifier.
              </p>
            </div>
            <div className="bg-white border border-zinc-200 rounded p-6">
              <h4 className="font-bold text-zinc-900 mb-2">
                3. Staff Briefing
              </h4>
              <p className="text-zinc-700 text-sm">
                Instruct your team to only include utensils when explicitly
                marked "Yes" on the order ticket.
              </p>
            </div>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default RestaurantGuidePage;
