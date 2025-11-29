<template>
  <div v-if="isActive" class="tour-overlay">
    <!-- Blocking layer to prevent interaction -->
    <div class="interaction-blocker"></div>
    
    <!-- Demo Slingshot Visualization -->
    <svg v-if="demoSlingshotStart && demoSlingshotEnd" class="demo-overlay">
      <!-- Ghost path (predicted trajectory) - solid bright red line -->
      <polyline
        v-if="demoGhostPath.length > 0"
        :points="demoGhostPathPoints"
        fill="none"
        stroke="rgba(255, 50, 50, 1)"
        stroke-width="3"
      />
      
      <!-- Slingshot line -->
      <line
        :x1="worldToScreenX(demoSlingshotStart.x)"
        :y1="worldToScreenY(demoSlingshotStart.y)"
        :x2="worldToScreenX(demoSlingshotEnd.x)"
        :y2="worldToScreenY(demoSlingshotEnd.y)"
        stroke="rgba(255, 100, 100, 0.8)"
        stroke-width="3"
      />
      
      <!-- Start point circle -->
      <circle
        :cx="worldToScreenX(demoSlingshotStart.x)"
        :cy="worldToScreenY(demoSlingshotStart.y)"
        r="8"
        fill="rgba(255, 100, 100, 0.6)"
        stroke="rgba(255, 100, 100, 1)"
        stroke-width="2"
      />
    </svg>
    
    <!-- Callout Box -->
    <div 
      v-if="calloutReady"
      class="tour-callout"
      :style="calloutPosition"
    >
      <div class="callout-content">
        <p class="callout-text">{{ currentStepMessage }}</p>
        <v-btn 
          @click="nextStep" 
          color="primary" 
          variant="elevated"
          size="small"
        >
          {{ isLastStep ? 'Finish Tour' : 'Next' }}
        </v-btn>
        <v-btn
          v-if="currentStep === 0 && hasCompletedBefore"
          @click="skipTour"
          color="grey"
          variant="text"
          size="small"
        >
          Skip
        </v-btn>
      </div>
      <!-- Arrow pointer (hidden for steps 3 and 4) -->
      <div v-if="currentStep < 3" class="callout-arrow" :class="arrowPosition"></div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useSimulationStore } from '../stores/simulation';
import { useCameraStore } from '../stores/camera';
import { Vector2 } from '../core/Vector2';

const TOUR_COMPLETED_KEY = 'orbits_tour_completed';
const TOUR_NEVER_SHOW_KEY = 'orbits_tour_never_show';

const simulationStore = useSimulationStore();
const cameraStore = useCameraStore();
const currentStep = ref(0);
const isActive = ref(true);
const hasCompletedBefore = ref(false);
const calloutReady = ref(false);

const steps = [
  {
    message: 'First, place bodies',
    targetSelector: '[data-body-type="sun"]',
    arrowDir: 'top'
  },
  {
    message: 'Sun Placed (fixed option)',
    targetSelector: '.canvas-container',
    arrowDir: 'top',
    centerScreen: true
  },
  {
    message: 'Select Asteroid',
    targetSelector: '[data-body-type="asteroid"]',
    arrowDir: 'top'
  },
  {
    message: 'Click and drag at a tangent to launch',
    mobileMessage: 'Click and drag at a tangent to launch',
    desktopMessage: 'Click and drag at a tangent to launch (hold shift for multiple)',
    targetSelector: '.canvas-container',
    arrowDir: 'left',
    rightSide: true,
    rightOffset: 'calc(25% - 50px)'
  },
  {
    message: 'Click-Drag your own! Have fun exploring orbits!',
    targetSelector: '.canvas-container',
    arrowDir: 'left',
    rightSide: true,
    rightOffset: '50px'
  }
];

const currentStepMessage = computed(() => {
  const step = steps[currentStep.value];
  if (!step) return '';
  const isMobile = window.innerWidth <= 768;
  if (step.mobileMessage && step.desktopMessage) {
    return isMobile ? step.mobileMessage : step.desktopMessage;
  }
  return step.message || '';
});
const isLastStep = computed(() => currentStep.value === steps.length - 1);
const arrowPosition = computed(() => steps[currentStep.value]?.arrowDir || 'top');

// Helper functions for coordinate conversion
const worldToScreenX = (worldX: number): number => {
  const canvas = document.querySelector('.canvas-container canvas') as HTMLCanvasElement;
  if (!canvas) return 0;
  return (worldX - cameraStore.offset.x) * cameraStore.zoom + canvas.width / 2;
};

