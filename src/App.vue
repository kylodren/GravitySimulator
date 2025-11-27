<template>
  <v-app>
    <v-main style="padding: 0; height: 100vh;">
      <GameCanvas />
      <SimulationControls />
    </v-main>
  </v-app>
</template>

<script setup lang="ts">
import GameCanvas from './components/GameCanvas.vue';
import SimulationControls from './components/SimulationControls.vue';
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

</style>
