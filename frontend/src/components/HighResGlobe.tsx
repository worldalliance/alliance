import React, { useEffect, useRef } from "react";
import Globe, { GlobeMethods } from "react-globe.gl";
import * as THREE from "three";
import cloudsImg from "../assets/fair_clouds_4k.png";

const HighResGlobe = () => {
  const globeEl = useRef<GlobeMethods | undefined>(undefined);

  useEffect(() => {
    const globe = globeEl.current;

    if (!globe) return;

    // Auto-rotate
    globe.controls().autoRotate = true;
    globe.controls().autoRotateSpeed = 0.35;

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
          new THREE.MeshPhongMaterial({ map: cloudsTexture, transparent: true })
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
      width={600}
      height={600}
      ref={globeEl}
      animateIn={false}
      globeImageUrl="//cdn.jsdelivr.net/npm/three-globe/example/img/earth-blue-marble.jpg"
      bumpImageUrl="//cdn.jsdelivr.net/npm/three-globe/example/img/earth-topology.png"
      atmosphereColor="#00000000"
      backgroundColor="rgba(0, 0, 0, 0)"
    />
  );
};

export default HighResGlobe;
