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
  locations?: Coordinate[];
}

const Globe: React.FC<GlobeProps> = ({
  spin = true,
  people = 0,
  strokeWidth = 0.5,
  colored = false,
  locations,
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

  /* helper reused in several places */
  function isVisible(d: Coordinate): boolean {
    const projection = projectionRef.current!;

    const centerLonLat = projection.invert!([0, 0])!;

    if (
      (Math.abs(d.longitude - (centerLonLat[0] + 90)) > 90 &&
        Math.abs(d.longitude - (centerLonLat[0] + 90 - 360)) > 90) ||
      Math.abs(d.latitude) > 75
    ) {
      return false;
    } else {
      return true;
    }
  }

  const updateDotPositions = () => {
    const proj = projectionRef.current!;
    peopleGroupRef.current
      ?.selectAll<SVGCircleElement, Coordinate>("circle")
      .attr("cx", (d) => proj([d.longitude, d.latitude])![0])
      .attr("cy", (d) => proj([d.longitude, d.latitude])![1])
      .attr("visibility", (d) => (isVisible(d) ? "visible" : "hidden"));
  };

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

    svg
      .append("defs")
      .append("clipPath")
      .attr("id", "globe-clip")
      .append("circle")
      .attr("cx", width / 2)
      .attr("cy", height / 2)
      .attr("r", scale);

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
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore typing mismatch
      d3.drag().on("drag", (event: d3.D3DragEvent) => {
        const r = projection.rotate();
        projection.rotate([r[0] + event.dx * k, 0]);
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
    peopleGroupRef.current = svg
      .append("g")
      .attr("class", "people-points")
      .attr("clip-path", "url(#globe-clip)");

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
  }, [colored, spin, strokeWidth]);

  /* ---------- 2) update people when prop changes ---------------------- */
  useEffect(() => {
    if (!peopleGroupRef.current || !projectionRef.current) return;

    const coords: Coordinate[] = locations
      ? locations
      : Array.from({ length: people }, () => ({
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
      .attr("r", 4)
      .attr("fill", "#349cf7")
      .merge(dots)
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
