import * as THREE from 'three';
import { generatePath, randomRange } from './utils.js';
import { tunnelVertexShader, tunnelFragmentShader } from './shaders.js';

const _matrix = new THREE.Matrix4();
const _invMatrix = new THREE.Matrix4();
const _playerLocal = new THREE.Vector3();

export class World {
    constructor(scene, texture, obstacleTexture) {
        this.scene = scene;
        this.path = generatePath();
        this.tubeGeometry = new THREE.TubeGeometry(this.path, 450, 18, 24, true); // Larger radius (18), smoother
        this.texture = texture;
        this.obstacleTexture = obstacleTexture;
        
        this.initTunnel();
        this.initObstacles();
        this.initFans();
        this.initTetrahedrons();
        this.initPacmans();
    }

    initTunnel() {
        this.texture.wrapS = THREE.RepeatWrapping;
        this.texture.wrapT = THREE.RepeatWrapping;
        
        this.uniforms = {
            time: { value: 0 },
            map: { value: this.texture },
            distortion: { value: 1.2 }, // Reduced to prevent wall clipping
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
        // Create instanced mesh for boxes - Reduced Count
        const geometry = new THREE.BoxGeometry(2, 2, 2);
        const material = new THREE.MeshStandardMaterial({ 
            map: this.obstacleTexture,
            roughness: 0.4,
            metalness: 0.8,
            color: 0xff0000
        });
        
        this.obstacleCount = 40; // Reduced from 150
        this.obstacles = new THREE.InstancedMesh(geometry, material, this.obstacleCount);
        this.obstacleData = [];

        const dummy = new THREE.Object3D();
        
        for (let i = 0; i < this.obstacleCount; i++) {
            const t = randomRange(0.1, 0.95);
            const angle = Math.random() * Math.PI * 2;
            const r = randomRange(4, 10);
            
            this.obstacleData.push({ t, angle, radius: r });
            this.updateObstacleMatrix(dummy, i);
        }
        this.scene.add(this.obstacles);
    }

    initFans() {
        // Rotating fans - Reduced count and speed
        const geometry = new THREE.BoxGeometry(26, 1.5, 1.5);
        const material = new THREE.MeshStandardMaterial({ 
            map: this.obstacleTexture,
            color: 0xffff00,
            emissive: 0x333300
        });

        this.fanCount = 8; // Reduced from 20
        this.fans = new THREE.InstancedMesh(geometry, material, this.fanCount);
        this.fanData = [];

        const dummy = new THREE.Object3D();
        for (let i = 0; i < this.fanCount; i++) {
            const t = randomRange(0.15, 0.95);
            this.fanData.push({ t: t, speed: randomRange(0.5, 2.0) }); // Slower speed
            this.updateFanMatrix(dummy, i, 0);
        }
        this.scene.add(this.fans);
    }

    initTetrahedrons() {
        const geometry = new THREE.TetrahedronGeometry(2.0);
        const material = new THREE.MeshStandardMaterial({ 
            map: this.obstacleTexture,
            color: 0x00ffaa,
            metalness: 0.9,
            roughness: 0.1,
            emissive: 0x002222
        });
        
        this.tetraCount = 30; // Reduced from 80
        this.tetras = new THREE.InstancedMesh(geometry, material, this.tetraCount);
        this.tetraData = [];
        
        const dummy = new THREE.Object3D();
        for (let i = 0; i < this.tetraCount; i++) {
            const t = randomRange(0.1, 0.95);
            const angle = Math.random() * Math.PI * 2;
            const r = randomRange(3, 11);
            
            this.tetraData.push({ t, angle, radius: r, rotSpeed: randomRange(1, 4), tumble: Math.random() });
            this.updateTetraMatrix(dummy, i, 0);
        }
        this.scene.add(this.tetras);
    }

    initPacmans() {
        // "Pacman" shape: Cylinder with a wedge missing
        // Radius 17.5 (matches new tube size 18), Height 2
        // ThetaLength 5.0 (Larger gap for easier passage)
        const geometry = new THREE.CylinderGeometry(17.5, 17.5, 2, 32, 1, false, 0, 5.0);
        // Rotate geometry so it faces Z axis (tube length)
        geometry.rotateX(Math.PI / 2);

        const material = new THREE.MeshStandardMaterial({ 
            map: this.obstacleTexture, 
            color: 0xff00ff,
            emissive: 0x440044,
            side: THREE.DoubleSide
        });
        
        this.pacCount = 15;
        this.pacs = new THREE.InstancedMesh(geometry, material, this.pacCount);
        this.pacData = [];
        
        const dummy = new THREE.Object3D();
        for(let i=0; i<this.pacCount; i++) {
            const t = randomRange(0.15, 0.95);
            const speed = randomRange(0.5, 1.5) * (Math.random()>0.5?1:-1);
            this.pacData.push({ t, speed });
            this.updatePacMatrix(dummy, i, 0);
        }
        this.scene.add(this.pacs);
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

    updateTetraMatrix(dummy, index, time) {
        const data = this.tetraData[index];
        const point = this.path.getPointAt(data.t);
        const tangent = this.path.getTangentAt(data.t);
        const normal = new THREE.Vector3(0, 1, 0).applyAxisAngle(tangent, data.angle);
        
        const pos = point.clone().add(normal.multiplyScalar(data.radius));
        
        dummy.position.copy(pos);
        dummy.lookAt(point); // Look at center
        dummy.rotateX(time * data.rotSpeed);
        dummy.rotateZ(time * data.rotSpeed * data.tumble);
        
        dummy.updateMatrix();
        this.tetras.setMatrixAt(index, dummy.matrix);
    }

    updatePacMatrix(dummy, index, time) {
        const data = this.pacData[index];
        const point = this.path.getPointAt(data.t);
        const tangent = this.path.getTangentAt(data.t);
        
        dummy.position.copy(point);
        dummy.lookAt(point.clone().add(tangent));
        // Rotate around Z axis (which is local tangent)
        dummy.rotateZ(time * data.speed + index); 
        
        dummy.updateMatrix();
        this.pacs.setMatrixAt(index, dummy.matrix);
    }

    update(time, speed) {
        this.uniforms.time.value = time;
        this.uniforms.speedEffect.value = speed * 0.1;

        const dummy = new THREE.Object3D();
        
        // Update fans
        for (let i = 0; i < this.fanCount; i++) {
            this.updateFanMatrix(dummy, i, time);
        }
        this.fans.instanceMatrix.needsUpdate = true;

        // Update tetras
        for (let i = 0; i < this.tetraCount; i++) {
            this.updateTetraMatrix(dummy, i, time);
        }
        this.tetras.instanceMatrix.needsUpdate = true;

        // Update Pacs
        for (let i = 0; i < this.pacCount; i++) {
            this.updatePacMatrix(dummy, i, time);
        }
        this.pacs.instanceMatrix.needsUpdate = true;
    }

    checkCollision(playerPos, playerT, playerLocalPos) {
        // Precise OBB collision detection with REDUCED HITBOXES
        const checkThreshold = 0.025; // Slightly wider time window but stricter geo check
        
        // 1. Boxes
        // Visual size: 2x2x2 (Half extent 1.0)
        // Hitbox: 0.8 (Very forgiving)
        const boxHitSize = 0.8;
        
        for (let i = 0; i < this.obstacleCount; i++) {
            const ob = this.obstacleData[i];
            let dt = Math.abs(ob.t - playerT);
            if (dt > 0.5) dt = 1.0 - dt; 

            if (dt < checkThreshold) {
                this.obstacles.getMatrixAt(i, _matrix);
                _invMatrix.copy(_matrix).invert();
                _playerLocal.copy(playerPos).applyMatrix4(_invMatrix);

                // Local OBB Check
                if (Math.abs(_playerLocal.x) < boxHitSize && 
                    Math.abs(_playerLocal.y) < boxHitSize && 
                    Math.abs(_playerLocal.z) < boxHitSize) {
                    return true;
                }
            }
        }

        // 2. Fans
        // Visual: 26x1.5x1.5
        // Hitbox: Length 12 (shorter), Thick 0.5 (thinner)
        const fanLen = 12.0;
        const fanThick = 0.5;
        
        for (let i = 0; i < this.fanCount; i++) {
            const ob = this.fanData[i];
            let dt = Math.abs(ob.t - playerT);
            if (dt > 0.5) dt = 1.0 - dt;

            if (dt < checkThreshold) {
                this.fans.getMatrixAt(i, _matrix);
                _invMatrix.copy(_matrix).invert();
                _playerLocal.copy(playerPos).applyMatrix4(_invMatrix);

                if (Math.abs(_playerLocal.x) < fanLen && 
                    Math.abs(_playerLocal.y) < fanThick && 
                    Math.abs(_playerLocal.z) < fanThick) {
                    return true;
                }
            }
        }

        // 3. Tetras
        // Visual Radius ~2.0
        // Hitbox Radius 1.2 (Much smaller)
        for (let i = 0; i < this.tetraCount; i++) {
            const ob = this.tetraData[i];
            let dt = Math.abs(ob.t - playerT);
            if (dt > 0.5) dt = 1.0 - dt;

            if (dt < checkThreshold) {
                this.tetras.getMatrixAt(i, _matrix);
                const pos = new THREE.Vector3().setFromMatrixPosition(_matrix);
                // Simple distance check
                if (pos.distanceTo(playerPos) < 1.4) return true;
            }
        }

        // 4. Pacmans (The Gates)
        // Solid arc: 0 to 5.0 (Visual)
        // Hit arc: 0 to 4.8 (Give extra margin at edges)
        for (let i = 0; i < this.pacCount; i++) {
            const ob = this.pacData[i];
            let dt = Math.abs(ob.t - playerT);
            if (dt > 0.5) dt = 1.0 - dt;

            // Only check when we are practically inside the ring
            if (dt < 0.005) { 
                let playerAngle = Math.atan2(playerLocalPos.y, playerLocalPos.x); 
                if (playerAngle < 0) playerAngle += Math.PI * 2;

                const time = this.uniforms.time.value;
                let pacRotation = (time * ob.speed + i) % (Math.PI * 2);
                if (pacRotation < 0) pacRotation += Math.PI * 2;

                let relativeAngle = playerAngle - pacRotation;
                while (relativeAngle < 0) relativeAngle += Math.PI * 2;
                while (relativeAngle >= Math.PI * 2) relativeAngle -= Math.PI * 2;

                // Visual gap starts at 5.0. 
                // Collision if angle < 4.8 (Safety margin of 0.2 rads)
                if (relativeAngle < 4.8) {
                    return true;
                }
            }
        }

        return false;
    }
}