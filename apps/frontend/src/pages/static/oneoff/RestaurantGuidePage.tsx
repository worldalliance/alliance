import React from "react";
import Footer from "../../../components/Footer";
import PrelaunchNavbar from "../../../components/PrelaunchNavbar";

const RestaurantGuidePage: React.FC = () => {
  return (
    <div className="min-h-screen flex-col flex bg-white">
      <PrelaunchNavbar transparent={false} absolute={false} />
      <div className="flex-1 max-w-6xl mx-auto pt-12 md:pt-28 pb-56 px-5 flex flex-col gap-y-16 md:gap-y-24">
        <div className="text-center">
          <h1 className="text-title mb-6">Opt-In Implementation Guide</h1>
          <p className="text-zinc-900 text-base md:text-lg max-w-3xl mx-auto">
            Step-by-step instructions to configure your ordering platforms and
            require a mandatory per-item utensil selection.
          </p>
        </div>

        <div className="w-full">
          <h2 className="text-title-small mb-8 text-center">
            Delivery Platforms
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="border border-green p-6 rounded bg-white">
              <h3 className="text-xl font-medium text-zinc-900 mb-6">
                DoorDash
              </h3>
              <ol className="list-decimal text-zinc-800 space-y-4 pl-4 text-sm md:text-base">
                <li>
                  Go to <strong>Menu Manager</strong> and select{" "}
                  <strong>Modifier Groups</strong>.
                </li>
                <li>
                  Create a new group named <strong>"Include Utensils?"</strong>.
                </li>
                <li>
                  Add options: <strong>"Yes"</strong> ($0.00) and{" "}
                  <strong>"No"</strong> ($0.00).
                </li>
                <li>
                  Set <strong>Required</strong> to "Yes" and set both Min and
                  Max selection to 1.
                </li>
                <li>
                  <strong>Apply to Items:</strong> Bulk-assign this modifier
                  group under the <strong>Used In</strong> tab to every item
                  eaten with utensils.
                </li>
                <li>
                  <strong>Publish</strong> to update your live menu.
                </li>
              </ol>
            </div>

            <div className="border border-green p-6 rounded bg-white">
              <h3 className="text-xl font-medium text-zinc-900 mb-6">
                Uber Eats
              </h3>
              <ol className="list-decimal text-zinc-800 space-y-4 pl-4 text-sm md:text-base">
                <li>
                  Open <strong>Uber Eats Manager</strong> and navigate to the{" "}
                  <strong>Menu</strong> tab.
                </li>
                <li>
                  Select <strong>Modifier Groups</strong> &gt;{" "}
                  <strong>New Group</strong>.
                </li>
                <li>
                  Name it <strong>"Utensils Included?"</strong> and add "Yes"
                  and "No" choices.
                </li>
                <li>
                  Toggle <strong>Required selection</strong> to "On".
                </li>
                <li>
                  In the <strong>Items</strong> tab, link this group to all
                  relevant appetizers and entrees.
                </li>
                <li>
                  Save changes to ensure the prompt appears on every applicable
                  dish.
                </li>
              </ol>
            </div>

            <div className="border border-green p-6 rounded bg-white">
              <h3 className="text-xl font-medium text-zinc-900 mb-6">
                Grubhub
              </h3>
              <ol className="list-decimal text-zinc-800 space-y-4 pl-4 text-sm md:text-base">
                <li>Grubhub defaults to zero utensils globally.</li>
                <li>
                  Customers are automatically prompted to opt-in at checkout.
                </li>
                <li>No merchant portal configuration is required.</li>
                <li>
                  Review the <strong>Special order instructions</strong> on
                  tickets for diner requests.
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
            <div className="border border-green p-6 rounded bg-white">
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
                <li>
                  <strong>Crucial:</strong> Verify channel visibility is enabled
                  for all third-party integrations.
                </li>
                <li>
                  <strong>Publish</strong> your changes.
                </li>
              </ol>
            </div>

            <div className="border border-green p-6 rounded bg-white">
              <h3 className="text-lg font-medium text-zinc-900 mb-4">Square</h3>
              <ol className="list-decimal text-zinc-800 space-y-3 pl-4 text-sm md:text-base">
                <li>
                  Go to your Dashboard and select <strong>Items</strong> &gt;{" "}
                  <strong>Modifiers</strong>.
                </li>
                <li>
                  Click <strong>Create a modifier</strong> and name it "Include
                  Utensils?".
                </li>
                <li>Add two options: "Yes" and "No" (both priced at $0.00).</li>
                <li>
                  Under Selection Rules, toggle <strong>Required</strong> to On.
                </li>
                <li>
                  Strictly set <strong>Maximum Modifiers</strong> limit to
                  exactly 1.
                </li>
                <li>
                  Ensure <strong>online visibility</strong> is enabled.
                </li>
                <li>
                  Apply to menu items and <strong>Save</strong>.
                </li>
              </ol>
            </div>
          </div>
        </div>

        {/* Removed 'border-t' from the div below to get rid of the horizontal line */}
        <div className="w-full pt-8">
          <h2 className="text-title-small mb-8 text-center">
            Staff Operations
          </h2>
          <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white border border-green rounded p-6">
              <h4 className="font-bold text-zinc-900 mb-2">
                1. Relocate Inventory
              </h4>
              <p className="text-zinc-700 text-sm">
                Move utensils away from the primary bagging station to break the
                habit of automatic inclusion.
              </p>
            </div>
            <div className="bg-white border border-green rounded p-6">
              <h4 className="font-bold text-zinc-900 mb-2">
                2. Ticket Visibility
              </h4>
              <p className="text-zinc-700 text-sm">
                Ensure your digital kitchen displays or printed tickets clearly
                highlight the "Yes/No" utensil modifier.
              </p>
            </div>
            <div className="bg-white border border-green rounded p-6">
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
