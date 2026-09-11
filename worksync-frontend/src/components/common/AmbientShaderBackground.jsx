import React, { useEffect, useRef } from 'react';

export function AmbientShaderBackground() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    function syncSize() {
      const w = canvas.clientWidth || window.innerWidth;
      const h = canvas.clientHeight || window.innerHeight;
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
    }

    syncSize();
    const resizeObserver = new ResizeObserver(syncSize);
    resizeObserver.observe(canvas);

    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    if (!gl) return;

    const vs = `
      attribute vec2 a_position;
      varying vec2 v_texCoord;
      void main() {
        v_texCoord = a_position * 0.5 + 0.5;
        gl_Position = vec4(a_position, 0.0, 1.0);
      }
    `;

    const fs = `
      precision highp float;
      varying vec2 v_texCoord;
      uniform float u_time;
      uniform vec2 u_resolution;

      void main() {
          vec2 uv = v_texCoord;
          float time = u_time * 0.15;
          
          float noise = sin(uv.x * 3.0 + time) * cos(uv.y * 2.0 - time);
          noise += sin(uv.y * 4.0 - time * 0.5) * cos(uv.x * 3.0 + time * 0.8);
          
          vec3 color1 = vec3(0.04, 0.04, 0.05);
          vec3 color2 = vec3(0.12, 0.08, 0.22);
          
          vec3 finalColor = mix(color1, color2, noise * 0.2 + 0.1);
          float grain = fract(sin(dot(uv, vec2(12.9898, 78.233))) * 43758.5453);
          finalColor += grain * 0.015;
          
          gl_FragColor = vec4(finalColor, 1.0);
      }
    `;

    function createShader(glCtx, type, src) {
      const s = glCtx.createShader(type);
      glCtx.shaderSource(s, src);
      glCtx.compileShader(s);
      return s;
    }

    const prog = gl.createProgram();
    gl.attachShader(prog, createShader(gl, gl.VERTEX_SHADER, vs));
    gl.attachShader(prog, createShader(gl, gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(prog);
    gl.useProgram(prog);

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);

    const pos = gl.getAttribLocation(prog, 'a_position');
    gl.enableVertexAttribArray(pos);
    gl.vertexAttribPointer(pos, 2, gl.FLOAT, false, 0, 0);

    const uTime = gl.getUniformLocation(prog, 'u_time');
    const uRes = gl.getUniformLocation(prog, 'u_resolution');

    let animId;
    function render(t) {
      gl.viewport(0, 0, canvas.width, canvas.height);
      if (uTime) gl.uniform1f(uTime, t * 0.001);
      if (uRes) gl.uniform2f(uRes, canvas.width, canvas.height);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      animId = requestAnimationFrame(render);
    }
    animId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animId);
      resizeObserver.disconnect();
    };
  }, []);

  return (
    <div className="fixed inset-0 w-full h-full pointer-events-none z-0">
      <canvas ref={canvasRef} className="w-full h-full block opacity-60" />
    </div>
  );
}
