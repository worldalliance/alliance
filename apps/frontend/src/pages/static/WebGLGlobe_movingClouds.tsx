import { useCallback, useEffect, useRef } from "react";

/**
 * <SphereWebGL /> – renders an Earth sphere with a slower‑moving cloud overlay.
 */
export interface SphereWebGLProps {
  baseSrc: string;
  overlaySrc: string;
  width?: number;
  height?: number;
  baseSpeed?: number;
  overlaySpeed?: number;
  noiseScale?: number;
  pixelRatio?: number;
}

export default function SphereWebGL({
  baseSrc,
  overlaySrc,
  width = 600,
  height = 600,
  baseSpeed = 0.0003,
  overlaySpeed = 0.00025,
  noiseScale = 5,
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

  const setRotateYScale = useCallback(
    (out: Float32Array, rad: number, scale: number) => {
      const s = Math.sin(rad);
      const c = Math.cos(rad);
      identity(out);
      out[0] = c * scale; // scale X
      out[2] = s * scale;
      out[8] = -s * scale;
      out[10] = c * scale; // scale Z
      return out;
    },
    []
  );

  const perspective = useCallback(
    (
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
    },
    []
  );

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
    const fsEarth = `
      precision mediump float;
      varying vec2 vUV;
      uniform sampler2D uTexture;
      void main() {
        gl_FragColor = texture2D(uTexture, vUV);
      }
    `;

    const fsCloud = /* not actually */ /* wgsl */ `
        precision mediump float;
        varying vec2 vUV;
        uniform sampler2D uTexture;
        uniform float     uTime;
        uniform float     uNoiseScale;
  
        /* 3-D simplex noise */
        vec3 mod289(vec3 x){ return x - floor(x * (1.0/289.0)) * 289.0; }
        vec4 mod289(vec4 x){ return x - floor(x * (1.0/289.0)) * 289.0; }
        vec4 permute(vec4 x){ return mod289((x*34.0+1.0)*x); }
        vec4 taylorInvSqrt(vec4 r){ return 1.79284291400159 - 0.85373472095314 * r; }
  
        float snoise(vec3 v){
          const vec2  C = vec2(1.0/6.0, 1.0/3.0);
          const vec4  D = vec4(0.0, 0.5, 1.0, 2.0);
  
          // First corner
          vec3 i  = floor(v + dot(v, C.yyy));
          vec3 x0 =   v - i + dot(i, C.xxx);
  
          // Other corners
          vec3 g = step(x0.yzx, x0.xyz);
          vec3 l = 1.0 - g;
          vec3 i1 = min( g.xyz, l.zxy );
          vec3 i2 = max( g.xyz, l.zxy );
  
          //   x0 = x0 - 0.0 + 0.0 * C 
          //   x1 = x0 - i1  + 1.0 * C 
          //   x2 = x0 - i2  + 2.0 * C 
          //   x3 = x0 - 1.0 + 3.0 * C 
          vec3 x1 = x0 - i1 + C.xxx;
          vec3 x2 = x0 - i2 + C.yyy;
          vec3 x3 = x0 - 1.0 + 3.0 * C.xxx;
  
          // Permutations
          i = mod289(i); 
          vec4 p = permute( permute( permute( 
                    i.z + vec4(0.0, i1.z, i2.z, 1.0 ))
                  + i.y + vec4(0.0, i1.y, i2.y, 1.0 )) 
                  + i.x + vec4(0.0, i1.x, i2.x, 1.0 ));
  
          // Gradients
          float n_ = 1.0/7.0; // N=7
          vec3  ns = n_ * D.wyz - D.xzx;
  
          vec4 j = p - 49.0 * floor(p * ns.z * ns.z);  //  mod(p,7*7)
  
          vec4 x_ = floor(j * ns.z);
          vec4 y_ = floor(j - 7.0 * x_ );    // mod(j,N)
  
          vec4 x = x_ *ns.x + ns.y;
          vec4 y = y_ *ns.x + ns.y;
          vec4 h = 1.0 - abs(x) - abs(y);
  
          vec4 b0 = vec4( x.xy, y.xy );
          vec4 b1 = vec4( x.zw, y.zw );
  
          vec4 s0 = floor(b0)*2.0 + 1.0;
          vec4 s1 = floor(b1)*2.0 + 1.0;
          vec4 sh = -step(h, vec4(0.0));
  
          vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy ;
          vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww ;
  
          vec3 p0 = vec3(a0.xy,h.x);
          vec3 p1 = vec3(a0.zw,h.y);
          vec3 p2 = vec3(a1.xy,h.z);
          vec3 p3 = vec3(a1.zw,h.w);
  
          // Normalise gradients
          vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
          p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
  
          // Mix final noise value
          vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
          m = m * m;
          return 42.0 * dot( m*m, vec4( dot(p0,x0), dot(p1,x1), 
                                        dot(p2,x2), dot(p3,x3) ) );
        }

        float fbm(vec3 p){
            float sum  = 0.0;
            float amp  = 1.0;
            float freq = 1.0;

            float detail = 10.0;
          
            /* Max 5 hard-coded octaves –   uDetail ∈ [1,5] */
            for (int i = 0; i < 8; i++){
              float enabled = clamp(detail - float(i), 0.0, 1.0);   // 1 if this octave counts
              sum  += enabled * amp * snoise(p * freq);
              freq *= 2.0;
              amp  *= 0.5;
            }
          
            /* Normalise so fbm always lands in [-1,1] before remap */
            float norm = (1.0 - pow(0.5, detail)) / (1.0 - 0.5);
            return (sum / norm) * 0.5 + 0.5;   // → [0,1]
        }

        float fbm_2(vec3 p){
            float sum  = 0.0;
            float amp  = 1.0;
            float freq = 1.0;

            float detail = 4.0;
          
            /* Max 5 hard-coded octaves –   uDetail ∈ [1,5] */
            for (int i = 0; i < 8; i++){
              float enabled = clamp(detail - float(i), 0.0, 1.0);   // 1 if this octave counts
              sum  += enabled * amp * snoise(p * freq);
              freq *= 2.0;
              amp  *= 0.5;
            }
          
            /* Normalise so fbm always lands in [-1,1] before remap */
            float norm = (1.0 - pow(0.5, detail)) / (1.0 - 0.5);
            return (sum / norm) * 0.5 + 0.5;   // → [0,1]
        }
          
        /* ---------- “Tightened” colour ramp ---------- */
        float rampify(float v){
            /* 0-low: black | low-high: smooth | high-1: white */
            return smoothstep(0.7, 0.8, v);
        }          
  
        void main(){
          // 3-D noise over (u, v, time)
          float n = fbm(vec3(vUV * 7.0, uTime * 0.05));
          n = n * 0.5 + 0.5;           // map from [-1,1] → [0,1]
          n = rampify(n);

          vec2 vUV_rotated = vec2(vUV.x + 0.2, vUV.y + 0.3);

          vec2 uv_mixed = mix(vUV, vUV_rotated, 0.5 * fbm_2(vec3(vUV * 2.0, uTime * 0.02)));
  
          vec4 tex = texture2D(uTexture, uv_mixed);
        //   tex.rgb = vec3(1.0, 1.0, 1.0);
          tex.a *= n;               // darken/brighten colour
          gl_FragColor = tex;

        //   gl_FragColor = vec4(tex, 0.0, 1.0);
        }
      `;

    const compileShader = (type: number, src: string) => {
      const sh = gl.createShader(type)!;
      gl.shaderSource(sh, src);
      gl.compileShader(sh);
      if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
        throw new Error(gl.getShaderInfoLog(sh) || "Shader compile error");
      }
      return sh;
    };

    const linkProgram = (vs: WebGLShader, fs: WebGLShader) => {
      const prog = gl.createProgram()!;
      gl.attachShader(prog, vs);
      gl.attachShader(prog, fs);
      gl.linkProgram(prog);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS))
        throw new Error(gl.getProgramInfoLog(prog) || "link error");
      return prog;
    };

    const vs = compileShader(gl.VERTEX_SHADER, vsSource);
    const fsE = compileShader(gl.FRAGMENT_SHADER, fsEarth);
    const progEarth = linkProgram(vs, fsE);

    // Clouds program  ★ NEW
    const fsC = compileShader(gl.FRAGMENT_SHADER, fsCloud);
    const progCloud = linkProgram(vs, fsC);

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
    const sphereOverlay = createSphereBuffers(1.0005);

    const uvBuf = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, uvBuf);
    gl.bufferData(gl.ARRAY_BUFFER, sphereBase.uvs, gl.STATIC_DRAW);

    const idxBuf = gl.createBuffer()!;
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, idxBuf);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, sphereBase.indices, gl.STATIC_DRAW);

    /* ---- Earth uniforms/attribs ---- */
    const aPosE = gl.getAttribLocation(progEarth, "aPosition");
    const aUVE = gl.getAttribLocation(progEarth, "aUV");
    const uProjE = gl.getUniformLocation(progEarth, "uProj");
    const uModelE = gl.getUniformLocation(progEarth, "uModelView");
    const uTexE = gl.getUniformLocation(progEarth, "uTexture");

    /* ---- Cloud uniforms/attribs ---- */
    const aPosC = gl.getAttribLocation(progCloud, "aPosition");
    const aUVC = gl.getAttribLocation(progCloud, "aUV");
    const uProjC = gl.getUniformLocation(progCloud, "uProj");
    const uModelC = gl.getUniformLocation(progCloud, "uModelView");
    const uTexC = gl.getUniformLocation(progCloud, "uTexture");
    const uTimeC = gl.getUniformLocation(progCloud, "uTime");
    const uScaleC = gl.getUniformLocation(progCloud, "uNoiseScale");

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
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, idxBuf);

        /* ---------- EARTH ---------- */
        gl.useProgram(progEarth);
        gl.uniformMatrix4fv(uProjE, false, projMat);

        gl.bindBuffer(gl.ARRAY_BUFFER, sphereBase.posBuf);
        gl.vertexAttribPointer(aPosE, 3, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(aPosE);

        gl.bindBuffer(gl.ARRAY_BUFFER, uvBuf);
        gl.vertexAttribPointer(aUVE, 2, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(aUVE);

        const mvE = setRotateYScale(new Float32Array(16), t * baseSpeed, 1.0);
        mvE[14] = -3.0;
        gl.uniformMatrix4fv(uModelE, false, mvE);

        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, texBase);
        gl.uniform1i(uTexE, 0);

        gl.drawElements(
          gl.TRIANGLES,
          sphereBase.indices.length,
          gl.UNSIGNED_SHORT,
          0
        );

        /* ---------- CLOUDS (noise) ---------- */
        gl.useProgram(progCloud);
        gl.uniformMatrix4fv(uProjC, false, projMat);

        gl.bindBuffer(gl.ARRAY_BUFFER, sphereOverlay.posBuf);
        gl.vertexAttribPointer(aPosC, 3, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(aPosC);

        gl.bindBuffer(gl.ARRAY_BUFFER, uvBuf);
        gl.vertexAttribPointer(aUVC, 2, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(aUVC);

        const mvC = setRotateYScale(
          new Float32Array(16),
          t * overlaySpeed,
          1.02
        );
        mvC[14] = -3.0;
        gl.uniformMatrix4fv(uModelC, false, mvC);
        gl.uniform1f(uTimeC, t * 0.001); // seconds
        gl.uniform1f(uScaleC, noiseScale);

        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, texOverlay);
        gl.uniform1i(uTexC, 0);

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
      gl.deleteProgram(progEarth);
      gl.deleteProgram(progCloud);
      gl.deleteShader(vs);
      gl.deleteShader(fsE);
      gl.deleteShader(fsC);
    };
  }, [
    baseSrc,
    overlaySrc,
    width,
    height,
    baseSpeed,
    overlaySpeed,
    noiseScale,
    pixelRatio,
    perspective,
    setRotateYScale,
  ]);

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