const worldToScreenY = (worldY: number): number => {
  const canvas = document.querySelector('.canvas-container canvas') as HTMLCanvasElement;
  if (!canvas) return 0;
  return (worldY - cameraStore.offset.y) * cameraStore.zoom + canvas.height / 2;
};

// Computed property for ghost path points
const demoGhostPathPoints = computed(() => {
  return demoGhostPath.value.map(p => `${worldToScreenX(p.x)},${worldToScreenY(p.y)}`).join(' ');
});

const calloutPosition = ref<Record<string, string>>({
  top: '50%',
  left: '50%',
  transform: 'translate(-50%, -50%)'
});

const updateCalloutPosition = () => {
  const step = steps[currentStep.value];
  if (!step) return;
  
  const isMobile = window.innerWidth <= 768;

  if (step.centerScreen) {
    // Position below the sun in center of screen
    calloutPosition.value = {
      top: '55%',
      left: '50%',
      right: 'auto',
      transform: 'translateX(-50%)'
    };
  } else if (step.rightSide) {
    // Position horizontally centered
    calloutPosition.value = {
      top: '80%',
      left: '50%',
      right: 'auto',
      transform: 'translate(-50%, -50%)'
    };
  } else {
    // Position relative to target element
    const target = document.querySelector(step.targetSelector);
    if (target) {
      const rect = target.getBoundingClientRect();
      
      // On mobile, use fixed positioning below the control panel
      if (isMobile) {
        // Wait for control panel animation to complete (0.3s), then calculate position
        setTimeout(() => {
          const controlPanel = document.querySelector('.top-bar-container');
          const panelHeight = controlPanel ? controlPanel.getBoundingClientRect().bottom : 200;
          
          // Special positioning for asteroid selection (step 2)
          if (currentStep.value === 2) {
            calloutPosition.value = {
              top: `${panelHeight + -53}px`,
              left: '32%',
              right: 'auto',
              transform: 'translateX(-50%)'
            };
          } else {
            // Default positioning for sun selection (step 0)
            calloutPosition.value = {
              top: `${panelHeight + -53}px`,
              left: '57%',
              right: 'auto',
              transform: 'translateX(-50%)'
            };
          }
        }, 350); // Wait for animation + small buffer
      } else {
        calloutPosition.value = {
          top: `${rect.bottom + 20}px`,
          left: `${rect.left + rect.width / 2}px`,
          right: 'auto',
          transform: 'translateX(-50%)'
        };
      }
    }
  }
};

const calculateCircularOrbitVelocity = (sunPos: Vector2, asteroidPos: Vector2, sunMass: number): Vector2 => {
  // For circular orbit: v = sqrt(G * M / r)
  // G is our gravitational constant from PhysicsEngine
  const G = 1000000.0; // Match the G in PhysicsEngine
  const r = asteroidPos.dist(sunPos);
  
  // Calculate orbital speed
  const speed = Math.sqrt(G * sunMass / r);
  
  // Get direction perpendicular to radius (tangent for circular orbit)
  const toAsteroid = asteroidPos.sub(sunPos).normalize();
  // Rotate 90 degrees counter-clockwise for prograde orbit
  const tangent = new Vector2(-toAsteroid.y, toAsteroid.x);
  
  return tangent.mult(speed);
};

// Animated slingshot demonstration
const demoSlingshotStart = ref<Vector2 | null>(null);
const demoSlingshotEnd = ref<Vector2 | null>(null);
const demoGhostPath = ref<Vector2[]>([]);

