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
    t: 0, // Path position 0-1
    maxSpeed: 80,
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

// Player Ship (Invisible or simple mesh, camera is attached to it)
const cameraRig = new THREE.Object3D();
scene.add(cameraRig);
const playerShip = new THREE.Object3D();
cameraRig.add(playerShip);
playerShip.add(camera);
playerShip.add(pointLight); // Light moves with player

// Controls
const input = { x: 0, y: 0 };
const joystickManager = nipplejs.create({
    zone: document.getElementById('input-zone'),
    mode: 'dynamic',
    color: 'cyan'
});

joystickManager.on('move', (evt, data) => {
    if (data && data.vector) {
        input.x = data.vector.x;
        input.y = data.vector.y;
    }
});

joystickManager.on('end', () => {
    input.x = 0;
    input.y = 0;
});

window.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowUp' || e.key === 'w') input.y = 1;
    if (e.key === 'ArrowDown' || e.key === 's') input.y = -1;
    if (e.key === 'ArrowLeft' || e.key === 'a') input.x = -1;
    if (e.key === 'ArrowRight' || e.key === 'd') input.x = 1;
});

window.addEventListener('keyup', (e) => {
    if (['ArrowUp', 'w', 'ArrowDown', 's'].includes(e.key)) input.y = 0;
    if (['ArrowLeft', 'a', 'ArrowRight', 'd'].includes(e.key)) input.x = 0;
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
        state.speed = 20;
        
        animate();
    } catch (e) {
        console.error(e);
        alert("Error starting game: " + e.message);
    }
}

// UI updates
const scoreEl = document.getElementById('score-display');
const adhdEl = document.getElementById('adhd-text');
const glitchEl = document.getElementById('glitch-overlay');

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
    // Accelerate
    if (state.speed < state.maxSpeed) state.speed += dt * 5;
    
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

    // Player Local Movement (Dodge)
    const speedX = 30 * dt;
    const speedY = 30 * dt;
    playerPosLocal.x += input.x * speedX;
    playerPosLocal.y += input.y * speedY;
    
    // Clamp inside tube (Radius 8, keep player within ~6)
    const rLimit = 6;
    if (playerPosLocal.length() > rLimit) {
        playerPosLocal.setLength(rLimit);
    }

    // Apply local position to ship
    playerShip.position.set(playerPosLocal.x, playerPosLocal.y, 0);
    
    // Bank ship
    playerShip.rotation.z = -input.x * 0.5 + Math.sin(state.time * 10) * 0.05 * (state.speed/50); // Add jitter

    // Update World
    world.update(state.time, state.speed);
    
    // Camera Shake
    if (state.shake > 0) {
        camera.position.x = (Math.random() - 0.5) * state.shake;
        camera.position.y = (Math.random() - 0.5) * state.shake;
        state.shake -= dt * 2;
        if (state.shake < 0) state.shake = 0;
    }

    // Collision
    // World coordinates of player for collision
    const worldPlayerPos = playerShip.getWorldPosition(new THREE.Vector3());
    
    // Note: collision check in World is approximated. 
    // We pass world pos, but world check needs to know approximate T to save time.
    if (world.checkCollision(worldPlayerPos, state.t)) {
        // Crash!
        if (state.shake === 0) { // If not already crashing
            state.shake = 1.0;
            state.speed *= 0.5; // Lose speed
            audio.play('crash', false, 0.8);
            
            // Glitch Effect
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