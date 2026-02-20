import * as THREE from 'three';

export function randomRange(min, max) {
    return Math.random() * (max - min) + min;
}

export function generatePath() {
    // Generate a closed loop path that twists and turns
    const points = [];
    const segmentCount = 100; // Segments in the loop
    const radius = 150; // General radius of the "track" loop
    const variation = 60; // How much it deviates up/down/in/out

    for (let i = 0; i < segmentCount; i++) {
        const theta = (i / segmentCount) * Math.PI * 2;
        
        // Base circle
        let x = Math.cos(theta) * radius;
        let y = Math.sin(theta * 3) * 30; // Undulate up and down
        let z = Math.sin(theta) * radius;

        // Add noise/twists
        x += Math.sin(theta * 5) * variation;
        z += Math.cos(theta * 4) * variation;
        y += Math.sin(theta * 7) * variation * 0.5;

        points.push(new THREE.Vector3(x, y, z));
    }
    return new THREE.CatmullRomCurve3(points, true, 'catmullrom', 0.5);
}

export function easeOutQuad(t) {
    return t * (2 - t);
}