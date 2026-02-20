export const tunnelVertexShader = `
    varying vec2 vUv;
    varying vec3 vPos;
    uniform float time;
    uniform float distortion;

    void main() {
        vUv = uv;
        vPos = position;
        
        vec3 transformed = position;
        
        // Add "breathing" effect to walls
        float pulse = sin(position.z * 0.1 + time * 2.0) * distortion;
        transformed.x += pulse;
        transformed.y += pulse;
        
        // Warp perception based on speed/time
        float twist = sin(time * 0.5 + position.z * 0.05) * distortion * 2.0;
        transformed.x += twist;
        transformed.y -= twist;

        gl_Position = projectionMatrix * modelViewMatrix * vec4(transformed, 1.0);
    }
`;

export const tunnelFragmentShader = `
    varying vec2 vUv;
    varying vec3 vPos;
    uniform float time;
    uniform sampler2D map;
    uniform float speedEffect;

    void main() {
        // Move texture along the tube
        vec2 uv = vUv;
        uv.x = uv.x * 4.0; // Repeat around
        uv.y = uv.y * 20.0 + time * speedEffect; // Repeat length and move

        // Wiggle UVs for nausea
        uv.x += sin(uv.y * 10.0 + time) * 0.02;

        vec4 texColor = texture2D(map, uv);
        
        // Neon color processing
        vec3 color = texColor.rgb;
        
        // Pulse colors
        float pulse = 0.5 + 0.5 * sin(time * 3.0 + vUv.y * 10.0);
        color = mix(color, vec3(0.0, 1.0, 1.0), pulse * 0.2); // Cyan tint
        color = mix(color, vec3(1.0, 0.0, 1.0), sin(time * 5.0) * 0.2); // Magenta tint

        // Distance fog baked in shader (simple fade)
        // We let Three.js fog handle the heavy lifting usually, but let's add glow
        float glow = max(0.0, sin(vUv.x * 20.0 + time * 10.0));
        color += vec3(glow * 0.1);

        gl_FragColor = vec4(color, 1.0);
    }
`;