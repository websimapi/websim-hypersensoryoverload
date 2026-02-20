import * as THREE from 'three';
import { generatePath, randomRange } from './utils.js';
import { tunnelVertexShader, tunnelFragmentShader } from './shaders.js';

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
        this.initBars();
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
        const geometry = new THREE.BoxGeometry(26, 1.5, 1.5); // Long blade spanning new width
        const material = new THREE.MeshStandardMaterial({ 
            map: this.obstacleTexture,
            color: 0xffff00,
            emissive: 0x333300
        });

        this.fanCount = 20;
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

    initTetrahedrons() {
        const geometry = new THREE.TetrahedronGeometry(2.0);
        const material = new THREE.MeshStandardMaterial({ 
            map: this.obstacleTexture,
            color: 0x00ffaa,
            metalness: 0.9,
            roughness: 0.1,
            emissive: 0x002222
        });
        
        this.tetraCount = 80;
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

    initBars() {
        // Rotating barriers that block the center
        const geometry = new THREE.BoxGeometry(20, 2, 2);
        const material = new THREE.MeshStandardMaterial({ 
            map: this.obstacleTexture, 
            color: 0xff00ff,
            emissive: 0x440044
        });
        
        this.barCount = 30;
        this.bars = new THREE.InstancedMesh(geometry, material, this.barCount);
        this.barData = [];
        
        const dummy = new THREE.Object3D();
        for(let i=0; i<this.barCount; i++) {
            const t = randomRange(0.15, 0.95);
            // Center them mostly
            this.barData.push({ t, speed: randomRange(1, 3) * (Math.random()>0.5?1:-1) });
            this.updateBarMatrix(dummy, i, 0);
        }
        this.scene.add(this.bars);
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

    updateBarMatrix(dummy, index, time) {
        const data = this.barData[index];
        const point = this.path.getPointAt(data.t);
        const tangent = this.path.getTangentAt(data.t);
        
        dummy.position.copy(point);
        dummy.lookAt(point.clone().add(tangent));
        dummy.rotateZ(time * data.speed + index); // Index offset for variety
        
        dummy.updateMatrix();
        this.bars.setMatrixAt(index, dummy.matrix);
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

        // Update bars
        for (let i = 0; i < this.barCount; i++) {
            this.updateBarMatrix(dummy, i, time);
        }
        this.bars.instanceMatrix.needsUpdate = true;
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
                // Reduce fan kill zone, but fans are now larger. 
                // Just check if we are hitting the central blade area.
                // Simple check: if close to plane of fan (dt is small), check distance to center
                // But blades are rotating. Let's just make the hub dangerous and tips dangerous?
                // For simplicity: Fan is a "Wall" with holes. 
                // Let's just assume if you are close to the fan plane, you are safe only at specific angles?
                // Too complex. Let's just make the Hub lethal.
                if (point.distanceTo(playerPos) < 4.0) { 
                     return true;
                }
            }
        }

        // Check Tetras
        for (let i = 0; i < this.tetraCount; i++) {
            const ob = this.tetraData[i];
            let dt = Math.abs(ob.t - playerT);
            if (dt > 0.5) dt = 1.0 - dt;

            if (dt < checkThreshold) {
                // Precise check
                const dummy = new THREE.Object3D();
                this.tetras.getMatrixAt(i, dummy.matrix);
                dummy.matrix.decompose(dummy.position, dummy.quaternion, dummy.scale);
                
                if (dummy.position.distanceTo(playerPos) < 3.0) { // Hitbox size
                    return true;
                }
            }
        }

        // Check Bars
        for (let i = 0; i < this.barCount; i++) {
            const ob = this.barData[i];
            let dt = Math.abs(ob.t - playerT);
            if (dt > 0.5) dt = 1.0 - dt;

            if (dt < checkThreshold) {
                // Bars rotate. We can approximate collision by checking distance to center (it spins).
                // If distance < 10 (bar half length) AND distance > 2 (safe zone in middle?) NO.
                // It's a solid bar. You have to go AROUND it.
                // Bar length is 20. Tube radius is 14.
                // So bar spans -10 to 10. There is 4 units of gap on either side of the tube.
                
                // We need to know the bar's orientation to know where the gap is.
                // But since we are updating matrices on the fly, we can just grab the position?
                // No, the rotation is crucial.
                
                // Let's do a simplified check:
                // Get the Bar's "Right" vector in world space.
                const dummy = new THREE.Object3D();
                this.bars.getMatrixAt(i, dummy.matrix);
                dummy.matrix.decompose(dummy.position, dummy.quaternion, dummy.scale);
                
                // Project player pos onto the plane of the bar
                const distToCenter = dummy.position.distanceTo(playerPos);
                
                // If we are close to the bar longitudinally (checked by dt), check if we intersect the bar volume
                // Bar is effectively a line segment rotating.
                // Let's assume if distToCenter < 10.5, we might hit.
                // We need to check if we are "aligned" with the bar.
                // This is hard to do cheaply without raycasting.
                
                // CHEAT: Just treat the bar as a "Cross" of spheres for now to save CPU?
                // No, let's just make it a "Gate" that you have to be at the edge for.
                // If distance to center < 9.0, you crash.
                // This means the bar is spinning fast enough to be a disc effectively.
                if (distToCenter < 9.0) {
                     return true;
                }
            }
        }

        return false;
    }
}