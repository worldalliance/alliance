import React, { useMemo, useState } from "react";
import Footer from "../../../components/Footer";
import PrelaunchNavbar from "../../../components/PrelaunchNavbar";

type Restaurant = {
  name: string;
  url: string;
  img: string;
};

const UtensilWastePage: React.FC = () => {
  const restaurants: Restaurant[] = [
    {
      name: "Katsuo + Kombu",
      url: "https://www.instagram.com/katsuo_and_kombu/",
      img: "https://d2s742iet3d3t1.cloudfront.net/restaurants/restaurant-151140000000000000/restaurant_1684962456.png"
    }
  ];

  const [searchQuery, setSearchQuery] = useState("");

  const filteredRestaurants = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();
    if (!query) return restaurants;
    return restaurants.filter((r) => r.name.toLowerCase().includes(query));
  }, [restaurants, searchQuery]);

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <PrelaunchNavbar transparent={false} absolute={false} />
      <div className="flex-1 max-w-6xl mx-auto pt-12 md:pt-28 pb-56 px-5 flex flex-col gap-y-16 md:gap-y-24">
        <div className="text-center">
          <h1 className="text-title mb-2">
            Utensil Waste Reduction Initiative
          </h1>
          <h2 className="text-zinc-500 text-base md:text-lg max-w-3xl mx-auto mb-6">
            March 2026
          </h2>

          <div className="text-zinc-900 text-base md:text-lg max-w-3xl mx-auto space-y-8">
            <p>
              Many takeout orders include single-use plastic utensils by
              default, even when they aren&apos;t wanted. Alliance members are
              asking local restaurants to implement{" "}
              <strong>opt-in utensil policies</strong> to reduce plastic waste.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-left py-10">
              <div className="border border-green rounded-xl p-6 md:p-8 bg-white shadow-sm">
                <h3 className="font-bold text-green mb-3 uppercase tracking-wider text-sm">
                  Environmental Impact
                </h3>
                <p className="text-zinc-600 leading-relaxed text-base">
                  A standard utensil kit weighs roughly 10 grams. If 100
                  restaurants adopt an opt-in policy, we could reduce roughly{" "}
                  <strong className="text-zinc-900">
                    16,000 lbs (7,300 kg)
                  </strong>{" "}
                  of plastic waste annually.
                </p>
              </div>
              <div className="border border-green rounded-xl p-6 md:p-8 bg-white shadow-sm">
                <h3 className="font-bold text-green mb-3 uppercase tracking-wider text-sm">
                  Cost Savings
                </h3>
                <p className="text-zinc-600 leading-relaxed text-base">
                  Utensil kits cost between 5 and 10 cents each. By reducing
                  unnecessary distribution, an average restaurant could save{" "}
                  <strong className="text-zinc-900">
                    $350 to $750 annually
                  </strong>
                  {""}.
                </p>
              </div>
            </div>

            <div className="text-zinc-500 text-sm max-w-2xl mx-auto space-y-2">
              <p>
                The <strong>European Union</strong> has already implemented
                strict bans on single-use plastic cutlery.{" "}
                <strong>California</strong> recently enacted legislation (AB
                1276) requiring that single-use foodware only be provided upon
                request.
              </p>
            </div>
          </div>
        </div>

        <div className="w-full">
          <h2 className="text-title-small mb-4 text-center">
            Participating Restaurants
          </h2>
          <p className="text-zinc-500 text-base mb-10 text-center max-w-2xl mx-auto">
            The following establishments have committed to reducing plastic
            waste through opt-in policies.
          </p>

          <div className="mb-12 max-w-4xl mx-auto">
            <input
              type="text"
              placeholder="Search participating restaurants..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full max-w-full min-w-0 overflow-hidden text-ellipsis border bg-white border-zinc-200 py-2 px-3 rounded text-base focus:outline-none focus:border-zinc-400 transition-colors box-border"
            />
          </div>

          {filteredRestaurants.length <= 0 && searchQuery.trim() === "" && (
            <p className="text-zinc-500 text-center py-12 border-2 border-dashed border-zinc-200 rounded">
              Pending restaurant responses
            </p>
          )}

          {filteredRestaurants.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 -mx-2 md:-mx-12">
              {filteredRestaurants.map((restaurant) => (
                <a
                  key={restaurant.name}
                  href={restaurant.url}
                  target="_blank"
                  rel="noreferrer"
                  className="border border-zinc-200 p-2 md:p-4 rounded bg-white flex flex-col sm:flex-row sm:items-start gap-4 sm:gap-6 hover:bg-zinc-50"
                >
                  <div className="flex flex-row items-center gap-4 sm:flex-shrink-0 w-full">
                    <img src={restaurant.img} alt={restaurant.name} className="w-16 h-16 rounded-md object-cover shrink-0" />

                    <h3 className="flex-1 text-lg font-medium text-zinc-900">
                      {restaurant.name}
                    </h3>
                  </div>
                </a>
              ))}
            </div>
          ) : searchQuery.trim() !== "" ? (
            <p className="text-zinc-500 text-center py-12 border-2 border-dashed border-zinc-200 rounded">
              No restaurants found matching "{searchQuery}"
            </p>
          ) : null}
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default UtensilWastePage;
