<template>
  <div>
    <!-- Compact Top Bar Controls -->
    <div class="top-bar-container" v-show="isVisible">
      <v-card class="pa-2" elevation="4" color="surface">
      <div class="controls-wrapper">
        
        <!-- Left: Title and Simulation Controls -->
        <div class="controls-section controls-left">
          <h1 class="app-title">Orbits</h1>
          <v-divider vertical class="divider-desktop"></v-divider>
          <div class="d-flex align-center flex-wrap" style="gap: 6px;">
          <v-tooltip location="bottom">
            <template v-slot:activator="{ props }">
              <v-btn
                v-bind="props"
                :icon="simulationStore.isPaused ? 'mdi-play' : 'mdi-pause'"
                @click="simulationStore.isPaused = !simulationStore.isPaused"
                :color="simulationStore.isPaused ? 'success' : 'warning'"
                size="small"
                variant="tonal"
              ></v-btn>
            </template>
            <span>{{ simulationStore.isPaused ? 'Play' : 'Pause' }} (Space)</span>
          </v-tooltip>
          <v-tooltip location="bottom">
            <template v-slot:activator="{ props }">
              <v-btn
                v-bind="props"
                icon="mdi-delete-sweep"
                @click="simulationStore.reset()"
                color="error"
                size="small"
                variant="tonal"
              ></v-btn>
            </template>
            <span>Clear All (X)</span>
          </v-tooltip>
          <v-tooltip location="bottom">
            <template v-slot:activator="{ props }">
              <v-btn
                v-bind="props"
                :icon="simulationStore.showTrails ? 'mdi-chart-line-variant' : 'mdi-chart-line-variant'"
                @click="simulationStore.toggleTrails()"
                :color="simulationStore.showTrails ? 'primary' : 'default'"
                size="small"
                variant="tonal"
              ></v-btn>
            </template>
            <span>{{ simulationStore.showTrails ? 'Hide' : 'Show' }} Trails (T)</span>
          </v-tooltip>
          <v-tooltip location="bottom">
            <template v-slot:activator="{ props }">
              <v-btn
                v-bind="props"
                icon="mdi-magnet-on"
                @click="simulationStore.allowSameTypeInteraction = !simulationStore.allowSameTypeInteraction"
                :color="simulationStore.allowSameTypeInteraction ? 'primary' : 'default'"
                size="small"
                variant="tonal"
              ></v-btn>
            </template>
            <span>Same-Type Interaction: {{ simulationStore.allowSameTypeInteraction ? 'On' : 'Off' }}</span>
          </v-tooltip>
          </div>
        </div>

        <!-- Center: Speed Control -->
        <div class="controls-section controls-center">
          <v-tooltip location="bottom">
            <template v-slot:activator="{ props }">
              <span v-bind="props" class="speed-label">Speed:</span>
            </template>
            <span>← Slower | Faster →</span>
          </v-tooltip>
          <v-chip-group
            v-model="selectedSpeedIndex"
            @update:model-value="updateTimeScale"
            mandatory
            selected-class="speed-chip-active"
            color="primary"
          >
            <v-chip value="0.25" size="x-small">0.25x</v-chip>
            <v-chip value="0.5" size="x-small">0.5x</v-chip>
            <v-chip value="1.0" size="x-small">1.0x</v-chip>
            <v-chip value="1.5" size="x-small">1.5x</v-chip>
            <v-chip value="2.0" size="x-small">2.0x</v-chip>
            <v-chip value="3.0" size="x-small">3.0x</v-chip>
          </v-chip-group>
        </div>

        <!-- Right: Body Type Selection -->
        <div class="controls-section controls-right">
          <div class="d-flex" style="gap: 4px;">
            <div
              class="mass-option-compact"
              :class="{ 'mass-option-active': selectedMassType === 'asteroid' }"
              @click="selectMassType('asteroid')"
              data-body-type="asteroid"
            >
              <AsteroidIcon :size="32" />
            </div>
            <div
              class="mass-option-compact"
              :class="{ 'mass-option-active': selectedMassType === 'planet' }"
              @click="selectMassType('planet')"
              data-body-type="planet"
            >
              <PlanetIcon :size="32" />
            </div>
            <div
              class="mass-option-compact"
              :class="{ 'mass-option-active': selectedMassType === 'sun' }"
              @click="selectMassType('sun')"
              data-body-type="sun"
            >
              <SunIcon :size="32" />
            </div>
            <div
              class="mass-option-compact"
              :class="{ 'mass-option-active': selectedMassType === 'blackhole' }"
              @click="selectMassType('blackhole')"
              data-body-type="blackhole"
            >
              <BlackHoleIcon :size="32" />
            </div>
          </div>
          <v-divider vertical class="divider-desktop"></v-divider>
          <div class="d-flex align-center" style="gap: 6px;">
            <span class="switch-label-compact">Fixed</span>
            <v-switch
              v-model="simulationStore.creationSettings.isStatic"
              hide-details
              density="compact"
              color="primary"
              inset
              class="compact-switch"
            ></v-switch>
          </div>
        </div>
      </div>
    </v-card>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useSimulationStore } from '../stores/simulation';

