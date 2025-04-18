import React, { useEffect, useRef } from "react";
import * as d3 from "d3";
import { world } from "./world";

interface Coordinate {
  longitude: number;
  latitude: number;
}

const Globe: React.FC = () => {
  const mapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!mapRef.current) return;

    const generateGlobe = async () => {
      if (!mapRef.current) return;

      let worldData = world;

      const width = mapRef.current.getBoundingClientRect().width;
      const scale = 200;
      const height = scale * 2 + 10;
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

      let globe = svg
        .append("circle")
        .attr("fill", "#fff")
        .attr("stroke", "#000")
        .attr("stroke-width", "0.5")
        .attr("cx", width / 2)
        .attr("cy", height / 2)
        .attr("r", initialScale);

      // Add drag and zoom behaviors
      svg.call(
        // @ts-ignore - d3 typing issue with drag
        d3.drag().on("drag", (event) => {
          const rotate = projection.rotate();
          const k = sensitivity / projection.scale();
          //   projection.rotate([
          //     rotate[0] + event.dx * k,
          //     rotate[1] - event.dy * k,
          //   ]);
          path = d3.geoPath().projection(projection);
          svg.selectAll("path").attr("d", path as any);
        })
      );

      svg.call(
        // @ts-ignore - d3 typing issue with zoom
        d3.zoom().on("zoom", () => {
          // Zoom functionality is commented out in the original
        })
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
        .attr("fill", "#fff")
        .style("stroke", "black")
        .style("stroke-width", 0.5)
        .style("opacity", 1);

      // Sample coordinates for points (empty in the original)
      const coordinates: Coordinate[] = [];

      // Auto-rotation
      d3.timer(function (elapsed) {
        const rotate = projection.rotate();
        const k = sensitivity / projection.scale();
        projection.rotate([rotate[0] - 1 * k, rotate[1]]);
        path = d3.geoPath().projection(projection);
        svg.selectAll("path").attr("d", path as any);

        // Update point positions
        svg
          .selectAll("circle.point")
          .attr("cx", (d: any) => {
            if (d) {
              return projection([d.longitude, d.latitude])![0] ?? width / 2;
            } else {
              return width / 2;
            }
          })
          .attr("cy", (d: any) => {
            if (d) {
              return projection([d.longitude, d.latitude])![1] ?? height / 2;
            } else {
              return height / 2;
            }
          });
      }, 200);

      // Plot points on the globe
      svg
        .append("g")
        .attr("class", "points")
        .selectAll("circle")
        .data(coordinates)
        .enter()
        .append("circle")
        .attr("class", "point")
        .attr("cx", (d) => projection([d.longitude, d.latitude])![0])
        .attr("cy", (d) => projection([d.longitude, d.latitude])![1])
        .attr("idx", (d, i) => i)
        .attr("r", 3)
        .attr("fill", "red");
    };

    generateGlobe();
  }, []);

  return <div id="map" ref={mapRef} className="w-[450px] py-[30px]"></div>;
};

export default Globe;
