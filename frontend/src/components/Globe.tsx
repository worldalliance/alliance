import React, { useCallback, useEffect, useRef } from "react";
import * as d3 from "d3";
import world from "./world";

interface Coordinate {
  longitude: number;
  latitude: number;
}

interface GlobeProps {
  spin?: boolean;
  people?: number;
  strokeWidth?: number;
  colored?: boolean;
}

const Globe: React.FC<GlobeProps> = ({
  spin = true,
  people = 0,
  strokeWidth = 0.5,
  colored = false,
}) => {
  const mapRef = useRef<HTMLDivElement>(null);

  const generateGlobe = useCallback(async () => {
    if (!mapRef.current) return;

    let worldData = world;

    const width = mapRef.current.getBoundingClientRect().width;
    const scale = width / 2 - 0.1;
    const height = scale * 2 + 5;
    const sensitivity = 75;

    let projection = d3
      .geoOrthographic()
      .scale(scale)
      .center([0, 0])
      .rotate([0, -5])
      .translate([width / 2, height / 2]);

    const initialScale = projection.scale();
    let path = d3.geoPath().projection(projection);

    // Clear any existing SVG
    d3.select(mapRef.current).selectAll("svg").remove();

    let svg = d3
      .select(mapRef.current)
      .append("svg")
      .attr("width", width)
      .attr("height", height);

    svg
      .append("circle")
      .attr("fill", "#fff")
      .attr("stroke", "#000")
      .attr("stroke-width", strokeWidth)
      .attr("cx", width / 2)
      .attr("cy", height / 2)
      .attr("r", initialScale);

    const k = sensitivity / projection.scale();
    // Add drag and zoom behaviors
    svg.call(
      // @ts-ignore - d3 typing issue with drag
      d3.drag().on("drag", (event: d3.D3DragEvent) => {
        const rotate = projection.rotate();
        projection.rotate([rotate[0] + event.dx * k, rotate[1] - event.dy * k]);
        // updateElementsVisibility();
      })
    );

    svg.call(
      // @ts-ignore - d3 typing issue with zoom
      d3
        .zoom()
        .filter((event) => {
          // Only allow zoom on ctrl+scroll, or other interactions
          return (
            !event.ctrlKey && !event.button && !event.type.includes("wheel")
          );
        })
        .on("zoom", null)
    );

    let map = svg.append("g");

    // Draw countries
    map
      .append("g")
      .attr("class", "countries")
      .selectAll("path")
      .data(worldData.features)
      .enter()
      .append("path")
      .attr(
        "class",
        (d: any) => "country_" + d.properties.name.replace(" ", "_")
      )
      .attr("d", path as any)
      .attr("fill", colored ? "#c0e3aa" : "#fff")
      .style("stroke", "black")
      .style("stroke-width", strokeWidth)
      .style("opacity", 1);

    // // Generate random coordinates for people dots within countries
    // const coordinates: Coordinate[] = [];

    // if (people > 0) {
    //   // Calculate the total area of all countries to distribute dots proportionally
    //   const countriesArea = worldData.features.reduce(
    //     (acc: number, feature: any) => {
    //       const area = feature.geometry ? d3.geoArea(feature.geometry) : 0;
    //       return acc + area;
    //     },
    //     0
    //   );

    //   for (let i = 0; i < 100; i++) {
    //     coordinates.push({
    //       longitude: Math.random() * 360 - 180,
    //       latitude: Math.random() * 100 - 50,
    //     });
    //   }

    //   worldData.features.forEach((feature: any) => {
    //     if (!feature.geometry) return;
    //     if (feature.properties.name !== "USA") return;

    //     const area = d3.geoArea(feature.geometry);
    //     const countryPeopleCount = 100;

    //     // Generate points within the country bounds
    //     for (let i = 0; i < countryPeopleCount; i++) {
    //       // Use a bounding box approach to find points within the country
    //       const bounds = path.bounds(feature);
    //       const x =
    //         bounds[0][0] + Math.random() * (bounds[1][0] - bounds[0][0]);
    //       const y =
    //         bounds[0][1] + Math.random() * (bounds[1][1] - bounds[0][1]);

    //       const lonlat = [x, y] as [number, number];
    //       if (lonlat && d3.geoContains(feature, lonlat)) {
    //         coordinates.push({
    //           longitude: lonlat[0],
    //           latitude: lonlat[1],
    //         });
    //       }
    //     }
    //   });
    // }

    // // Create a group for people dots
    // const peopleGroup = svg.append("g").attr("class", "people-points");

    // // Plot people dots on the globe
    // const dots = peopleGroup
    //   .selectAll("circle")
    //   .data(coordinates)
    //   .enter()
    //   .append("circle")
    //   .attr("class", "person-point")
    //   .attr("cx", (d) => projection([d.longitude, d.latitude])![0])
    //   .attr("cy", (d) => projection([d.longitude, d.latitude])![1])
    //   .attr("r", 2)
    //   .attr("fill", "#349cf7")
    //   .attr("opacity", "1");

    // function isVisible(d: Coordinate): boolean {
    //   const [x, y] = projection([d.longitude, d.latitude])!;
    //   const center = projection.translate();

    //   // Calculate distance from the center
    //   const dx = x - center[0];
    //   const dy = y - center[1];
    //   const distance = Math.sqrt(dx * dx + dy * dy);

    //   const centerLonLat = projection.invert!([0, 0])!;
    //   //   console.log(centerLonLat);
    //   //   console.log(d);

    //   if (
    //     (Math.abs(d.longitude - (centerLonLat[0] + 90)) > 88 &&
    //       Math.abs(d.longitude - (centerLonLat[0] + 90 - 360)) > 88) ||
    //     Math.abs(d.latitude) > 75
    //   ) {
    //     return false;
    //   } else {
    //     return true;
    //   }
    // }

    // // Function to update visibility of points based on globe rotation
    // function updateElementsVisibility() {
    //   peopleGroup
    //     .selectAll("circle")
    //     .attr("visibility", (d: any) => (isVisible(d) ? "visible" : "hidden"));
    // }

    // Auto-rotation
    if (spin) {
      d3.timer(function (elapsed) {
        const rotate = projection.rotate();
        const k = -sensitivity / projection.scale() / 6;
        projection.rotate([rotate[0] - 1 * k, rotate[1]]);
        path = d3.geoPath().projection(projection);
        svg.selectAll("path").attr("d", path as any);

        // Update positions and visibility of people dots
        // dots
        //   .attr("cx", (d) => projection([d.longitude, d.latitude])?.[0] ?? 0)
        //   .attr("cy", (d) => projection([d.longitude, d.latitude])?.[1] ?? 0);

        // updateElementsVisibility();
      }, 200);
    }

    projection.rotate([270, 0]);
    path = d3.geoPath().projection(projection);
    svg.selectAll("path").attr("d", path as any);
    // updateElementsVisibility();
  }, [people]);

  useEffect(() => {
    generateGlobe();
  }, [generateGlobe]);

  return <div id="map" ref={mapRef} className="w-[100%] aspect-square"></div>;
};

export default Globe;