const isVisible = ref(true);
import AsteroidIcon from './AsteroidIcon.vue';
import PlanetIcon from './PlanetIcon.vue';
import SunIcon from './SunIcon.vue';
import BlackHoleIcon from './BlackHoleIcon.vue';

const simulationStore = useSimulationStore();
const selectedMassType = ref<'asteroid' | 'planet' | 'sun' | 'blackhole'>('sun');
const selectedSpeedIndex = ref('1.0');

const selectMassType = (type: 'asteroid' | 'planet' | 'sun' | 'blackhole') => {
  selectedMassType.value = type;
  const preset = simulationStore.massPresets[type];
  simulationStore.creationSettings.mass = preset.mass;
  simulationStore.creationSettings.radius = preset.radius;
  simulationStore.creationSettings.color = preset.color;
  // Don't touch isStatic - let user control it
};

const updateTimeScale = (value: string) => {
  simulationStore.timeScale = parseFloat(value);
};

const speedOptions = ['0.25', '0.5', '1.0', '1.5', '2.0', '3.0'];

const increaseSpeed = () => {
  const currentIndex = speedOptions.indexOf(selectedSpeedIndex.value);
  if (currentIndex < speedOptions.length - 1) {
    const newSpeed = speedOptions[currentIndex + 1];
    if (newSpeed) {
      selectedSpeedIndex.value = newSpeed;
      updateTimeScale(selectedSpeedIndex.value);
    }
  }
};

const decreaseSpeed = () => {
  const currentIndex = speedOptions.indexOf(selectedSpeedIndex.value);
  if (currentIndex > 0) {
    const newSpeed = speedOptions[currentIndex - 1];
    if (newSpeed) {
      selectedSpeedIndex.value = newSpeed;
      updateTimeScale(selectedSpeedIndex.value);
    }
  }
};

// Keyboard shortcuts
const handleKeyDown = (e: KeyboardEvent) => {
  // Ignore if typing in an input field
  if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
  
  switch(e.key.toLowerCase()) {
    case ' ':
      e.preventDefault();
      simulationStore.isPaused = !simulationStore.isPaused;
      break;
    case 't':
      e.preventDefault();
      simulationStore.toggleTrails();
      break;
    case 'x':
      e.preventDefault();
      simulationStore.reset();
      break;
    case 'arrowright':
      e.preventDefault();
      increaseSpeed();
      break;
    case 'arrowleft':
      e.preventDefault();
      decreaseSpeed();
      break;
  }
};

// Add keyboard listener on mount
import { onMounted, onUnmounted } from 'vue';
onMounted(() => {
  window.addEventListener('keydown', handleKeyDown);
});

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeyDown);
});

// Initialize with sun preset (without resetting isStatic)
selectMassType('sun');
</script>

<style scoped>
.top-bar-container {
  position: absolute;
  top: 0;
  left: 0;
  z-index: 100;
  width: 100%;
}

.controls-wrapper {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  max-width: 1600px;
  margin: 0 auto;
  gap: 12px;
}

.controls-section {
  display: flex;
  align-items: center;
  gap: 8px;
}

.controls-left {
  gap: 12px;
}

.controls-center {
  gap: 4px;
}

.controls-right {
  gap: 8px;
}

/* Mobile responsive styles */
@media (max-width: 768px) {
  .controls-wrapper {
    flex-direction: column;
    align-items: stretch;
    gap: 8px;
  }
  
  .controls-section {
    justify-content: center;
    flex-wrap: wrap;
  }
  
  .controls-left {
    order: 1;
  }
  
  .controls-right {
    order: 2;
  }
  
  .controls-center {
    order: 3;
  }
  
  .divider-desktop {
    display: none;
  }
  
  .app-title {
    font-size: 1.2rem;
  }
}

.speed-chip-active {
  font-weight: 700;
}

.speed-label {
  font-size: 12px;
  font-weight: 600;
  opacity: 0.8;
  margin-right: 4px;
}

.switch-label-compact {
  font-size: 11px;
  font-weight: 500;
  opacity: 0.8;
}

.mass-option-compact {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
  border: 2px solid transparent;
  background: rgba(255, 255, 255, 0.03);
}

.mass-option-compact:hover {
  background: rgba(255, 255, 255, 0.08);
  transform: scale(1.05);
}

.mass-option-active {
  border-color: rgb(var(--v-theme-primary));
  background: rgba(var(--v-theme-primary), 0.15);
}

.compact-switch {
  transform: scale(0.8);
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
  margin: 0;
  padding: 0;
}
</style>
