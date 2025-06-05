import { useEffect, useRef } from "react";
import Globe, { GlobeMethods, GlobeProps } from "react-globe.gl";
import * as THREE from "three";
import cloudsImg from "../assets/fair_clouds_4k.webp";
import earthImg from "../assets/earth-blue-marble.webp";

export interface HighResGlobeProps
  extends Pick<GlobeProps, "width" | "height"> {
  atmosphereColor?: string;
}

export default function HighResGlobeClient({
  atmosphereColor = "#6f8494",
}: HighResGlobeProps) {
  const globeEl = useRef<GlobeMethods | undefined>(undefined);

  const size = 2 * Math.min(window.innerWidth, window.innerHeight);
  const width = size;
  const height = size;

  useEffect(() => {
    const globe = globeEl.current;

    if (!globe) return;

    // Auto-rotate
    globe.controls().autoRotate = true;
    globe.controls().autoRotateSpeed = 0.35;
    globe.controls().enableZoom = false;
    globe.controls().enablePan = false;
    globe.controls().enableRotate = false;

    // Add clouds sphere
    const CLOUDS_IMG_URL = cloudsImg; // from https://github.com/turban/webgl-earth
    const CLOUDS_ALT = 0.004;
    const CLOUDS_ROTATION_SPEED = -0.006; // deg/frame

    new THREE.TextureLoader().load(
      CLOUDS_IMG_URL,
      (cloudsTexture: THREE.Texture) => {
        const clouds = new THREE.Mesh(
          new THREE.SphereGeometry(
            globe.getGlobeRadius() * (1 + CLOUDS_ALT),
            75,
            75
          ),
          new THREE.MeshBasicMaterial({
            map: cloudsTexture,
            transparent: true,
          })
        );
        globe.scene().add(clouds);

        (function rotateClouds() {
          clouds.rotation.y += (CLOUDS_ROTATION_SPEED * Math.PI) / 180;
          requestAnimationFrame(rotateClouds);
        })();
      }
    );
  }, []);

  return (
    <Globe
      ref={globeEl}
      width={width}
      height={height}
      animateIn={false}
      globeImageUrl={earthImg}
      atmosphereColor={atmosphereColor}
      backgroundColor="rgba(0,0,0,0)"
    />
  );
}
