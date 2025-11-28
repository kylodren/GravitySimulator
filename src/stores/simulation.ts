import { defineStore } from 'pinia';
import { ref } from 'vue';
import type { Body } from '../core/types';
import { PhysicsEngine } from '../core/PhysicsEngine';
import { Vector2 } from '../core/Vector2';

export const useSimulationStore = defineStore('simulation', () => {
    const bodies = ref<Body[]>([]);
    const isPaused = ref(false);
    const timeScale = ref(1.0); // Default time scale (use G for speed instead of high time scales)
    const physicsEngine = new PhysicsEngine();

    // Mass presets for different body types
    const massPresets = {
        asteroid: { mass: 1, radius: 3, color: '#808080', name: 'Asteroid' },
        planet: { mass: 10, radius: 8, color: '#2196F3', name: 'Planet' },
        sun: { mass: 100, radius: 20, color: '#FFC107', name: 'Sun' },
        blackhole: { mass: 10000, radius: 25, color: '#1A1A1A', name: 'Black Hole' }
    };

    const creationSettings = ref({
        mass: 10,
        radius: 8,
        color: '#2196F3',
        isStatic: true
    });

    const showTrails = ref(true); // Toggle for showing trails
    const allowSameTypeInteraction = ref(false); // If false, same body types don't interact
    const showIntroTour = ref(true); // Control intro tour visibility

    // Actions
    function addBody(body: Body) {
        body.trail = []; // Initialize empty trail
        if (body.isStatic === undefined) {
            body.isStatic = creationSettings.value.isStatic;
        }
        bodies.value.push(body);
    }

    function update(dt: number) {
        if (isPaused.value) return;
        physicsEngine.update(bodies.value, dt * timeScale.value, allowSameTypeInteraction.value);
    }

    function reset() {
        bodies.value = [];
    }

    function toggleTrails() {
        showTrails.value = !showTrails.value;
        // Clear existing trails when disabling
        if (!showTrails.value) {
            for (const body of bodies.value) {
                body.trail = [];
            }
        }
    }

    function removeBody(id: string) {
        const index = bodies.value.findIndex(b => b.id === id);
        if (index !== -1) {
            bodies.value.splice(index, 1);
        }
    }

    function predictPath(startPos: Vector2, velocity: Vector2, mass: number, steps: number = 300, dt: number = 0.1): Vector2[] {
        const tempBody: Body = {
            id: 'ghost',
            position: startPos,
            velocity: velocity,
            mass: mass,
            radius: 1,
            color: '#fff'
        };
        return physicsEngine.predictTrajectory(bodies.value, tempBody, steps, dt * timeScale.value, allowSameTypeInteraction.value);
    }

    function completeTour() {
        showIntroTour.value = false;
    }

    return {
        bodies,
        isPaused,
        timeScale,
        creationSettings,
        massPresets,
        showTrails,
        allowSameTypeInteraction,
        showIntroTour,
        addBody,
        update,
        reset,
        removeBody,
        predictPath,
        toggleTrails,
        completeTour
    };
});
