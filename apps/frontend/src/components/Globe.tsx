import React, { useEffect, useRef } from "react";
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

  /* --- persistent d3 handles ------------------------------------------- */
  const svgRef =
    useRef<d3.Selection<SVGSVGElement, unknown, null, undefined>>(null);
  const projectionRef = useRef<d3.GeoProjection>(null);
  const pathRef = useRef<d3.GeoPath<any, d3.GeoPermissibleObjects>>(null);
  const peopleGroupRef =
    useRef<d3.Selection<SVGGElement, unknown, null, undefined>>(null);
  const rotateTimerRef = useRef<d3.Timer>(null);

  /* ---------- 1) build globe ONCE -------------------------------------- */
  useEffect(() => {
    if (!mapRef.current) return;

    const width = mapRef.current.getBoundingClientRect().width;
    const scale = Math.max(width / 2 - 0.1, 0);
    const height = scale * 2 + 5;
    const sensitivity = 75;

    // GEO STUFF
    const projection = d3
      .geoOrthographic()
      .scale(scale)
      .center([0, 0])
      .rotate([270, 0]) // keep your preferred initial orientation
      .translate([width / 2, height / 2]);

    projectionRef.current = projection;
    pathRef.current = d3.geoPath().projection(projection);

    // ROOT SVG
    const svg = d3
      .select(mapRef.current)
      .append("svg")
      .attr("width", width)
      .attr("height", height);

    svgRef.current = svg;

    /* --- base globe ---------------------------------------------------- */
    svg
      .append("circle")
      .attr("fill", "#fff")
      .attr("stroke", "#000")
      .attr("stroke-width", strokeWidth)
      .attr("cx", width / 2)
      .attr("cy", height / 2)
      .attr("r", scale);

    const mapG = svg.append("g");

    mapG
      .selectAll("path")
      .data(world.features)
      .enter()
      .append("path")
      .attr("d", pathRef.current as any)
      .attr("fill", colored ? "#c0e3aa" : "#fff")
      .attr("stroke", "#000")
      .attr("stroke-width", strokeWidth);

    /* --- drag behaviour ----------------------------------------------- */
    const k = sensitivity / projection.scale();
    svg.call(
      // @ts-ignore typing mismatch
      d3.drag().on("drag", (event: d3.D3DragEvent) => {
        const r = projection.rotate();
        projection.rotate([r[0] + event.dx * k, r[1] - event.dy * k]);
        mapG.selectAll("path").attr("d", pathRef.current as any);
        updateDotPositions(); // keeps dots glued to the surface
      })
    );

    /* --- zoom filter (optional – disabled wheel) ---------------------- */
    svg.call(
      // @ts-ignore
      d3
        .zoom()
        .filter((e) => !e.ctrlKey && !e.button && !e.type.includes("wheel"))
        .on("zoom", null)
    );

    /* --- group that will hold the dynamic dots ------------------------ */
    peopleGroupRef.current = svg.append("g").attr("class", "people-points");

    /* --- spin --------------------------------------------------------- */
    if (spin) {
      rotateTimerRef.current = d3.timer(() => {
        const r = projection.rotate();
        projection.rotate([r[0] - sensitivity / projection.scale() / 6, r[1]]);
        mapG.selectAll("path").attr("d", pathRef.current as any);
        updateDotPositions();
      }, 200);
    }

    /* --- cleanup on unmount ------------------------------------------ */
    return () => {
      rotateTimerRef.current?.stop();
      svg.remove();
    };
  }, []); //  <-- empty deps: run once

  /* helper reused in several places */
  const isVisible = (c: Coordinate) => {
    const proj = projectionRef.current!;
    const [x, y] = proj([c.longitude, c.latitude])!;
    const center = proj.translate();
    const dx = x - center[0];
    const dy = y - center[1];
    const distance = Math.sqrt(dx * dx + dy * dy);
    return distance <= proj.scale() + 2; // simple back-face culling
  };

  const updateDotPositions = () => {
    const proj = projectionRef.current!;
    peopleGroupRef.current
      ?.selectAll<SVGCircleElement, Coordinate>("circle")
      .attr("cx", (d) => proj([d.longitude, d.latitude])![0])
      .attr("cy", (d) => proj([d.longitude, d.latitude])![1])
      .attr("visibility", (d) => (isVisible(d) ? "visible" : "hidden"));
  };

  /* ---------- 2) update people when prop changes ---------------------- */
  useEffect(() => {
    if (!peopleGroupRef.current || !projectionRef.current) return;

    // dummy coordinate generator (keep your own logic / geoContains etc.)
    const coords: Coordinate[] = Array.from({ length: people }, () => ({
      longitude: Math.random() * 360 - 180,
      latitude: Math.random() * 180 - 90,
    }));

    const dots = peopleGroupRef.current
      .selectAll<SVGCircleElement, Coordinate>("circle")
      .data(coords, (_, i) => i.toString()); // stable key

    // ENTER
    dots
      .enter()
      .append("circle")
      .attr("r", 2)
      .attr("fill", "#349cf7")
      .merge(dots as any) // ENTER + UPDATE
      .each(function (d) {
        // position immediately
        const [cx, cy] = projectionRef.current!([d.longitude, d.latitude])!;
        d3.select(this).attr("cx", cx).attr("cy", cy);
      });

    // EXIT
    dots.exit().remove();
  }, [people]);

  return (
    <div ref={mapRef} className="w-full aspect-square select-none touch-none" />
  );
};

export default Globe;
