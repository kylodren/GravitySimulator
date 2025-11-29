<template>
  <v-app>
    <v-main style="padding: 0; height: 100vh;">
      <GameCanvas />
      <SimulationControls />
      <IntroTour 
        v-if="shouldShowTour && simulationStore.showIntroTour" 
        @tour-complete="simulationStore.completeTour()"
      />
    </v-main>
  </v-app>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import GameCanvas from './components/GameCanvas.vue';
import SimulationControls from './components/SimulationControls.vue';
import IntroTour from './components/IntroTour.vue';
import { useSimulationStore } from './stores/simulation';
import { Vector2 } from './core/Vector2';

const TOUR_NEVER_SHOW_KEY = 'orbits_tour_never_show';

const simulationStore = useSimulationStore();
const shouldShowTour = ref(true);

onMounted(() => {
  // Check if user has opted to never show tour again
  const neverShow = sessionStorage.getItem(TOUR_NEVER_SHOW_KEY) === 'true';
  if (neverShow) {
    shouldShowTour.value = false;
    simulationStore.completeTour();
  }
  
  // Place initial fixed sun in the center
  if (simulationStore.bodies.length === 0) {
    simulationStore.addBody({
      id: crypto.randomUUID(),
      position: new Vector2(0, 0),
      velocity: new Vector2(0, 0),
      mass: 100,
      radius: 20,
      color: '#FFC107',
      bodyType: 'sun',
      isStatic: true
    });
  }
});
</script>

<style>
html, body {
  margin: 0;
  padding: 0;
  overflow: hidden; /* Keep this to prevent scrollbars */
  height: 100%;
}

#app {
  height: 100%;
}

.app-title {
  font-family: 'Orbitron', sans-serif;
  font-weight: 900;
  font-size: 1.5rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  background: linear-gradient(45deg, #2196F3, #82B1FF);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}
</style>
