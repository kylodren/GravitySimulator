import type { Body } from './types';
import { Vector2 } from './Vector2';

export class PhysicsEngine {
    private G: number = 1000000.0; // Gravitational constant (high value for fast, responsive gameplay)
    private softening: number = 5; // Softening parameter to prevent singularities

    update(bodies: Body[], dt: number, allowSameTypeInteraction: boolean = true) {
        // 1. Calculate forces and update velocities
        for (let i = 0; i < bodies.length; i++) {
            let acceleration = new Vector2(0, 0);

            for (let j = 0; j < bodies.length; j++) {
                if (i === j) continue;

                const bodyA = bodies[i];
                const bodyB = bodies[j];
                if (!bodyA || !bodyB) continue;

                // Skip interaction if same-type interaction is disabled and both bodies have the same color
                if (!allowSameTypeInteraction && bodyA.color === bodyB.color) continue;

                const direction = bodyB.position.sub(bodyA.position);
                const distance = direction.mag();

                // F = G * m1 * m2 / r^2
                // a = F / m1 = G * m2 / r^2
                // We add a softening parameter to avoid infinite forces at r=0
                let forceMagnitude = (this.G * bodyB.mass) / (Math.pow(distance, 2) + Math.pow(this.softening, 2));
                
                // Reduce same-type interactions by 10x
                if (bodyA.color === bodyB.color) {
                    forceMagnitude *= 0.05;
                }

                const force = direction.normalize().mult(forceMagnitude);
                acceleration = acceleration.add(force);
            }

            const currentBody = bodies[i];
            if (currentBody) {
                currentBody.velocity = currentBody.velocity.add(acceleration.mult(dt));
            }
        }

        // 2. Update positions (skip static bodies)
        for (let i = 0; i < bodies.length; i++) {
            const currentBody = bodies[i];
            if (currentBody && !currentBody.isStatic) {
                currentBody.position = currentBody.position.add(currentBody.velocity.mult(dt));
            }
        }

        // 3. Handle Collisions (Naive O(N^2) check)
        this.resolveCollisions(bodies, allowSameTypeInteraction);
    }

    private resolveCollisions(bodies: Body[], allowSameTypeInteraction: boolean = true) {
        const bodiesToRemove: Set<string> = new Set();

        for (let i = 0; i < bodies.length; i++) {
            const bodyA = bodies[i];
            if (!bodyA || bodiesToRemove.has(bodyA.id)) continue;

            for (let j = i + 1; j < bodies.length; j++) {
                const bodyB = bodies[j];
                if (!bodyB || bodiesToRemove.has(bodyB.id)) continue;

                // Skip collision if same-type interaction is disabled and both bodies have the same color
                if (!allowSameTypeInteraction && bodyA.color === bodyB.color) continue;

                const dist = bodyA.position.dist(bodyB.position);
                const minDist = bodyA.radius + bodyB.radius;

                if (dist < minDist) {
                    // Collision detected: Merge smaller into larger
                    // Conservation of momentum: (m1v1 + m2v2) / (m1 + m2)

                    const newMass = bodyA.mass + bodyB.mass;
                    const newVel = bodyA.velocity.mult(bodyA.mass).add(bodyB.velocity.mult(bodyB.mass)).div(newMass);

                    // New position is weighted average of positions
                    const newPos = bodyA.position.mult(bodyA.mass).add(bodyB.position.mult(bodyB.mass)).div(newMass);

                    // New radius (assuming constant density, volume adds up)
                    // V = 4/3 * pi * r^3 -> r ~ cube_root(m)
                    // Simplified: r_new = (r1^3 + r2^3)^(1/3)
                    const newRadius = Math.pow(Math.pow(bodyA.radius, 3) + Math.pow(bodyB.radius, 3), 1.0 / 3.0);

                    // Update bodyA to become the merged body
                    bodyA.mass = newMass;
                    bodyA.velocity = newVel;
                    bodyA.position = newPos;
                    bodyA.radius = newRadius;

                    // If bodyB was larger, maybe take its color? For now keep bodyA's color or blend?
                    // Let's keep the color of the more massive object
                    if (bodyB.mass > bodyA.mass) {
                        bodyA.color = bodyB.color;
                    }

                    // Mark bodyB for removal
                    bodiesToRemove.add(bodyB.id);
                }
            }
        }

        // Remove merged bodies
        if (bodiesToRemove.size > 0) {
            for (let i = bodies.length - 1; i >= 0; i--) {
                const body = bodies[i];
                if (body && bodiesToRemove.has(body.id)) {
                    bodies.splice(i, 1);
                }
            }
        }
    }

