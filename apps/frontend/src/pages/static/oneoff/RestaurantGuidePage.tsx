import React from "react";
import Footer from "../../../components/Footer";
import PrelaunchNavbar from "../../../components/PrelaunchNavbar";

const RestaurantGuidePage: React.FC = () => {
  return (
    <div className="min-h-screen flex flex-col bg-white">
      <PrelaunchNavbar transparent={false} absolute={false} />
      <div className="flex-1 max-w-4xl mx-auto pt-12 md:pt-28 pb-56 px-5 flex flex-col gap-y-16 md:gap-y-24">
        <div className="text-center">
          <h1 className="text-title mb-6">
            Implementation Guide for Restaurants
          </h1>
          <div className="text-zinc-900 text-base md:text-lg max-w-3xl mx-auto space-y-6">
            <p>
              Transitioning to an opt-in utensil model is one of the easiest
              ways for your restaurant to reduce overhead costs and
              environmental impact. Whether you use third-party delivery apps or
              your own online ordering system, updating your settings takes only
              a few minutes.
            </p>
          </div>
        </div>

        <div className="w-full">
          <h2 className="text-title-small mb-8 text-center">
            Third-Party Delivery Platforms
          </h2>

          <div className="flex flex-col gap-6">
            <div className="border border-zinc-200 p-6 md:p-8 rounded bg-white">
              <h3 className="text-xl font-medium text-zinc-900 mb-4">
                DoorDash
              </h3>
              <p className="text-zinc-600 mb-6">
                DoorDash has a built-in feature to ask customers if they need
                single-use items before they place an order.
              </p>
              <ol className="list-decimal list-inside text-zinc-800 space-y-3">
                <li>
                  Log in to the <strong>DoorDash Merchant Portal</strong>.
                </li>
                <li>
                  Navigate to the <strong>Settings</strong> tab on the left-hand
                  menu.
                </li>
                <li>
                  Select <strong>Store Settings</strong>.
                </li>
                <li>
                  Scroll down to the <strong>Single-Use Items</strong> section.
                </li>
                <li>
                  Toggle the setting to{" "}
                  <strong>
                    "Require customers to request single-use items"
                  </strong>
                  .
                </li>
                <li>Save your changes.</li>
              </ol>
            </div>

            <div className="border border-zinc-200 p-6 md:p-8 rounded bg-white">
              <h3 className="text-xl font-medium text-zinc-900 mb-4">
                Uber Eats
              </h3>
              <p className="text-zinc-600 mb-6">
                Uber Eats allows merchants to enable an eco-friendly mode that
                defaults to no utensils unless the customer explicitly requests
                them.
              </p>
              <ol className="list-decimal list-inside text-zinc-800 space-y-3">
                <li>
                  Log in to <strong>Uber Eats Manager</strong>.
                </li>
                <li>
                  Click on the <strong>Settings</strong> icon in the sidebar.
                </li>
                <li>
                  Select the <strong>General</strong> tab.
                </li>
                <li>
                  Find the section labeled <strong>Eco-Friendly</strong> or{" "}
                  <strong>Utensils</strong>.
                </li>
                <li>
                  Turn on the toggle to ensure utensils are only provided upon
                  request.
                </li>
              </ol>
            </div>

            <div className="border border-zinc-200 p-6 md:p-8 rounded bg-white">
              <h3 className="text-xl font-medium text-zinc-900 mb-4">
                Grubhub
              </h3>
              <p className="text-zinc-600 mb-6">
                Grubhub supports a utensil opt-in policy directly from the
                restaurant dashboard.
              </p>
              <ol className="list-decimal list-inside text-zinc-800 space-y-3">
                <li>
                  Log in to <strong>Grubhub for Restaurants</strong>.
                </li>
                <li>
                  Navigate to the <strong>Settings</strong> dropdown and select{" "}
                  <strong>Menu</strong>.
                </li>
                <li>
                  Look for the <strong>Utensils and Napkins</strong> settings.
                </li>
                <li>
                  Select the option indicating that diners must opt-in to
                  receive these items.
                </li>
                <li>Publish your changes.</li>
              </ol>
            </div>
          </div>
        </div>

        <div className="w-full">
          <h2 className="text-title-small mb-8 text-center">
            Proprietary Ordering Systems (POS)
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="border border-zinc-200 p-6 rounded bg-zinc-50">
              <h3 className="text-lg font-medium text-zinc-900 mb-3">
                Toast POS
              </h3>
              <p className="text-sm text-zinc-700 leading-relaxed mb-4">
                To create a "forced-choice" prompt on Toast, navigate to your
                menu settings and create a new Modifier Group titled "Need
                Utensils?".
              </p>
              <ul className="list-disc list-inside text-sm text-zinc-700 space-y-2">
                <li>
                  Set the Modifier Group as <strong>Required</strong>.
                </li>
                <li>
                  Add two zero-dollar options: "Yes, please" and "No, thank
                  you".
                </li>
                <li>
                  Attach this Modifier Group to your takeout and delivery menus.
                </li>
              </ul>
            </div>

            <div className="border border-zinc-200 p-6 rounded bg-zinc-50">
              <h3 className="text-lg font-medium text-zinc-900 mb-3">
                Square POS
              </h3>
              <p className="text-sm text-zinc-700 leading-relaxed mb-4">
                Similar to Toast, Square allows you to add required modifiers to
                items.
              </p>
              <ul className="list-disc list-inside text-sm text-zinc-700 space-y-2">
                <li>
                  Go to the Square Dashboard and select{" "}
                  <strong>Items & Orders</strong>.
                </li>
                <li>Create a new Modifier Set called "Utensils".</li>
                <li>Add "Yes" and "No" as options ($0.00).</li>
                <li>
                  Enable the setting to require customers to select an option
                  before adding an item to their cart.
                </li>
              </ul>
            </div>
          </div>
        </div>

        <div className="w-full border-t border-zinc-100 pt-16">
          <h2 className="text-title-small mb-6 text-center">
            Staff Operations & Training
          </h2>
          <div className="max-w-2xl mx-auto">
            <p className="text-zinc-600 mb-6 text-center">
              Updating your digital platforms is only the first step. To realize
              the cost savings and environmental benefits, your Front of House
              (FOH) staff must adapt to the new policy.
            </p>
            <div className="bg-white border border-zinc-200 rounded p-6">
              <ul className="space-y-4">
                <li className="flex items-start gap-3">
                  <span className="text-zinc-900 font-bold mt-0.5">1.</span>
                  <span className="text-zinc-700">
                    <strong>
                      Remove utensils from the bagging station default line.
                    </strong>{" "}
                    Keep them slightly out of immediate reach to prevent staff
                    from throwing them in out of habit.
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-zinc-900 font-bold mt-0.5">2.</span>
                  <span className="text-zinc-700">
                    <strong>
                      Highlight the utensil modifier on printed tickets.
                    </strong>{" "}
                    Ensure your kitchen display systems (KDS) or printed
                    receipts clearly highlight the "Yes" or "No" utensil
                    selection so staff can easily verify before sealing the bag.
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-zinc-900 font-bold mt-0.5">3.</span>
                  <span className="text-zinc-700">
                    <strong>Communicate the "Why".</strong> Explain to your team
                    that this policy saves the business money and drastically
                    reduces local plastic waste, encouraging their active
                    participation.
                  </span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default RestaurantGuidePage;
