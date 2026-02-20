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
        this.tubeGeometry = new THREE.TubeGeometry(this.path, 400, 14, 16, true);
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
        // Radius 14 (tube size), Height 2
        // ThetaLength 5.2 (gap of ~1.08 rad)
        const geometry = new THREE.CylinderGeometry(13.5, 13.5, 2, 32, 1, false, 0, 5.2);
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
        // Precise OBB collision detection
        const checkThreshold = 0.02; // Roughly check nearby objects
        const playerRadius = 0.4; // Matches visual size

        // Check boxes (AABB in local space)
        // Box is 2x2x2 -> Local bounds [-1,1]
        const boxBounds = 1.0 + playerRadius;
        for (let i = 0; i < this.obstacleCount; i++) {
            const ob = this.obstacleData[i];
            let dt = Math.abs(ob.t - playerT);
            if (dt > 0.5) dt = 1.0 - dt; 

            if (dt < checkThreshold) {
                this.obstacles.getMatrixAt(i, _matrix);
                _invMatrix.copy(_matrix).invert();
                _playerLocal.copy(playerPos).applyMatrix4(_invMatrix);

                if (Math.abs(_playerLocal.x) < boxBounds && 
                    Math.abs(_playerLocal.y) < boxBounds && 
                    Math.abs(_playerLocal.z) < boxBounds) {
                    return true;
                }
            }
        }

        // Check fans (AABB in local space)
        // Fan is 26x1.5x1.5 -> Local bounds x[-13,13], y[-0.75,0.75], z[-0.75,0.75]
        const fanHalfLen = 13.0 + playerRadius;
        const fanHalfThick = 0.75 + playerRadius;
        
        for (let i = 0; i < this.fanCount; i++) {
            const ob = this.fanData[i];
            let dt = Math.abs(ob.t - playerT);
            if (dt > 0.5) dt = 1.0 - dt;

            if (dt < checkThreshold) {
                this.fans.getMatrixAt(i, _matrix);
                _invMatrix.copy(_matrix).invert();
                _playerLocal.copy(playerPos).applyMatrix4(_invMatrix);

                if (Math.abs(_playerLocal.x) < fanHalfLen && 
                    Math.abs(_playerLocal.y) < fanHalfThick && 
                    Math.abs(_playerLocal.z) < fanHalfThick) {
                    return true;
                }
            }
        }

        // Check Tetras (Sphere check is sufficient and smoother)
        // Radius ~ 3.0?
        for (let i = 0; i < this.tetraCount; i++) {
            const ob = this.tetraData[i];
            let dt = Math.abs(ob.t - playerT);
            if (dt > 0.5) dt = 1.0 - dt;

            if (dt < checkThreshold) {
                // Get world position of tetra
                this.tetras.getMatrixAt(i, _matrix);
                const pos = new THREE.Vector3().setFromMatrixPosition(_matrix);
                
                // Tetra radius is roughly 2.0 (geometry radius) + player radius
                // 2.5 is a fair hit radius
                if (pos.distanceTo(playerPos) < 2.5) return true;
            }
        }

        // Check Pacmans (The Gates)
        for (let i = 0; i < this.pacCount; i++) {
            const ob = this.pacData[i];
            let dt = Math.abs(ob.t - playerT);
            if (dt > 0.5) dt = 1.0 - dt;

            if (dt < 0.015) { // Slightly thicker check
                let playerAngle = Math.atan2(playerLocalPos.y, playerLocalPos.x); 
                if (playerAngle < 0) playerAngle += Math.PI * 2;

                const time = this.uniforms.time.value;
                let pacRotation = (time * ob.speed + i) % (Math.PI * 2);
                if (pacRotation < 0) pacRotation += Math.PI * 2;

                // Gap is roughly 1.08 radians (~60 degrees)
                // Solid part is ~5.2 radians
                let relativeAngle = playerAngle - pacRotation;
                while (relativeAngle < 0) relativeAngle += Math.PI * 2;
                while (relativeAngle >= Math.PI * 2) relativeAngle -= Math.PI * 2;

                // Give a little grace period at the edges of the gap?
                // Solid part is 0 to 5.2. Gap is 5.2 to 6.28.
                // If we are in solid part, crash.
                if (relativeAngle < 5.2) {
                    return true;
                }
            }
        }

        return false;
    }
}