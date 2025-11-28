import { defineStore } from 'pinia';
import { ref } from 'vue';
import { Vector2 } from '../core/Vector2';

export const useCameraStore = defineStore('camera', () => {
    // Detect mobile/touch device and start zoomed out 2 steps (0.9 * 0.9 = 0.81)
    const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    const initialZoom = isTouchDevice ? 0.729 : 1.0;
    
    const offset = ref(new Vector2(0, 0));
    const zoom = ref(initialZoom);
    const lockedBodyId = ref<string | null>(null);

    function pan(delta: Vector2) {
        if (lockedBodyId.value) return; // Disable manual pan if locked
        offset.value = offset.value.add(delta);
    }

    function setZoom(newZoom: number) {
        zoom.value = Math.max(0.01, Math.min(newZoom, 10.0));
    }

    function lockToBody(id: string | null) {
        lockedBodyId.value = id;
    }

    return {
        offset,
        zoom,
        lockedBodyId,
        pan,
        setZoom,
        lockToBody
    };
});
