import { Vector2 } from './Vector2';

export interface TrailPoint {
    position: Vector2;
    velocity: number; // Magnitude of velocity at this point
    relativeSpeed?: number; // Relative speed 0-1 for color-coded trail rendering
}

export interface Particle {
    position: Vector2;
    velocity: Vector2;
    life: number; // 0 to 1, decreases over time
    maxLife: number; // Initial life duration
    size: number;
    color: string;
}

export interface Body {
    id: string;
    position: Vector2;
    velocity: Vector2;
    mass: number;
    radius: number;
    color: string;
    bodyType?: string; // 'asteroid', 'planet', 'sun', 'blackhole', 'comet'
    trail?: TrailPoint[]; // Optional trail of previous positions with velocities
    isStatic?: boolean; // If true, position will not update
    trailMinVel?: number; // Cached minimum velocity in trail
    trailMaxVel?: number; // Cached maximum velocity in trail
}
