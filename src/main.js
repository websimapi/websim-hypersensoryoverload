import * as THREE from 'three';
import { World } from './world.js';
import { AudioManager } from './audio.js';
import nipplejs from 'nipplejs';

const state = {
    playing: false,
    speed: 0,
    distance: 0,
    time: 0,
    health: 100,
    lastHitTime: -10,
    t: 0, // Path position 0-1
    maxSpeed: 200, // Faster max speed
    shake: 0
};

// Setup
const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x000000, 0.02);

const camera = new THREE.PerspectiveCamera(90, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// Lights
const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
scene.add(ambientLight);
const pointLight = new THREE.PointLight(0xff00ff, 2, 50);
scene.add(pointLight);

// Audio
const audio = new AudioManager();

// Assets
const textureLoader = new THREE.TextureLoader();
let world;

const loadTexture = (path) => {
    return new Promise(resolve => {
        textureLoader.load(path, resolve, undefined, () => {
            console.error(`Failed to load texture: ${path}`);
            // Return a simple fallback texture
            const canvas = document.createElement('canvas');
            canvas.width = 2; canvas.height = 2;
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = '#333';
            ctx.fillRect(0,0,2,2);
            ctx.fillStyle = '#ff00ff';
            ctx.fillRect(0,0,1,1);
            const tex = new THREE.CanvasTexture(canvas);
            resolve(tex);
        });
    });
};

Promise.all([
    loadTexture('wall_texture.png'),
    loadTexture('hazard_texture.png'),
    audio.load('bgm', 'bgm.mp3').catch(e => console.error(e)),
    audio.load('engine', 'engine.mp3').catch(e => console.error(e)),
    audio.load('crash', 'crash.mp3').catch(e => console.error(e))
]).then(([wallTex, hazTex]) => {
    world = new World(scene, wallTex, hazTex);
    const btn = document.getElementById('start-btn');
    btn.innerText = "INITIALIZE";
    btn.disabled = false;
    btn.addEventListener('click', startGame);
}).catch(err => {
    console.error("Fatal loading error", err);
    document.getElementById('start-btn').innerText = "SYSTEM ERROR";
});

// Player Ship
const cameraRig = new THREE.Object3D();
scene.add(cameraRig);

const playerShip = new THREE.Object3D();
cameraRig.add(playerShip);

// Visual Hitbox (The Player)
const shipGeo = new THREE.SphereGeometry(0.4, 16, 16); // Small hit circle
const shipMat = new THREE.MeshBasicMaterial({ 
    color: 0x00ffff,
    wireframe: true 
});
const shipMesh = new THREE.Mesh(shipGeo, shipMat);
// Add a core glow
const coreGeo = new THREE.SphereGeometry(0.2, 16, 16);
const coreMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
shipMesh.add(new THREE.Mesh(coreGeo, coreMat));
playerShip.add(shipMesh);

// Camera positioned behind the ship (Chase view to see hitbox)
camera.position.set(0, 0.5, 2.5); // Slightly up and behind
playerShip.add(camera);

playerShip.add(pointLight);

// Controls
const input = { x: 0, y: 0 };
const joystickManager = nipplejs.create({
    zone: document.getElementById('input-zone'),
    mode: 'dynamic',
    color: 'cyan'
});

joystickManager.on('move', (evt, data) => {
    if (data && data.vector) {
        // Use force to allow subtle movements, clamped to 1.0
        const force = Math.min(data.force, 1.0);
        input.x = data.vector.x * force;
        input.y = data.vector.y * force;
    }
});

joystickManager.on('end', () => {
    input.x = 0;
    input.y = 0;
});

window.addEventListener('mousemove', (e) => {
    // Map mouse position to -1 to 1 range based on window size
    input.x = (e.clientX / window.innerWidth) * 2 - 1;
    input.y = -(e.clientY / window.innerHeight) * 2 + 1;
});

function startGame() {
    try {
        console.log("Starting game...");
        const startScreen = document.getElementById('start-screen');
        startScreen.style.transition = 'opacity 0.5s';
        startScreen.style.opacity = '0';
        setTimeout(() => startScreen.style.display = 'none', 500);

        audio.resume();
        audio.play('bgm', true, 0.6);
        audio.play('engine', true, 0.4);
        
        state.playing = true;
        state.speed = 80; // Higher base speed
        state.health = 100;
        state.distance = 0;
        document.getElementById('game-over').style.display = 'none';
        
        animate();
    } catch (e) {
        console.error(e);
        alert("Error starting game: " + e.message);
    }
}

// UI updates
const scoreEl = document.getElementById('score-display');
const adhdEl = document.getElementById('adhd-text');
const healthBarEl = document.getElementById('health-bar');
const glitchEl = document.getElementById('glitch-overlay');
const gameOverEl = document.getElementById('game-over');

const flavorTexts = [
    "ADHD LEVEL: 240%", "FOCUS LOST", "DOPAMINE LOW", "HYPERFOCUS ENGAGED", 
    "SENSORY OVERLOAD", "PLEASE BLINK", "REALITY GLITCH"
];

setInterval(() => {
    if(state.playing) {
        adhdEl.innerText = flavorTexts[Math.floor(Math.random() * flavorTexts.length)];
        adhdEl.style.color = Math.random() > 0.5 ? '#f0f' : '#0ff';
    }
}, 2000);

// Main Loop
const clock = new THREE.Clock();
const playerPosLocal = new THREE.Vector3(0, 0, 0); // X, Y offset inside tube

function animate() {
    requestAnimationFrame(animate);

    if (!world || !state.playing) return;

    const dt = clock.getDelta();
    state.time += dt;

    // Movement Logic
    // Accelerate progressively if not hit recently
    if (state.time - state.lastHitTime > 1.0) {
        if (state.speed < state.maxSpeed) state.speed += dt * 8.0; // Faster acceleration
    }

    // Health Regeneration
    if (state.time - state.lastHitTime > 2.0 && state.health < 100) {
        state.health += dt * 15; // Faster regen
        if (state.health > 100) state.health = 100;
    }

    // Health Bar Color & Width
    healthBarEl.style.width = state.health + '%';
    if (state.health < 30) healthBarEl.style.background = '#f00';
    else if (state.health < 60) healthBarEl.style.background = '#ff0';
    else healthBarEl.style.background = '#0f0';

    // Game Over
    if (state.health <= 0) {
        state.playing = false;
        gameOverEl.style.display = 'block';
        audio.setEnginePitch(0);
        document.getElementById('start-btn').innerText = "RESTART";
        document.getElementById('start-screen').style.display = 'flex';
        document.getElementById('start-screen').style.opacity = '1';
        return;
    }
    
    // Path progression
    // Speed is units per second. Path length ~ 100 * segments?
    // We need real path length.
    const pathLen = world.path.getLength();
    const moveDist = state.speed * dt;
    state.distance += moveDist;
    state.t += moveDist / pathLen;
    if (state.t > 1) state.t -= 1; // Loop

    // Update Camera Rig Position on Path
    const point = world.path.getPointAt(state.t);
    const tangent = world.path.getTangentAt(state.t).normalize();
    const normal = new THREE.Vector3(0, 1, 0).applyAxisAngle(tangent, state.time * 0.1); // Slowly rotate "up" vector to disorient
    const binormal = new THREE.Vector3().crossVectors(tangent, normal).normalize();

    // Orient Rig
    const lookAt = point.clone().add(tangent);
    cameraRig.position.copy(point);
    cameraRig.matrix.lookAt(cameraRig.position, lookAt, normal);
    cameraRig.quaternion.setFromRotationMatrix(cameraRig.matrix);

    // Player Local Movement (Mouse Follow)
    // Map input (-1 to 1) to safe tube radius
    // We restrict target to a smaller radius to ensure the player attempts to stay safe
    const safeRadius = 9.5;
    const targetX = input.x * safeRadius;
    const targetY = input.y * safeRadius;
    
    // Smooth lerp to target - Faster for "fine tuned" feel
    // Using a very high lerp value makes it feel almost 1:1 but with slight weight
    const lerpFactor = 15.0; 
    playerPosLocal.x += (targetX - playerPosLocal.x) * lerpFactor * dt;
    playerPosLocal.y += (targetY - playerPosLocal.y) * lerpFactor * dt;

    // Wall Collision
    const dist = playerPosLocal.length();
    const wallLimit = 10.0; // Reduced to prevent camera clipping through undulating walls

    if (dist > wallLimit) {
        // Wall Hit Damage
        if (state.shake <= 0) {
            state.shake = 0.5;
            state.speed *= 0.8;
            state.health -= 2;
            state.lastHitTime = state.time;
            audio.play('crash', false, 0.3);
            glitchEl.style.opacity = 0.5;
            setTimeout(() => glitchEl.style.opacity = 0, 100);
        }
        // Force back
        playerPosLocal.setLength(wallLimit - 0.05);
    }

    // Apply local position to ship
    playerShip.position.set(playerPosLocal.x, playerPosLocal.y, 0);
    
    // Bank ship
    playerShip.rotation.z = (playerPosLocal.x - targetX) * 0.1 + Math.sin(state.time * 10) * 0.05 * (state.speed/50);

    // Update World
    world.update(state.time, state.speed);
    
    // Camera Shake
    if (state.shake > 0) {
        camera.position.x = (Math.random() - 0.5) * state.shake;
        camera.position.y = (Math.random() - 0.5) * state.shake;
        state.shake -= dt * 2;
        if (state.shake < 0) state.shake = 0;
    }

    // Collision with Obstacles
    const worldPlayerPos = playerShip.getWorldPosition(new THREE.Vector3());
    
    if (world.checkCollision(worldPlayerPos, state.t, playerPosLocal)) {
        // Hard Crash!
        if (state.shake <= 0) {
            state.shake = 1.0;
            state.speed *= 0.6; // Lose more speed
            state.health -= 15; // Major damage (approx 7 hits to kill if no regen)
            state.lastHitTime = state.time;
            audio.play('crash', false, 0.8);
            glitchEl.style.opacity = 1;
            setTimeout(() => glitchEl.style.opacity = 0, 100);
        }
    }

    // Audio Pitch
    audio.setEnginePitch(state.speed / state.maxSpeed);

    // UI
    scoreEl.innerText = `DIST: ${Math.floor(state.distance)}`;

    renderer.render(scene, camera);
}

// Resize
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});