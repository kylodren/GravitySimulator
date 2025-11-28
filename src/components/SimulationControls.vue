<template>
  <div>
    <!-- Compact Top Bar Controls -->
    <div class="top-bar-container" v-show="isVisible">
      <v-card class="pa-2" elevation="4" color="surface">
      <div class="controls-wrapper">
        
        <!-- Left: Title and Simulation Controls -->
        <div class="controls-section controls-left">
          <h1 class="app-title" @click="resetAndReload" style="cursor: pointer;">Orbits</h1>
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
          <v-tooltip location="bottom">
            <template v-slot:activator="{ props }">
              <v-btn
                v-bind="props"
                icon="mdi-shimmer"
                @click="cycleEffects"
                :color="simulationStore.enableEffects === 0 ? 'default' : simulationStore.enableEffects === 1 ? 'primary' : 'accent'"
                size="small"
                variant="tonal"
              ></v-btn>
            </template>
            <span>Visual Effects: {{ simulationStore.enableEffects === 0 ? 'Off' : simulationStore.enableEffects === 1 ? 'Normal' : 'Extreme' }} (G)</span>
          </v-tooltip>
          </div>
        </div>

        <!-- Center: Speed and Trail Controls -->
        <div class="controls-section controls-center">
          <!-- Speed Control -->
          <div class="control-group">
            <span class="control-label mb-n3">Speed</span>
            <div class="d-flex align-center">
              <v-btn
                icon="mdi-minus"
                @click="decreaseSpeed"
                size="small"
                variant="text"
              ></v-btn>
              <span class="control-value">{{ selectedSpeedIndex }}x</span>
              <v-btn
                icon="mdi-plus"
                @click="increaseSpeed"
                size="small"
                variant="text"
              ></v-btn>
            </div>
          </div>
          
          
          <!-- Trail Length Control -->
          <div class="control-group">
            <span class="control-label mb-n3">Trail Length</span>
            <div class="d-flex align-center">
              <v-btn
                icon="mdi-minus"
                @click="decreaseTrailLength"
                size="small"
                variant="text"
              ></v-btn>
              <span class="control-value">{{ trailLength }}</span>
              <v-btn
                icon="mdi-plus"
                @click="increaseTrailLength"
                size="small"
                variant="text"
              ></v-btn>
            </div>
          </div>
          
          <!-- Auto Trails Toggle -->
          <v-tooltip location="bottom">
            <template v-slot:activator="{ props }">
              <v-btn
                v-bind="props"
                icon="mdi-sine-wave"
                @click="toggleAutoTrails"
                :color="autoTrails ? 'primary' : 'default'"
                size="small"
                variant="tonal"
              ></v-btn>
            </template>
            <span>Auto Trails: {{ autoTrails ? 'On' : 'Off' }}</span>
          </v-tooltip>
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
              :class="{ 'mass-option-active': selectedMassType === 'comet' }"
              @click="selectMassType('comet')"
              data-body-type="comet"
            >
              <CometIcon :size="32" />
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
    
    <!-- Mobile Toggle Button -->
    <div class="mobile-toggle-container" :class="{ 'controls-hidden': !isVisible }">
      <v-btn
        @click="isVisible = !isVisible"
        :icon="isVisible ? 'mdi-chevron-up' : 'mdi-chevron-down'"
        size="small"
        variant="tonal"
        class="mobile-toggle-btn"
      ></v-btn>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { useSimulationStore } from '../stores/simulation';

const isVisible = ref(true);
import AsteroidIcon from './AsteroidIcon.vue';
import PlanetIcon from './PlanetIcon.vue';
import SunIcon from './SunIcon.vue';
import CometIcon from './CometIcon.vue';

const simulationStore = useSimulationStore();
const selectedMassType = ref<'asteroid' | 'comet' | 'planet' | 'sun'>('sun');
const selectedSpeedIndex = ref('1.0');

// Expose trail length and autoTrails from store for template
const trailLength = computed(() => simulationStore.trailLength);
const autoTrails = computed(() => simulationStore.autoTrails);

const selectMassType = (type: 'asteroid' | 'comet' | 'planet' | 'sun') => {
  selectedMassType.value = type;
  const preset = simulationStore.massPresets[type];
  simulationStore.creationSettings.mass = preset.mass;
  simulationStore.creationSettings.radius = preset.radius;
  simulationStore.creationSettings.color = preset.color;
  simulationStore.creationSettings.bodyType = type;
  // Don't touch isStatic - let user control it
};

const updateTimeScale = (value: string) => {
  simulationStore.timeScale = parseFloat(value);
};

const resetAndReload = () => {
  sessionStorage.clear();
  window.location.reload();
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

const increaseTrailLength = () => {
  simulationStore.trailLength = Math.min(300, simulationStore.trailLength + 10);
};

const decreaseTrailLength = () => {
  simulationStore.trailLength = Math.max(0, simulationStore.trailLength - 10);
};

const cycleEffects = () => {
  simulationStore.enableEffects = (simulationStore.enableEffects + 1) % 3;
};

const toggleAutoTrails = () => {
  simulationStore.autoTrails = !simulationStore.autoTrails;
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
    case 'g':
      e.preventDefault();
      cycleEffects();
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

.control-group {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 0px 4px;
  background: rgba(255, 255, 255, 0.03);
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.08);
}

.control-label {
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  opacity: 0.7;
  color: rgba(255, 255, 255, 0.9);
}

.control-value {
  font-size: 14px;
  font-weight: 600;
  min-width: 40px;
  text-align: center;
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

.mobile-toggle-container {
  display: none;
}

@media (max-width: 768px) {
  .mobile-toggle-container {
    display: flex;
    justify-content: flex-start;
    position: fixed;
    top: 136px;
    left: -2px;
    transform: translateY(-50%);
    z-index: 101;
    pointer-events: none;
    padding-left: 8px;
    transition: top 0.3s ease;
  }
  
  .mobile-toggle-container.controls-hidden {
    top: 30px;
  }
  
  .mobile-toggle-btn {
    pointer-events: auto;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
  }
  
  .top-bar-container {
    transition: transform 0.3s ease, opacity 0.3s ease;
  }
}
</style>