const animateSlingshotGesture = async (startPos: Vector2, finalVelocity: Vector2): Promise<void> => {
  const SLINGSHOT_VELOCITY = 2.0;
  
  // Calculate the actual drag length needed for the final velocity
  const velocityMagnitude = finalVelocity.mag();
  const dragLength = velocityMagnitude / SLINGSHOT_VELOCITY;
  
  // Make the visual drag go directly to the right (0 degrees)
  const dragEndPos = new Vector2(startPos.x + dragLength, startPos.y);
  
  // Animate the drag motion over 1.5 seconds
  const duration = 1500; // ms
  const steps = 30; // smooth animation
  const stepTime = duration / steps;
  
  demoSlingshotStart.value = startPos;
  
  for (let i = 0; i <= steps; i++) {
    const t = i / steps; // 0 to 1
    
    // Interpolate from start to drag end position (horizontally to the right)
    const currentEnd = new Vector2(
      startPos.x + (dragEndPos.x - startPos.x) * t,
      startPos.y + (dragEndPos.y - startPos.y) * t
    );
    
    demoSlingshotEnd.value = currentEnd;
    
    // For the preview, use a scaled version of the actual final velocity
    // so it shows the correct orbital path, not the path from the visual drag direction
    const velocity = finalVelocity.mult(t);
    
    // Predict the trajectory with high resolution for smooth curve
    const fullPath = simulationStore.predictPath(
      startPos,
      velocity,
      simulationStore.creationSettings.mass,
      1000,  // More steps
      0.05   // Smaller time step for smoother curve
    );
    
    // Show only first 200 points for a short, smooth preview arc
    demoGhostPath.value = fullPath.slice(0, 200);
    
    await new Promise(resolve => setTimeout(resolve, stepTime));
  }
  
  // Hold the final position for a moment
  await new Promise(resolve => setTimeout(resolve, 500));
  
  // Clear the demo visualization
  demoSlingshotStart.value = null;
  demoSlingshotEnd.value = null;
  demoGhostPath.value = [];
};

const nextStep = async () => {
  const step = currentStep.value;
  
  // Hide callout during transition
  calloutReady.value = false;
  await new Promise(resolve => setTimeout(resolve, 100));
  
  // Execute step actions before moving to next
  switch (step) {
    case 0:
      // Step 1 -> 2: Place sun at center (skip if already exists)
      currentStep.value++;
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Only place sun if one doesn't already exist
      const hasSun = simulationStore.bodies.some(b => b.bodyType === 'sun');
      if (!hasSun) {
        simulationStore.creationSettings.isStatic = true;
        const preset = simulationStore.massPresets.sun;
        simulationStore.addBody({
          id: crypto.randomUUID(),
          position: new Vector2(0, 0),
          velocity: new Vector2(0, 0),
          mass: preset.mass,
          radius: preset.radius,
          color: preset.color,
          isStatic: true,
          bodyType: 'sun'
        });
      }
      updateCalloutPosition();
      await new Promise(resolve => setTimeout(resolve, 400));
      calloutReady.value = true;
      break;
      
    case 1:
      // Step 2 -> 3: Select asteroid
      currentStep.value++;
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Programmatically select asteroid and trigger UI update
      const asteroidPreset = simulationStore.massPresets.asteroid;
      simulationStore.creationSettings.mass = asteroidPreset.mass;
      simulationStore.creationSettings.radius = asteroidPreset.radius;
      simulationStore.creationSettings.color = asteroidPreset.color;
      simulationStore.creationSettings.isStatic = false;
      
      // Trigger click on asteroid icon to update UI selection
      await new Promise(resolve => setTimeout(resolve, 50));
      const asteroidIcon = document.querySelector('[data-body-type="asteroid"]');
      if (asteroidIcon instanceof HTMLElement) {
        asteroidIcon.click();
      }
      
      updateCalloutPosition();
      await new Promise(resolve => setTimeout(resolve, 400));
      calloutReady.value = true;
      break;
      
    case 2:
      // Step 3 -> 4: Show launch instruction
      currentStep.value++;
      updateCalloutPosition();
      await new Promise(resolve => setTimeout(resolve, 100));
      calloutReady.value = true;
      break;
      
    case 3:
      // Step 4: Perform automated demo with animated slingshot
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Place asteroid at a nice distance from sun
      const sunBody = simulationStore.bodies.find(b => b.isStatic);
      if (sunBody) {
        const sunPos = sunBody.position;
        const distance = 200; // Nice orbital distance
        
        // Position directly below the sun (horizontally centered)
        const asteroidPos = new Vector2(
          sunPos.x,
          sunPos.y + distance
        );
        
        // Calculate perfect circular orbit velocity
        const velocity = calculateCircularOrbitVelocity(
          sunPos,
          asteroidPos,
          sunBody.mass
        );
        
        // Animate the slingshot gesture before launch
        await animateSlingshotGesture(asteroidPos, velocity);
        
        // Debug logging
        console.log('=== Orbital Launch Debug Info ===');
        console.log('Sun Position:', { x: sunPos.x, y: sunPos.y });
        console.log('Sun Mass:', sunBody.mass);
        console.log('Asteroid Position:', { x: asteroidPos.x, y: asteroidPos.y });
        console.log('Distance from Sun:', distance);
        console.log('Calculated Velocity:', { x: velocity.x, y: velocity.y });
        console.log('Velocity Magnitude:', velocity.mag());
        console.log('Asteroid Mass:', simulationStore.creationSettings.mass);
        console.log('G (gravitational constant):', 1000000.0);
        console.log('Expected orbital speed sqrt(G*M/r):', Math.sqrt(1000000.0 * sunBody.mass / distance));
        
        // Place the asteroid
        simulationStore.addBody({
          id: crypto.randomUUID(),
          position: asteroidPos,
          velocity: velocity,
          mass: simulationStore.creationSettings.mass,
          radius: simulationStore.creationSettings.radius,
          color: simulationStore.creationSettings.color,
          bodyType: 'asteroid'
        });
        
        // Enable trails to show the orbit
        if (!simulationStore.showTrails) {
          simulationStore.toggleTrails();
        }
      }
      
      // Move to final step
      currentStep.value++;
      updateCalloutPosition();
      break;
      
    case 4:
      // Step 5: Finish tour
      sessionStorage.setItem(TOUR_COMPLETED_KEY, 'true');
      isActive.value = false;
      emit('tour-complete');
      break;
  }
};

