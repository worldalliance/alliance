import React, { useMemo, useState } from "react";
import Footer from "../../../components/Footer";
import PrelaunchNavbar from "../../../components/PrelaunchNavbar";

const UtensilWastePage: React.FC = () => {
  const restaurants = useMemo(() => {
    return Array.from({ length: 10 }).map((_, i) => ({
      id: i,
      name: `Restaurant ${i + 1}`,
      url: "https://example.com",
      quote: "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.",
    }));
  }, []);

  const [searchQuery, setSearchQuery] = useState("");

  const filteredRestaurants = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();
    return restaurants.filter((r) =>
      r.name.toLowerCase().includes(query)
    );
  }, [restaurants, searchQuery]);

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <PrelaunchNavbar transparent={false} absolute={false} />
      <div className="flex-1 max-w-6xl mx-auto pt-12 md:pt-28 pb-56 px-5 flex flex-col gap-y-16 md:gap-y-24">
        
        <div className="text-center">
          <h1 className="text-title mb-6">Utensil Waste Reduction Initiative</h1>
          <div className="text-zinc-900 text-base md:text-lg max-w-3xl mx-auto space-y-8">
            <p>
              Most takeout orders include single-use plastic utensils by default, even when they aren't requested or needed. 
              The Alliance works with local businesses to implement <strong>opt-in utensil policies</strong>, ensuring 
              plastics are only provided upon request.
            </p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-left border-y border-zinc-100 py-10">
              <div>
                <h3 className="font-medium text-zinc-900 mb-2 uppercase tracking-wide text-sm">Environmental Impact</h3>
                <p className="text-zinc-600 leading-relaxed">
                  A standard utensil kit weighs roughly 10 grams. If 100 restaurants adopt an opt-in policy, we can prevent roughly <strong>16,000 lbs (7,300 kg)</strong> of plastic waste from entering landfills every year.
                </p>
              </div>
              <div>
                <h3 className="font-medium text-zinc-900 mb-2 uppercase tracking-wide text-sm">Economic Efficiency</h3>
                <p className="text-zinc-600 leading-relaxed">
                  Utensil kits cost between 5 and 10 cents each. By reducing unnecessary distribution, an average restaurant can save <strong>$350 to $750 annually</strong> in overhead costs.
                </p>
              </div>
            </div>

            <p className="text-zinc-500 text-sm max-w-2xl mx-auto">
              This shift aligns with global movements, including the 2021 EU ban on single-use cutlery and legislation 
              in California requiring opt-in models for food accessories.
            </p>
          </div>
        </div>

        <div className="w-full">
          <h2 className="text-title-small mb-4 text-center">Participating Restaurants</h2>
          <p className="text-zinc-500 text-base mb-10 text-center max-w-2xl mx-auto">
            The following establishments have committed to reducing plastic waste through opt-in policies.
          </p>
          
          <div className="mb-12 max-w-4xl mx-auto">
            <input
              type="text"
              placeholder="Search participating restaurants..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full border bg-white border-zinc-200 py-2 px-3 rounded text-base focus:outline-none focus:border-zinc-400 transition-colors"
            />
          </div>

          {filteredRestaurants.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 -mx-2 md:-mx-12">
              {filteredRestaurants.map((restaurant) => (
                <div 
                  key={restaurant.id} 
                  className="border border-zinc-200 p-5 md:p-6 rounded bg-white flex flex-col sm:flex-row sm:items-start gap-4 sm:gap-6"
                >
                  <div className="flex flex-row items-center gap-4 sm:flex-shrink-0 sm:w-40 sm:pt-1">
                    <div className="flex-1 min-w-0">
                      <h3 className="text-lg font-medium text-zinc-900 truncate">
                        {restaurant.name}
                      </h3>
                      <a 
                        href={restaurant.url} 
                        target="_blank" 
                        rel="noreferrer"
                        className="text-sm text-zinc-500 hover:text-zinc-800 transition-colors block truncate"
                      >
                        {restaurant.url.replace("https://", "").replace("www.", "")}
                      </a>
                    </div>
                    <div className="w-12 h-12 bg-zinc-50 border border-zinc-100 rounded flex-shrink-0 sm:hidden" />
                  </div>
                  
                  <div className="flex-1 min-w-0 sm:border-l sm:border-zinc-100 sm:pl-6">
                    <p className="text-xs text-zinc-500 italic leading-relaxed">
                      "{restaurant.quote}"
                    </p>
                  </div>

                  <div className="w-14 h-14 bg-zinc-50 border border-zinc-100 rounded flex-shrink-0 hidden sm:block" />
                </div>
              ))}
            </div>
          ) : (
            <p className="text-zinc-500 text-center py-12 border border-dashed border-zinc-200 rounded">
              No restaurants found matching "{searchQuery}"
            </p>
          )}
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default UtensilWastePage;