import * as THREE from 'three';
import { generatePath, randomRange } from './utils.js';
import { tunnelVertexShader, tunnelFragmentShader } from './shaders.js';

export class World {
    constructor(scene, texture, obstacleTexture) {
        this.scene = scene;
        this.path = generatePath();
        this.tubeGeometry = new THREE.TubeGeometry(this.path, 400, 8, 12, true);
        this.texture = texture;
        this.obstacleTexture = obstacleTexture;
        
        this.initTunnel();
        this.initObstacles();
        this.initFans();
    }

    initTunnel() {
        this.texture.wrapS = THREE.RepeatWrapping;
        this.texture.wrapT = THREE.RepeatWrapping;
        
        this.uniforms = {
            time: { value: 0 },
            map: { value: this.texture },
            distortion: { value: 2.0 },
            speedEffect: { value: 1.0 }
        };

        const material = new THREE.ShaderMaterial({
            uniforms: this.uniforms,
            vertexShader: tunnelVertexShader,
            fragmentShader: tunnelFragmentShader,
            side: THREE.BackSide,
            wireframe: false
        });

        this.mesh = new THREE.Mesh(this.tubeGeometry, material);
        this.scene.add(this.mesh);
    }

    initObstacles() {
        // Create instanced mesh for boxes
        const geometry = new THREE.BoxGeometry(2, 2, 2);
        const material = new THREE.MeshStandardMaterial({ 
            map: this.obstacleTexture,
            roughness: 0.4,
            metalness: 0.8,
            color: 0xff0000
        });
        
        this.obstacleCount = 150;
        this.obstacles = new THREE.InstancedMesh(geometry, material, this.obstacleCount);
        this.obstacleData = []; // Store { t: pathPosition, offset: Vector2 }

        const dummy = new THREE.Object3D();
        
        for (let i = 0; i < this.obstacleCount; i++) {
            // Distribute randomly along path t, avoiding start zone (0.0 - 0.1)
            const t = randomRange(0.1, 0.95);
            // Random radial offset
            const angle = Math.random() * Math.PI * 2;
            const r = randomRange(2, 6); // Within tube radius 8
            
            this.obstacleData.push({
                t: t,
                angle: angle,
                radius: r,
                type: 'box'
            });

            this.updateObstacleMatrix(dummy, i);
        }
        
        this.scene.add(this.obstacles);
    }

    initFans() {
        // Rotating fans
        const geometry = new THREE.BoxGeometry(14, 1, 1); // Long blade
        const material = new THREE.MeshStandardMaterial({ 
            map: this.obstacleTexture,
            color: 0xffff00,
            emissive: 0x333300
        });

        this.fanCount = 30;
        this.fans = new THREE.InstancedMesh(geometry, material, this.fanCount);
        this.fanData = [];

        const dummy = new THREE.Object3D();
        for (let i = 0; i < this.fanCount; i++) {
            // Avoid start area
            const t = randomRange(0.15, 0.95);
            this.fanData.push({ t: t, speed: randomRange(2, 5) });
            this.updateFanMatrix(dummy, i, 0);
        }
        this.scene.add(this.fans);
    }

    updateObstacleMatrix(dummy, index) {
        const data = this.obstacleData[index];
        const point = this.path.getPointAt(data.t);
        const tangent = this.path.getTangentAt(data.t);
        const normal = new THREE.Vector3(0, 1, 0).applyAxisAngle(tangent, data.angle);
        const binormal = new THREE.Vector3().crossVectors(tangent, normal);
        
        // Position relative to center line
        const pos = point.clone().add(normal.multiplyScalar(data.radius));
        
        dummy.position.copy(pos);
        dummy.lookAt(pos.clone().add(tangent));
        dummy.rotation.z += Math.random(); // Random tumble
        dummy.updateMatrix();
        this.obstacles.setMatrixAt(index, dummy.matrix);
    }

    updateFanMatrix(dummy, index, time) {
        const data = this.fanData[index];
        const point = this.path.getPointAt(data.t);
        const tangent = this.path.getTangentAt(data.t);
        
        dummy.position.copy(point);
        dummy.lookAt(point.clone().add(tangent));
        dummy.rotateZ(time * data.speed);
        
        dummy.updateMatrix();
        this.fans.setMatrixAt(index, dummy.matrix);
    }

    update(time, speed) {
        this.uniforms.time.value = time;
        this.uniforms.speedEffect.value = speed * 0.1;

        // Update fans
        const dummy = new THREE.Object3D();
        for (let i = 0; i < this.fanCount; i++) {
            this.updateFanMatrix(dummy, i, time);
        }
        this.fans.instanceMatrix.needsUpdate = true;
    }

    checkCollision(playerPos, playerT) {
        // Simple distance check against nearby obstacles
        // Optimization: only check obstacles where |obstacle.t - playerT| is small
        // Handling wrap-around logic for t (0 and 1 are same)
        
        const checkThreshold = 0.02; 
        const crashDist = 2.5;

        // Check boxes
        for (let i = 0; i < this.obstacleCount; i++) {
            const ob = this.obstacleData[i];
            let dt = Math.abs(ob.t - playerT);
            if (dt > 0.5) dt = 1.0 - dt; // Wrap around distance

            if (dt < checkThreshold) {
                // Precise check
                const dummy = new THREE.Object3D();
                this.obstacles.getMatrixAt(i, dummy.matrix);
                dummy.matrix.decompose(dummy.position, dummy.quaternion, dummy.scale);
                
                if (dummy.position.distanceTo(playerPos) < crashDist) {
                    return true;
                }
            }
        }

        // Check fans
        for (let i = 0; i < this.fanCount; i++) {
            const ob = this.fanData[i];
            let dt = Math.abs(ob.t - playerT);
            if (dt > 0.5) dt = 1.0 - dt;

            if (dt < checkThreshold) {
                const point = this.path.getPointAt(ob.t);
                // Reduce fan kill zone to just the central hub area to be playable
                if (point.distanceTo(playerPos) < 3.0) { 
                     return true;
                }
            }
        }
        return false;
    }
}