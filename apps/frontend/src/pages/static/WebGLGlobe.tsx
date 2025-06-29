import React, { useEffect, useRef } from "react";

/**
 * <SphereWebGL /> – renders an Earth sphere with a slower‑moving cloud overlay.
 * Fixes common WebGL warnings:
 *   • guarded async texture uploads so they never touch a torn‑down GL context
 *   • re‑binds the UV buffer every draw, eliminating “vertex buffer is not big enough”
 *   • avoids use‑after‑delete by tracking a `disposed` flag
 */
export interface SphereWebGLProps {
  baseSrc: string;
  overlaySrc: string;
  width?: number;
  height?: number;
  /** radians / ms, default 0.00030 ≈ 1 rev per ~35 s */
  baseSpeed?: number;
  /** radians / ms, default 0.00018 (clouds drift ~2× slower) */
  overlaySpeed?: number;
  pixelRatio?: number;
}

export default function SphereWebGL({
  baseSrc,
  overlaySrc,
  width = 600,
  height = 600,
  baseSpeed = 0.0003,
  overlaySpeed = 0.00018,
  pixelRatio = 1,
}: SphereWebGLProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);

  /* --------------------------- Matrix helpers --------------------------- */
  const identity = (out: Float32Array) => {
    out[0] = 1;
    out[1] = 0;
    out[2] = 0;
    out[3] = 0;
    out[4] = 0;
    out[5] = 1;
    out[6] = 0;
    out[7] = 0;
    out[8] = 0;
    out[9] = 0;
    out[10] = 1;
    out[11] = 0;
    out[12] = 0;
    out[13] = 0;
    out[14] = 0;
    out[15] = 1;
    return out;
  };

  const setRotateYScale = (out: Float32Array, rad: number, scale: number) => {
    const s = Math.sin(rad);
    const c = Math.cos(rad);
    identity(out);
    out[0] = c * scale; // scale X
    out[2] = s * scale;
    out[8] = -s * scale;
    out[10] = c * scale; // scale Z
    return out;
  };

  const perspective = (
    out: Float32Array,
    fovy: number,
    aspect: number,
    near: number,
    far: number
  ) => {
    const f = 1.0 / Math.tan(fovy / 2);
    identity(out);
    out[0] = f / aspect;
    out[5] = f;
    out[10] = (far + near) / (near - far);
    out[11] = -1;
    out[14] = (2 * far * near) / (near - far);
    out[15] = 0;
    return out;
  };

  /* -------------------------------- Effect -------------------------------- */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = canvas.getContext("webgl", { alpha: true });
    if (!gl) {
      console.error("WebGL not supported");
      return;
    }

    let disposed = false; // 🆕 prevents use‑after‑delete

    /* ------------------------------ Shaders ------------------------------ */
    const vsSource = `
      attribute vec3 aPosition;
      attribute vec2 aUV;
      uniform mat4 uProj;
      uniform mat4 uModelView;
      varying vec2 vUV;
      void main() {
        vUV = aUV;
        gl_Position = uProj * uModelView * vec4(aPosition, 1.0);
      }
    `;
    const fsSource = `
      precision mediump float;
      varying vec2 vUV;
      uniform sampler2D uTexture;
      void main() {
        gl_FragColor = texture2D(uTexture, vUV) * 1.1;
        gl_FragColor.a = 1.1 * gl_FragColor.a;
      }
    `;
    const compile = (type: number, src: string) => {
      const sh = gl.createShader(type)!;
      gl.shaderSource(sh, src);
      gl.compileShader(sh);
      if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
        throw new Error(gl.getShaderInfoLog(sh) || "Shader compile error");
      }
      return sh;
    };
    const vs = compile(gl.VERTEX_SHADER, vsSource);
    const fs = compile(gl.FRAGMENT_SHADER, fsSource);
    const program = gl.createProgram()!;
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      throw new Error(gl.getProgramInfoLog(program) || "Program link error");
    }
    gl.useProgram(program);

    /* ----------------------------- Geometry ----------------------------- */
    const createSphereBuffers = (radius: number) => {
      const latBands = 48;
      const lonBands = 48;
      const positions: number[] = [];
      const uvs: number[] = [];
      const indices: number[] = [];
      for (let lat = 0; lat <= latBands; lat++) {
        const theta = (lat * Math.PI) / latBands;
        const sinT = Math.sin(theta);
        const cosT = Math.cos(theta);
        for (let lon = 0; lon <= lonBands; lon++) {
          const phi = (lon * 2 * Math.PI) / lonBands;
          const sinP = Math.sin(phi);
          const cosP = Math.cos(phi);
          positions.push(
            radius * cosP * sinT,
            radius * cosT,
            radius * sinP * sinT
          );
          uvs.push(1 - lon / lonBands, 1 - lat / latBands);
        }
      }
      for (let lat = 0; lat < latBands; lat++) {
        for (let lon = 0; lon < lonBands; lon++) {
          const first = lat * (lonBands + 1) + lon;
          const second = first + lonBands + 1;
          indices.push(first, second, first + 1, second, second + 1, first + 1);
        }
      }
      const posBuf = gl.createBuffer()!;
      gl.bindBuffer(gl.ARRAY_BUFFER, posBuf);
      gl.bufferData(
        gl.ARRAY_BUFFER,
        new Float32Array(positions),
        gl.STATIC_DRAW
      );
      return {
        posBuf,
        indices: new Uint16Array(indices),
        uvs: new Float32Array(uvs),
      };
    };

    const sphereBase = createSphereBuffers(1.0);
    const sphereOverlay = createSphereBuffers(1.0005); // Clouds sit slightly above

    const uvBuf = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, uvBuf);
    gl.bufferData(gl.ARRAY_BUFFER, sphereBase.uvs, gl.STATIC_DRAW); // UVs shared

    const idxBuf = gl.createBuffer()!;
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, idxBuf);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, sphereBase.indices, gl.STATIC_DRAW);

    const aPos = gl.getAttribLocation(program, "aPosition");
    const aUV = gl.getAttribLocation(program, "aUV");
    const uProj = gl.getUniformLocation(program, "uProj");
    const uModelView = gl.getUniformLocation(program, "uModelView");
    const uTexture = gl.getUniformLocation(program, "uTexture");

    // UV attribute set once (rebinding happens in the draw loop 👇)
    gl.vertexAttribPointer(aUV, 2, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(aUV);

    /* ------------------------------ Textures ------------------------------ */
    const texBase = gl.createTexture()!;
    const texOverlay = gl.createTexture()!;

    const loadTexture = (tex: WebGLTexture, url: string): Promise<void> =>
      new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.src = url;
        img.onload = () => {
          if (disposed) return; // 🚫 effect torn down
          gl.bindTexture(gl.TEXTURE_2D, tex);
          gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
          gl.texImage2D(
            gl.TEXTURE_2D,
            0,
            gl.RGBA,
            gl.RGBA,
            gl.UNSIGNED_BYTE,
            img
          );
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
          const ext = gl.getExtension("EXT_texture_filter_anisotropic");
          if (ext) {
            const max = gl.getParameter(
              ext.MAX_TEXTURE_MAX_ANISOTROPY_EXT
            ) as number;
            gl.texParameterf(
              gl.TEXTURE_2D,
              ext.TEXTURE_MAX_ANISOTROPY_EXT,
              max
            );
          }
          gl.texParameteri(
            gl.TEXTURE_2D,
            gl.TEXTURE_MIN_FILTER,
            gl.LINEAR_MIPMAP_LINEAR
          );
          gl.generateMipmap(gl.TEXTURE_2D);
          resolve();
        };
      });

    Promise.all([
      loadTexture(texBase, baseSrc),
      loadTexture(texOverlay, overlaySrc),
    ]).then(() => {
      if (!disposed) start(); // Only animate if component still mounted
    });

    /* ------------------------------ Matrices ------------------------------ */
    const projMat = perspective(
      new Float32Array(16),
      Math.PI / 3,
      width / height,
      0.1,
      100
    );

    /* ------------------------------ Render ------------------------------ */
    gl.enable(gl.DEPTH_TEST);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    const start = () => {
      const tick = (t: number) => {
        if (disposed) return;

        gl.viewport(0, 0, width * pixelRatio, height * pixelRatio);
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

        // Common state
        gl.uniformMatrix4fv(uProj, false, projMat);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, idxBuf);

        /* ---- Base ---- */
        gl.bindBuffer(gl.ARRAY_BUFFER, sphereBase.posBuf);
        gl.vertexAttribPointer(aPos, 3, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(aPos);

        // Re‑bind UV buffer each draw (fixes vertex‑buffer size warning)
        gl.bindBuffer(gl.ARRAY_BUFFER, uvBuf);
        gl.vertexAttribPointer(aUV, 2, gl.FLOAT, false, 0, 0);

        const mvBase = setRotateYScale(
          new Float32Array(16),
          t * baseSpeed,
          1.0
        );
        mvBase[14] = -3; // translate back
        gl.uniformMatrix4fv(uModelView, false, mvBase);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, texBase);
        gl.uniform1i(uTexture, 0);
        gl.drawElements(
          gl.TRIANGLES,
          sphereBase.indices.length,
          gl.UNSIGNED_SHORT,
          0
        );

        /* ---- Overlay ---- */
        gl.bindBuffer(gl.ARRAY_BUFFER, sphereOverlay.posBuf);
        gl.vertexAttribPointer(aPos, 3, gl.FLOAT, false, 0, 0);

        gl.bindBuffer(gl.ARRAY_BUFFER, uvBuf);
        gl.vertexAttribPointer(aUV, 2, gl.FLOAT, false, 0, 0);

        const mvOverlay = setRotateYScale(
          new Float32Array(16),
          t * overlaySpeed,
          1.02
        );
        mvOverlay[14] = -3;
        gl.uniformMatrix4fv(uModelView, false, mvOverlay);
        gl.bindTexture(gl.TEXTURE_2D, texOverlay);
        gl.drawElements(
          gl.TRIANGLES,
          sphereOverlay.indices.length,
          gl.UNSIGNED_SHORT,
          0
        );

        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
    };

    /* ------------------------------ Cleanup ------------------------------ */
    return () => {
      disposed = true;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      [texBase, texOverlay].forEach((t) => gl.deleteTexture(t));
      [sphereBase.posBuf, sphereOverlay.posBuf, uvBuf, idxBuf].forEach((b) =>
        gl.deleteBuffer(b)
      );
      gl.deleteProgram(program);
      gl.deleteShader(vs);
      gl.deleteShader(fs);
    };
  }, [baseSrc, overlaySrc, width, height, baseSpeed, overlaySpeed, pixelRatio]);

  return (
    <canvas
      ref={canvasRef}
      width={width * pixelRatio}
      height={height * pixelRatio}
      style={{ width: `${width}px`, height: `${height}px` }}
      className="rounded-2xl shadow-lg"
    />
  );
}
