<template>
  <v-app>
    <v-main style="padding: 0; height: 100vh;">
      <GameCanvas />
      <SimulationControls />
      <IntroTour 
        v-if="simulationStore.showIntroTour" 
        @tour-complete="simulationStore.completeTour()"
      />
    </v-main>
  </v-app>
</template>

<script setup lang="ts">
import GameCanvas from './components/GameCanvas.vue';
import SimulationControls from './components/SimulationControls.vue';
import IntroTour from './components/IntroTour.vue';
import { useSimulationStore } from './stores/simulation';

const simulationStore = useSimulationStore();
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