    // Simulate a trajectory for a body without affecting the actual simulation
    predictTrajectory(bodies: Body[], subject: Body, steps: number, dt: number, allowSameTypeInteraction: boolean = true): Vector2[] {
        const path: Vector2[] = [];

        // Clone bodies to avoid modifying actual state - treat as static gravitational field
        const simBodies = bodies.map(b => ({ ...b, position: b.position.clone(), velocity: b.velocity.clone() }));
        const simSubject = { ...subject, position: subject.position.clone(), velocity: subject.velocity.clone() };

        // DON'T add subject to simBodies - we want to predict its path through a static field
        // This prevents the origin from appearing to drift during prediction

        // Find the dominant gravitational body (largest mass) for orbit detection
        let dominantBody: Body | null = null;
        let maxMass = 0;
        for (const body of simBodies) {
            if (body.mass > maxMass) {
                maxMass = body.mass;
                dominantBody = body;
            }
        }

        // Track angle for orbit completion detection
        let initialAngle: number | null = null;
        let totalAngleChange = 0;
        let previousAngle: number | null = null;
        const minSteps = 10; // Minimum steps before checking for orbit completion

        for (let step = 0; step < steps; step++) {
            // Calculate forces on simSubject from the static field
            let acceleration = new Vector2(0, 0);

            for (const body of simBodies) {
                // Skip interaction if same-type interaction is disabled and bodies have same mass
                if (!allowSameTypeInteraction && body.mass === simSubject.mass) {
                    continue;
                }
                
                const direction = body.position.sub(simSubject.position);
                const distance = direction.mag();
                let forceMagnitude = (this.G * body.mass) / (Math.pow(distance, 2) + Math.pow(this.softening, 2));
                
                // Reduce same-type interactions by 10x
                if (body.mass === simSubject.mass) {
                    forceMagnitude *= 0.1;
                }
                
                const force = direction.normalize().mult(forceMagnitude);
                acceleration = acceleration.add(force);
            }

            // Update subject position and velocity
            simSubject.velocity = simSubject.velocity.add(acceleration.mult(dt));
            simSubject.position = simSubject.position.add(simSubject.velocity.mult(dt));

            // Store position for rendering
            path.push(simSubject.position.clone());

            // Check for orbit completion around dominant body
            if (dominantBody && step > minSteps) {
                const toSubject = simSubject.position.sub(dominantBody.position);
                const currentAngle = Math.atan2(toSubject.y, toSubject.x);

                if (initialAngle === null) {
                    initialAngle = currentAngle;
                    previousAngle = currentAngle;
                } else if (previousAngle !== null) {
                    // Calculate angle change, handling wrap-around at ±π
                    let angleDelta = currentAngle - previousAngle;
                    
                    // Normalize angle delta to [-π, π]
                    if (angleDelta > Math.PI) {
                        angleDelta -= 2 * Math.PI;
                    } else if (angleDelta < -Math.PI) {
                        angleDelta += 2 * Math.PI;
                    }
                    
                    totalAngleChange += angleDelta;
                    previousAngle = currentAngle;

                    // Check if we've completed one full orbit (360 degrees = 2π radians)
                    if (Math.abs(totalAngleChange) >= 2 * Math.PI) {
                        break;
                    }
                }
            }
        }

        return path;
    }
}