const skipTour = () => {
  // Set never show flag and complete tour
  sessionStorage.setItem(TOUR_NEVER_SHOW_KEY, 'true');
  isActive.value = false;
  emit('tour-complete');
};

const emit = defineEmits(['tour-complete']);

onMounted(() => {
  // Delay to ensure DOM is fully rendered
  setTimeout(() => {
    // Select sun at the start of the tour
    const sunIcon = document.querySelector('[data-body-type="sun"]');
    if (sunIcon instanceof HTMLElement) {
      sunIcon.click();
    }
    
    updateCalloutPosition();
    
    // Show callout after positioning is complete (including inner setTimeout in updateCalloutPosition)
    setTimeout(() => {
      calloutReady.value = true;
    }, 400); // Wait for updateCalloutPosition's inner setTimeout (350ms) to complete
  }, 200);
  
  window.addEventListener('resize', updateCalloutPosition);
  
  // Check if tour has been completed before
  hasCompletedBefore.value = sessionStorage.getItem(TOUR_COMPLETED_KEY) === 'true';
});

onUnmounted(() => {
  window.removeEventListener('resize', updateCalloutPosition);
});
</script>

<style scoped>
.tour-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  z-index: 1000;
  pointer-events: none;
}

.interaction-blocker {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: auto;
  cursor: not-allowed;
}

.tour-callout {
  position: absolute;
  pointer-events: auto;
  background: rgba(30, 30, 30, 0.95);
  border: 2px solid;
  border-image: linear-gradient(45deg, #2196F3, #82B1FF) 1;
  border-radius: 12px;
  padding: 20px;
  min-width: 280px;
  max-width: 400px;
  box-shadow: 0 8px 32px rgba(33, 150, 243, 0.3);
}

.callout-content {
  display: flex;
  flex-direction: column;
  gap: 16px;
  align-items: center;
}

.callout-text {
  font-size: 1.1rem;
  font-weight: 500;
  color: #FFFFFF;
  text-align: center;
  margin: 0;
  line-height: 1.5;
}

.callout-arrow {
  position: absolute;
  width: 0;
  height: 0;
  border-style: solid;
}

.callout-arrow.top {
  top: -12px;
  left: 50%;
  transform: translateX(-50%);
  border-width: 0 12px 12px 12px;
  border-color: transparent transparent #2196F3 transparent;
}

.callout-arrow.bottom {
  bottom: -12px;
  left: 50%;
  transform: translateX(-50%);
  border-width: 12px 12px 0 12px;
  border-color: #2196F3 transparent transparent transparent;
}

.callout-arrow.left {
  left: -12px;
  top: 50%;
  transform: translateY(-50%);
  border-width: 12px 12px 12px 0;
  border-color: transparent #2196F3 transparent transparent;
}

.demo-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 1;
}

/* Mobile adjustments */
@media (max-width: 768px) {
  .tour-callout {
    min-width: 240px;
    max-width: 90vw;
    padding: 16px;
  }
  
  .callout-text {
    font-size: 1rem;
  }
}
</style>
