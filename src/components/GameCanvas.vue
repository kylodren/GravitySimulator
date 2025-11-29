<template>
  <div class="canvas-container" ref="container">
    <canvas ref="canvas"></canvas>
    <div class="overlay-ui">
      <!-- We'll add UI controls here later or in a separate component -->
    </div>
    
    <!-- Shift tooltip (desktop only) -->
    <div 
      v-if="isSlingshotting && slingshotStartPos"
      class="slingshot-tooltip"
      :style="{ left: currentMouseScreenPos.x + 20 + 'px', top: currentMouseScreenPos.y - 10 + 'px' }"
    >
      Hold <span class="key">Shift</span> for Multiple
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useSimulationStore } from '../stores/simulation';
import { useCameraStore } from '../stores/camera';
import { Vector2 } from '../core/Vector2';

const container = ref<HTMLDivElement | null>(null);
const canvas = ref<HTMLCanvasElement | null>(null);
const simulationStore = useSimulationStore();
const cameraStore = useCameraStore();

let animationFrameId: number;
let lastTime = 0;

// Particle system for collision sparkles
interface Particle {
  position: Vector2;
  velocity: Vector2;
  life: number;
  maxLife: number;
  size: number;
  color: string;
}
const particles = ref<Particle[]>([]);

// FPS tracking
let fpsFrames = 0;
let fpsLastTime = 0;
let currentFPS = 60;

// Trail length controls
const MIN_TRAIL_LENGTH = 0;
const MAX_TRAIL_LENGTH = 300;
let animationPhase = 0; // 0 to 2π for sine wave
const ANIMATION_SPEED = 0.01; // How fast the animation cycles (higher = faster)

// Slingshot configuration
const SLINGSHOT_VELOCITY_DESKTOP = 2.0; // Velocity multiplier for desktop
const SLINGSHOT_VELOCITY_MOBILE = 4.0; // Velocity multiplier for mobile (2x stronger)

// Detect if we're on a touch device
const isTouchDevice = ref('ontouchstart' in window || navigator.maxTouchPoints > 0);
const SLINGSHOT_VELOCITY = computed(() => isTouchDevice.value ? SLINGSHOT_VELOCITY_MOBILE : SLINGSHOT_VELOCITY_DESKTOP);

// Input handling state
let isDragging = false;
let lastMousePos = new Vector2(0, 0);
let isRightDragging = false;
let lastSpawnTime = 0;
const SPAWN_INTERVAL = 50; // ms between spawns during right-click drag
let lastPredictionTime = 0;
const PREDICTION_INTERVAL = 50; // ms between ghost path predictions (throttle)

const resizeCanvas = () => {
  if (container.value && canvas.value) {
    canvas.value.width = container.value.clientWidth;
    canvas.value.height = container.value.clientHeight;
  }
};

const worldToScreen = (worldPos: Vector2): Vector2 => {
  if (!canvas.value) return new Vector2(0, 0);
  
  const center = new Vector2(canvas.value.width / 2, canvas.value.height / 2);
  
  // Apply camera offset and zoom
  // Screen = (World - CameraOffset) * Zoom + Center
  // If locked, CameraOffset is the locked body's position
  
  let camOffset = cameraStore.offset;
  if (cameraStore.lockedBodyId) {
    const target = simulationStore.bodies.find(b => b.id === cameraStore.lockedBodyId);
    if (target) {
      camOffset = target.position;
    }
  }

  return worldPos.sub(camOffset).mult(cameraStore.zoom).add(center);
};

const screenToWorld = (screenPos: Vector2): Vector2 => {
  if (!canvas.value) return new Vector2(0, 0);
  const center = new Vector2(canvas.value.width / 2, canvas.value.height / 2);
  
  let camOffset = cameraStore.offset;
  if (cameraStore.lockedBodyId) {
    const target = simulationStore.bodies.find(b => b.id === cameraStore.lockedBodyId);
    if (target) {
      camOffset = target.position;
    }
  }

  // World = (Screen - Center) / Zoom + CameraOffset
  return screenPos.sub(center).div(cameraStore.zoom).add(camOffset);
};

// Particle system functions
const spawnCollisionSparkles = (point: Vector2, _bodyA: any, _bodyB: any) => {
  const particleCount = 20 + Math.floor(Math.random() * 20); // 20-40 particles
  
  for (let i = 0; i < particleCount; i++) {
    const angle = (Math.PI * 2 * i) / particleCount + (Math.random() - 0.5) * 0.5;
    const speed = 100 + Math.random() * 200; // Faster sparks: 100-300
    const velocity = new Vector2(
      Math.cos(angle) * speed,
      Math.sin(angle) * speed
    );
    
    // All particles are bright white
    const color = '#FFFFFF';
    
    particles.value.push({
      position: point.clone(),
      velocity,
      life: 1.0,
      maxLife: 0.3 + Math.random() * 0.4, // 0.3-0.7 second lifetime (shorter)
      size: 1 + Math.random() * 2, // 1-3 pixels (smaller, more spark-like)
      color
    });
  }
};

const updateParticles = (dt: number) => {
  particles.value = particles.value.filter(p => {
    // Update position
    p.position = p.position.add(p.velocity.mult(dt));
    
    // Apply friction/drag
    p.velocity = p.velocity.mult(0.98);
    
    // Decrease life
    p.life -= dt / p.maxLife;
    
    // Remove dead particles
    return p.life > 0;
  });
};

const render = (timestamp: number) => {
  if (!canvas.value) return;
  const ctx = canvas.value.getContext('2d');
  if (!ctx) return;

  const dt = (timestamp - lastTime) / 1000; // Delta time in seconds
  lastTime = timestamp;

  // Calculate FPS
  fpsFrames++;
  if (timestamp - fpsLastTime >= 1000) {
    currentFPS = Math.round((fpsFrames * 1000) / (timestamp - fpsLastTime));
    fpsFrames = 0;
    fpsLastTime = timestamp;
  }

  // Trail length management
  if (simulationStore.autoTrails) {
    // Auto trails mode: smoothly animate trail length
    animationPhase += ANIMATION_SPEED;
    if (animationPhase > Math.PI * 2) {
      animationPhase -= Math.PI * 2;
    }
    
    // Use absolute sine wave for smooth oscillation: goes 0->1->0->1
    const sineWave = Math.sin(animationPhase);
    const absValue = Math.abs(sineWave); // 0 to 1 and back, repeatedly
    
    // INVERT so we start at 1 (fast at 0/300) and slow in middle
    const inverted = 1 - absValue; // 1 to 0 and back (1 at edges, 0 in middle)
    
    // Apply power less than 1 to make it even faster at edges
    const easedValue = Math.pow(inverted, 0.3); // Power < 1 makes edges steeper
    
    // Map from [0, 1] to [MIN_TRAIL_LENGTH, MAX_TRAIL_LENGTH]
    simulationStore.trailLength = Math.round(
      MIN_TRAIL_LENGTH + easedValue * (MAX_TRAIL_LENGTH - MIN_TRAIL_LENGTH)
    );
  }

  // Update Physics
  simulationStore.update(dt);
  
  // Check for collisions and spawn sparkle particles (only if 5 or fewer bodies)
  if (simulationStore.bodies.length <= 5) {
    const collisions = simulationStore.checkCollisions();
    for (const collision of collisions) {
      spawnCollisionSparkles(collision.point, collision.bodyA, collision.bodyB);
    }
  }
  
  // Update particles
  updateParticles(dt);
  
  // Trim all trails to match current target length (always, not just auto mode)
  for (const body of simulationStore.bodies) {
    if (body.trail && body.trail.length > simulationStore.trailLength) {
      body.trail = body.trail.slice(-simulationStore.trailLength);
    }
  }

  // Update trails for visible bodies only (performance optimization)
  if (simulationStore.showTrails && canvas.value) {
    const viewportMargin = 100; // Extra margin around viewport
    const viewportMinX = -viewportMargin;
    const viewportMinY = -viewportMargin;
    const viewportMaxX = canvas.value.width + viewportMargin;
    const viewportMaxY = canvas.value.height + viewportMargin;

    for (const body of simulationStore.bodies) {
      const screenPos = worldToScreen(body.position);
      const isVisible = (
        screenPos.x >= viewportMinX && screenPos.x <= viewportMaxX &&
        screenPos.y >= viewportMinY && screenPos.y <= viewportMaxY
      );

      if (isVisible) {
        // Add trail point for visible bodies (except comets)
        if (body.bodyType === 'comet') {
          // Comets never have trails
          if (body.trail && body.trail.length > 0) {
            body.trail = [];
          }
          continue;
        }
        
        if (!body.trail) body.trail = [];
        const currentVel = body.velocity.mag();
        
        // Update system-wide velocity range over time (excluding static bodies)
        const movingBodies = simulationStore.bodies.filter(b => !b.isStatic);
        const allVelocities = movingBodies.map(b => b.velocity.mag());
        const minVelNow = Math.min(...allVelocities);
        const maxVelNow = Math.max(...allVelocities);
        
        // Smooth transitions: use exponential moving average (95% old, 5% new)
        const smoothingFactor = 0.05;
        if (systemMinVel === Infinity) {
          systemMinVel = minVelNow;
        } else if (minVelNow < systemMinVel) {
          systemMinVel = minVelNow; // Instant when new low
        } else {
          systemMinVel = systemMinVel * (1 - smoothingFactor) + minVelNow * smoothingFactor;
        }
        
        if (systemMaxVel === 0) {
          systemMaxVel = maxVelNow;
        } else if (maxVelNow > systemMaxVel) {
          systemMaxVel = maxVelNow; // Instant when new high
        } else {
          systemMaxVel = systemMaxVel * (1 - smoothingFactor) + maxVelNow * smoothingFactor;
        }
        
        // Calculate relative speed (0-1) based on system's smoothed velocity range
        const relativeSpeed = systemMaxVel > systemMinVel ? (currentVel - systemMinVel) / (systemMaxVel - systemMinVel) : 0.5;
        
        body.trail.push({
          position: body.position.clone(),
          velocity: currentVel,
          relativeSpeed
        });
        
        // Update cached velocity range
        if (body.trailMinVel === undefined || currentVel < body.trailMinVel) {
          body.trailMinVel = currentVel;
        }
        if (body.trailMaxVel === undefined || currentVel > body.trailMaxVel) {
          body.trailMaxVel = currentVel;
        }
        
        // Limit trail length to dynamic value
        if (body.trail.length > simulationStore.trailLength) {
          const removed = body.trail.shift();
          // If we removed the min or max, recalculate from remaining points
          if (removed && (removed.velocity === body.trailMinVel || removed.velocity === body.trailMaxVel)) {
            body.trailMinVel = Math.min(...body.trail.map(p => p.velocity));
            body.trailMaxVel = Math.max(...body.trail.map(p => p.velocity));
          }
        }
      } else {
        // Clear trail for bodies outside viewport
        if (body.trail && body.trail.length > 0) {
          body.trail = [];
          body.trailMinVel = undefined;
          body.trailMaxVel = undefined;
        }
      }
    }
  }

  // Handle Shift + Slingshot spawning (desktop only)
  if (isSlingshotting.value && isShiftPressed && !isTouchDevice.value && slingshotStartPos) {
    const now = performance.now();
    if (now - lastShiftSpawnTime >= SHIFT_SPAWN_INTERVAL) {
      let actualStartPos = slingshotStartPos;
      if (slingshotLockedBodyId) {
        const lockedBody = simulationStore.bodies.find(b => b.id === slingshotLockedBodyId);
        if (lockedBody) {
          actualStartPos = lockedBody.position.add(slingshotStartPos);
        }
      }
      
      const endPos = screenToWorld(currentMouseScreenPos);
      const pullVector = actualStartPos.sub(endPos);
      const baseVelocity = pullVector.mult(SLINGSHOT_VELOCITY.value);
      
      // Add small randomness to velocity (±5% in magnitude, ±2 degrees in direction)
      const magnitudeVariation = 1 + (Math.random() - 0.5) * 0.1; // ±5%
      const angleVariation = (Math.random() - 0.5) * 0.035; // ±2 degrees in radians
      
      const magnitude = baseVelocity.mag() * magnitudeVariation;
      const angle = Math.atan2(baseVelocity.y, baseVelocity.x) + angleVariation;
      const velocity = new Vector2(Math.cos(angle) * magnitude, Math.sin(angle) * magnitude);

      simulationStore.addBody({
        id: crypto.randomUUID(),
        position: actualStartPos,
        velocity: velocity,
        mass: simulationStore.creationSettings.mass,
        radius: simulationStore.creationSettings.radius,
        color: simulationStore.creationSettings.color,
        bodyType: simulationStore.creationSettings.bodyType
      });
      
      // Reset isStatic to false after placing a body
      simulationStore.creationSettings.isStatic = false;

      lastShiftSpawnTime = now;
    }
  }

  // Cull bodies that are extremely far from camera
  let cameraCenter = cameraStore.offset;
  if (cameraStore.lockedBodyId) {
    const target = simulationStore.bodies.find(b => b.id === cameraStore.lockedBodyId);
    if (target) {
      cameraCenter = target.position;
    }
  }
  
  // Cull distance: FIXED world distance equal to viewport extent at 0.01 zoom
  // This distance stays constant regardless of current zoom level
  const viewportDiagonal = Math.sqrt(canvas.value.width ** 2 + canvas.value.height ** 2);
  const CULL_DISTANCE = (viewportDiagonal / 0.1) * 0.6; // 60% past screen edge at 0.01x zoom
  
  for (let i = simulationStore.bodies.length - 1; i >= 0; i--) {
    const body = simulationStore.bodies[i];
    if (!body) continue;
    if (body.isStatic) continue; // Never cull static bodies (suns/black holes)
    if (body.id === cameraStore.lockedBodyId) continue; // Don't cull the locked body
    
    const distanceFromCamera = body.position.dist(cameraCenter);
    if (distanceFromCamera > CULL_DISTANCE) {
      simulationStore.bodies.splice(i, 1);
    }
  }

  // Clear Canvas
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, canvas.value.width, canvas.value.height);

  // Draw Grid (Optional, for reference)
  // ...

  // Draw Trails
  if (simulationStore.showTrails) {
    // Draw trails with per-segment colors based on stored relative speed
    for (const body of simulationStore.bodies) {
      if (body.trail && body.trail.length > 1) {
        // Collect all velocities and sort them for percentile ranking
        const velocities = body.trail.map(p => p.velocity).sort((a, b) => a - b);
        
        // Draw more points for smoother trails (reduce sampling)
        const sampleRate = Math.max(1, Math.floor(body.trail.length / 500));
        
        // Draw trail as smooth colored segments with glow and temporal fade
        for (let i = 0; i < body.trail.length - 1; i += sampleRate) {
          const point = body.trail[i];
          const nextIdx = Math.min(i + sampleRate, body.trail.length - 1);
          const nextPoint = body.trail[nextIdx];
          
          if (!point || !nextPoint) continue;
          
          // Temporal fade: older segments fade out faster (i=0 is oldest, length-1 is newest)
          const age = i / (body.trail.length - 1);
          const fadeAlpha = Math.pow(age, 2); // Quadratic fade: 0 to 1, fades faster at start
          
          // Find percentile rank of this point's velocity (0-1)
          const rank = velocities.findIndex(v => v >= point.velocity);
          const relSpeed = rank / (velocities.length - 1);
          
          // Get colors for current and next point for gradient
          const hue1 = Math.round(240 - (relSpeed * 240));
          const nextRank = velocities.findIndex(v => v >= nextPoint.velocity);
          const nextRelSpeed = nextRank / (velocities.length - 1);
          const hue2 = Math.round(240 - (nextRelSpeed * 240));
          
          const saturation = 100;
          const baseWidth = Math.max(1, body.radius * cameraStore.zoom * 0.3);
          
          const screenStart = worldToScreen(point.position);
          const screenEnd = worldToScreen(nextPoint.position);
          
          // Create path once for reuse
          const drawPath = () => {
            ctx.beginPath();
            if (body.trail && i + Math.floor(sampleRate / 2) < body.trail.length - 1 && sampleRate > 1) {
              const midPoint = body.trail[i + Math.floor(sampleRate / 2)];
              if (midPoint) {
                const screenMid = worldToScreen(midPoint.position);
                ctx.moveTo(screenStart.x, screenStart.y);
                ctx.quadraticCurveTo(screenMid.x, screenMid.y, screenEnd.x, screenEnd.y);
              }
            } else {
              ctx.moveTo(screenStart.x, screenStart.y);
              ctx.lineTo(screenEnd.x, screenEnd.y);
            }
          };
          
          // Draw trail with visual effects based on setting (0=off, 1=normal, 2=extreme)
          if (simulationStore.enableEffects === 0) {
            // Simple rendering: solid color without gradients or glow
            drawPath();
            ctx.strokeStyle = `hsla(${hue1}, ${saturation}%, 60%, ${fadeAlpha})`;
            ctx.lineWidth = baseWidth;
            ctx.lineCap = 'butt';
            ctx.stroke();
          } else {
            // Calculate width multiplier based on effect level
            const widthMultiplier = simulationStore.enableEffects === 2 ? 2 : 1;
            
            // Draw glow layers (outer to inner)
            // Outer glow (widest)
            drawPath();
            const gradient1 = ctx.createLinearGradient(screenStart.x, screenStart.y, screenEnd.x, screenEnd.y);
            gradient1.addColorStop(0, `hsla(${hue1}, ${saturation}%, 50%, ${0.6 * fadeAlpha})`);
            gradient1.addColorStop(1, `hsla(${hue2}, ${saturation}%, 50%, ${0.6 * fadeAlpha})`);
            ctx.strokeStyle = gradient1;
            ctx.lineWidth = baseWidth * 7 ;
            ctx.lineCap = 'butt';
            ctx.stroke();
            
            // Middle glow
            drawPath();
            const gradient2 = ctx.createLinearGradient(screenStart.x, screenStart.y, screenEnd.x, screenEnd.y);
            gradient2.addColorStop(0, `hsla(${hue1}, ${saturation}%, 60%, ${0.8 * fadeAlpha})`);
            gradient2.addColorStop(1, `hsla(${hue2}, ${saturation}%, 60%, ${0.8 * fadeAlpha})`);
            ctx.strokeStyle = gradient2;
            ctx.lineWidth = baseWidth * 3 * widthMultiplier;
            ctx.lineCap = 'butt';
            ctx.stroke();
            
            // Core/bright center
            drawPath();
            const gradient3 = ctx.createLinearGradient(screenStart.x, screenStart.y, screenEnd.x, screenEnd.y);
            gradient3.addColorStop(0, `hsla(${hue1}, ${saturation}%, 80%, ${1.0 * fadeAlpha})`);
            gradient3.addColorStop(1, `hsla(${hue2}, ${saturation}%, 80%, ${1.0 * fadeAlpha})`);
            ctx.strokeStyle = gradient3;
            ctx.lineWidth = baseWidth * 1.2 * widthMultiplier;
            ctx.lineCap = 'butt';
            ctx.stroke();
          }
        }
      }
    }
  }

  // Draw Bodies
  for (const body of simulationStore.bodies) {
    const screenPos = worldToScreen(body.position);
    const screenRadius = body.radius * cameraStore.zoom;

    // Skip if off screen (optimization)
    if (screenPos.x + screenRadius < 0 || screenPos.x - screenRadius > canvas.value.width ||
        screenPos.y + screenRadius < 0 || screenPos.y - screenRadius > canvas.value.height) {
      continue;
    }

    // Draw comet tail if this is a comet
    if (body.bodyType === 'comet') {
      // Find nearest massive body (sun or black hole with mass >= 50)
      let nearestMassive: typeof body | null = null;
      let minDist = Infinity;
      
      for (const other of simulationStore.bodies) {
        if (other.id !== body.id && other.mass >= 50) {
          const dist = body.position.dist(other.position);
          if (dist < minDist) {
            minDist = dist;
            nearestMassive = other;
          }
        }
      }
      
      if (nearestMassive) {
        // Calculate direction away from massive body (solar wind effect)
        const awayDirection = body.position.sub(nearestMassive.position).normalize();
        const velocity = body.velocity.mag();
        
        // Tail length based on distance and velocity
        const baseTailLength = Math.min(100, 20 + velocity * 0.5);
        const tailLength = baseTailLength * (1 + Math.min(500, minDist) / 500);
        
        // Draw multiple tail streaks with glow effect
        const widthMultiplier = simulationStore.enableEffects === 2 ? 2 : 1;
        const numStreaks = 3;
        for (let i = 0; i < numStreaks; i++) {
          const spreadAngle = (Math.random() - 0.5) * 0.3; // Random spread
          const streakLength = tailLength * (0.6 + Math.random() * 0.4);
          const angle = Math.atan2(awayDirection.y, awayDirection.x) + spreadAngle;
          
          const tailEnd = body.position.add(new Vector2(
            Math.cos(angle) * streakLength,
            Math.sin(angle) * streakLength
          ));
          
          const tailEndScreen = worldToScreen(tailEnd);
          
          // Draw outer glow (widest, most transparent)
          ctx.beginPath();
          ctx.moveTo(screenPos.x, screenPos.y);
          ctx.lineTo(tailEndScreen.x, tailEndScreen.y);
          ctx.strokeStyle = `rgba(135, 206, 235, ${0.1 - i * 0.05})`;
          ctx.lineWidth = Math.max(3, (2 - i * 3) * cameraStore.zoom * widthMultiplier);
          ctx.lineCap = 'round';
          ctx.stroke();
          
          // Draw middle glow
          ctx.beginPath();
          ctx.moveTo(screenPos.x, screenPos.y);
          ctx.lineTo(tailEndScreen.x, tailEndScreen.y);
          ctx.strokeStyle = `rgba(173, 216, 230, ${0.2 - i * 0.08})`;
          ctx.lineWidth = Math.max(2, (5 - i * 2) * cameraStore.zoom * widthMultiplier);
          ctx.lineCap = 'round';
          ctx.stroke();
          
          // Draw core streak (brightest, thinnest)
          ctx.beginPath();
          ctx.moveTo(screenPos.x, screenPos.y);
          ctx.lineTo(tailEndScreen.x, tailEndScreen.y);
          ctx.strokeStyle = `rgba(224, 247, 250, ${0.1 - i * 0.15})`;
          ctx.lineWidth = Math.max(1.5, (4 - i * 0.8) * cameraStore.zoom * widthMultiplier);
          ctx.lineCap = 'round';
          ctx.stroke();
        }
      }
    }
    
    ctx.beginPath();
    ctx.arc(screenPos.x, screenPos.y, Math.max(1, screenRadius), 0, Math.PI * 2);
    ctx.fillStyle = body.color;
    ctx.fill();
    
    // Static body indicator (snowflake symbol)
    if (body.isStatic) {
        const snowflakeSize = Math.max(6, screenRadius * 0.5);
        ctx.save();
        ctx.translate(screenPos.x, screenPos.y);
        ctx.fillStyle = '#E3F2FD';
        ctx.strokeStyle = '#BBDEFB';
        ctx.lineWidth = 1.5;
        
        // Draw snowflake
        for (let i = 0; i < 6; i++) {
            ctx.rotate(Math.PI / 3);
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(0, -snowflakeSize);
            ctx.stroke();
            // Small branches
            ctx.beginPath();
            ctx.moveTo(0, -snowflakeSize * 0.6);
            ctx.lineTo(-snowflakeSize * 0.3, -snowflakeSize * 0.8);
            ctx.moveTo(0, -snowflakeSize * 0.6);
            ctx.lineTo(snowflakeSize * 0.3, -snowflakeSize * 0.8);
            ctx.stroke();
        }
        ctx.restore();
    }
    
    // Selection highlight?
    if (cameraStore.lockedBodyId === body.id) {
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 2;
        ctx.stroke();
    }
  }

  // Draw Particles (collision sparkles)
  for (const particle of particles.value) {
    const screenPos = worldToScreen(particle.position);
    const alpha = particle.life; // Fade out as life decreases
    
    // Draw sharp white spark
    ctx.save();
    
    // Small subtle glow
    ctx.beginPath();
    ctx.arc(screenPos.x, screenPos.y, particle.size * 1.5, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255, 255, 255, ${alpha * 0.3})`;
    ctx.fill();
    
    // Bright sharp core
    ctx.beginPath();
    ctx.arc(screenPos.x, screenPos.y, particle.size, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
    ctx.fill();
    
    ctx.restore();
  }

  // Draw Slingshot Line
  if (isSlingshotting && slingshotStartPos && canvas.value) {
    // Draw the line from start to current mouse (or rather, the pull vector)
    // We need the current mouse position in world space, but we calculated it in onMouseMove.
    // Let's just draw the ghost path which is more important.
    
    if (ghostPath.value.length > 0) {
        ctx.beginPath();
        const startPoint = ghostPath.value[0];
        if (startPoint) {
             const startScreen = worldToScreen(startPoint);
             ctx.moveTo(startScreen.x, startScreen.y);
        }
        
        for (let i = 1; i < ghostPath.value.length; i++) {
            const p = ghostPath.value[i];
            if (p) {
                const screenP = worldToScreen(p);
                ctx.lineTo(screenP.x, screenP.y);
            }
        }
        
        ctx.strokeStyle = 'rgba(255, 0, 0, 0.8)';
        ctx.lineWidth = 2;
        ctx.stroke();
    }
    
    // Draw the "pull" line
    // We can't easily get the current mouse pos here without storing it.
    // But the ghost path starts at the creation point, so that's good visual feedback.
  }

  // Draw Performance Indicators (top-right corner)
  ctx.save();
  ctx.font = '12px monospace';
  ctx.textAlign = 'right';
  
  const fpsText = `FPS: ${currentFPS}`;
  const bodyCountText = `Bodies: ${simulationStore.bodies.length}`;
  const zoomText = `Zoom: ${cameraStore.zoom.toFixed(2)}x`;
  const trailText = `Trail Length: ${simulationStore.trailLength}`;
  
  // Measure text width for background
  const maxWidth = Math.max(
    ctx.measureText(fpsText).width,
    ctx.measureText(bodyCountText).width,
    ctx.measureText(zoomText).width,
    ctx.measureText(trailText).width
  );
  
  const rightMargin = canvas.value.width - 10;
  // Use different top margin for mobile vs desktop
  const topMargin = isTouchDevice.value ? 5 : 60;
  
  // Background for readability
  ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
  ctx.fillRect(rightMargin - maxWidth - 20, topMargin, maxWidth + 20, 90);
  
  // FPS
  ctx.fillStyle = '#AA0000';
  ctx.fillText(fpsText, rightMargin - 10, topMargin + 20);
  
  // Body count
  ctx.fillStyle = '#AA0000';
  ctx.fillText(bodyCountText, rightMargin - 10, topMargin + 40);
  
  // Zoom level
  ctx.fillStyle = '#AA0000';
  ctx.fillText(zoomText, rightMargin - 10, topMargin + 60);
  
  // Trail length
  ctx.fillStyle = '#AA0000';
  ctx.fillText(trailText, rightMargin - 10, topMargin + 80);
  
  ctx.restore();

  animationFrameId = requestAnimationFrame(render);
};

// Input Event Handlers
const ghostPath = ref<Vector2[]>([]);
const onMouseDown = (e: MouseEvent) => {
  // Block interaction during tour
  if (simulationStore.showIntroTour) return;
  
  if (e.button === 1) { // Middle click to pan
    isDragging = true;
    lastMousePos = new Vector2(e.clientX, e.clientY);
  } else if (e.button === 2) { // Right click to spawn bodies
    isRightDragging = true;
    lastSpawnTime = performance.now();
    // Spawn first body immediately
    const worldPos = screenToWorld(new Vector2(e.clientX, e.clientY));
    simulationStore.addBody({
      id: crypto.randomUUID(),
      position: worldPos,
      velocity: new Vector2(0, 0),
      mass: simulationStore.creationSettings.mass,
      radius: simulationStore.creationSettings.radius,
      color: simulationStore.creationSettings.color
    });
  } else if (e.button === 0) { // Left click to start slingshot
    // Only if not clicking on UI (handled by z-index usually, but good to be safe)
    isDragging = false; // Ensure we aren't panning
    
    const worldPos = screenToWorld(new Vector2(e.clientX, e.clientY));
    
    // Check if clicking existing body to lock/unlock
    let clickedBody = null;
    for (const body of simulationStore.bodies) {
      if (body.position.dist(worldPos) < body.radius + 5) { // +5 tolerance
        clickedBody = body;
        break;
      }
    }

    if (clickedBody) {
      // If clicking a frozen body, unfreeze it and lock camera to it
      if (clickedBody.isStatic) {
        clickedBody.isStatic = false;
        cameraStore.lockToBody(clickedBody.id);
      }
      // Toggle lock: if clicking the currently locked body, unlock it
      else if (cameraStore.lockedBodyId === clickedBody.id) {
        // Update camera offset to body's current position before unlocking
        cameraStore.offset = clickedBody.position.clone();
        cameraStore.lockToBody(null);
      } else {
        cameraStore.lockToBody(clickedBody.id);
      }
    } else {
      // Start Slingshot
      const worldPos = screenToWorld(new Vector2(e.clientX, e.clientY));
      
      // If camera is locked to a body, store position relative to that body
      if (cameraStore.lockedBodyId) {
        const lockedBody = simulationStore.bodies.find(b => b.id === cameraStore.lockedBodyId);
        if (lockedBody) {
          slingshotStartPos = worldPos.sub(lockedBody.position); // Store as offset
          slingshotLockedBodyId = cameraStore.lockedBodyId;
        } else {
          slingshotStartPos = worldPos;
          slingshotLockedBodyId = null;
        }
      } else {
        slingshotStartPos = worldPos;
        slingshotLockedBodyId = null;
      }
      
      isSlingshotting.value = true;
    }
  }
};

let slingshotStartPos: Vector2 | null = null;
let slingshotLockedBodyId: string | null = null; // Track if slingshot was started while locked to a body
const isSlingshotting = ref(false);
let isShiftPressed = false;
let lastShiftSpawnTime = 0;
const SHIFT_SPAWN_INTERVAL = 100; // 10 bodies per second (1000ms / 10 = 100ms)
let currentMouseScreenPos = new Vector2(0, 0);

// Track system-wide velocity range over time for trail coloring
let systemMinVel = Infinity;
let systemMaxVel = 0;

const onMouseMove = (e: MouseEvent) => {
  const currentMousePos = new Vector2(e.clientX, e.clientY);
  currentMouseScreenPos = currentMousePos;
  
  // Block interaction during tour
  if (simulationStore.showIntroTour) return;
  
  if (isDragging) {
    const delta = lastMousePos.sub(currentMousePos).div(cameraStore.zoom);
    cameraStore.pan(delta);
    lastMousePos = currentMousePos;
  }

  if (isRightDragging) {
    const now = performance.now();
    if (now - lastSpawnTime >= SPAWN_INTERVAL) {
      const worldPos = screenToWorld(currentMousePos);
      simulationStore.addBody({
        id: crypto.randomUUID(),
        position: worldPos,
        velocity: new Vector2(0, 0),
        mass: simulationStore.creationSettings.mass,
        radius: simulationStore.creationSettings.radius,
        color: simulationStore.creationSettings.color,
        bodyType: simulationStore.creationSettings.bodyType
      });
      
      lastSpawnTime = now;
    }
  }

  if (isSlingshotting.value && slingshotStartPos) {
    // Throttle prediction calculations to avoid performance issues
    const now = performance.now();
    if (now - lastPredictionTime >= PREDICTION_INTERVAL) {
      // Get the actual world position for the slingshot start
      let actualStartPos = slingshotStartPos;
      if (slingshotLockedBodyId) {
        const lockedBody = simulationStore.bodies.find(b => b.id === slingshotLockedBodyId);
        if (lockedBody) {
          // slingshotStartPos is stored as offset from locked body
          actualStartPos = lockedBody.position.add(slingshotStartPos);
        }
      }
      
      const endPos = screenToWorld(currentMousePos);
      const pullVector = actualStartPos.sub(endPos);
      const velocity = pullVector.mult(SLINGSHOT_VELOCITY.value);

      ghostPath.value = simulationStore.predictPath(
          actualStartPos, 
          velocity, 
          simulationStore.creationSettings.mass,
          3000,  // Reduced from 30000 for better performance
          0.016  // Roughly 60fps dt
      );
      
      lastPredictionTime = now;
    }
  }
};

const onMouseUp = (e: MouseEvent) => {
  // Block interaction during tour
  if (simulationStore.showIntroTour) return;
  
  isDragging = false;
  isRightDragging = false;
  
  if (isSlingshotting.value && slingshotStartPos) {
    // Get the actual world position for the slingshot start
    let actualStartPos = slingshotStartPos;
    if (slingshotLockedBodyId) {
      const lockedBody = simulationStore.bodies.find(b => b.id === slingshotLockedBodyId);
      if (lockedBody) {
        actualStartPos = lockedBody.position.add(slingshotStartPos);
      }
    }
    
    const endPos = screenToWorld(new Vector2(e.clientX, e.clientY));
    const pullVector = actualStartPos.sub(endPos);
    const velocity = pullVector.mult(SLINGSHOT_VELOCITY.value);

    simulationStore.addBody({
      id: crypto.randomUUID(),
      position: actualStartPos,
      velocity: velocity,
      mass: simulationStore.creationSettings.mass,
      radius: simulationStore.creationSettings.radius,
      color: simulationStore.creationSettings.color,
      bodyType: simulationStore.creationSettings.bodyType
    });

    isSlingshotting.value = false;
    slingshotStartPos = null;
    slingshotLockedBodyId = null;
    ghostPath.value = [];
  }
};

const onWheel = (e: WheelEvent) => {
  e.preventDefault();
  
  // Block interaction during tour
  if (simulationStore.showIntroTour) return;
  
  if (!canvas.value) return;
  
  // Get mouse position in screen space
  const mouseScreen = new Vector2(e.clientX, e.clientY);
  const center = new Vector2(canvas.value.width / 2, canvas.value.height / 2);
  
  // Calculate new zoom
  const zoomSpeed = 0.1;
  const oldZoom = cameraStore.zoom;
  const newZoom = Math.max(0.01, Math.min(oldZoom - Math.sign(e.deltaY) * zoomSpeed * oldZoom, 100.0));
  
  // To keep the world point under the cursor fixed:
  // We need to adjust the offset so that the same world point stays under the mouse
  // 
  // Before: worldPos = (mouseScreen - center) / oldZoom + oldOffset
  // After:  worldPos = (mouseScreen - center) / newZoom + newOffset
  // 
  // Therefore: newOffset = oldOffset + (mouseScreen - center) * (1/oldZoom - 1/newZoom)
  
  const mouseDelta = mouseScreen.sub(center);
  const offsetAdjustment = mouseDelta.mult(1/oldZoom - 1/newZoom);
  
  // Apply zoom
  cameraStore.setZoom(newZoom);
  
  // Adjust offset (only if not locked to a body)
  if (!cameraStore.lockedBodyId) {
    cameraStore.offset = cameraStore.offset.add(offsetAdjustment);
  }
};

const onKeyDown = (e: KeyboardEvent) => {
  if (e.key === 'Shift') {
    isShiftPressed = true;
  }
};

const onKeyUp = (e: KeyboardEvent) => {
  if (e.key === 'Shift') {
    isShiftPressed = false;
  }
};

// Touch Event Handlers for Mobile Support
let initialPinchDistance: number | null = null;
let initialZoom: number = 1;

const getTouchDistance = (touch1: Touch, touch2: Touch): number => {
  const dx = touch2.clientX - touch1.clientX;
  const dy = touch2.clientY - touch1.clientY;
  return Math.sqrt(dx * dx + dy * dy);
};

const getTouchCenter = (touch1: Touch, touch2: Touch): Vector2 => {
  return new Vector2(
    (touch1.clientX + touch2.clientX) / 2,
    (touch1.clientY + touch2.clientY) / 2
  );
};

const onTouchStart = (e: TouchEvent) => {
  e.preventDefault(); // Prevent default touch behavior
  
  // Block interaction during tour
  if (simulationStore.showIntroTour) return;
  
  if (e.touches.length === 1) {
    // Single touch - same as left click (slingshot)
    const touch = e.touches[0];
    if (touch) {
      const mouseEvent = new MouseEvent('mousedown', {
        clientX: touch.clientX,
        clientY: touch.clientY,
        button: 0
      });
      onMouseDown(mouseEvent);
    }
  } else if (e.touches.length === 2) {
    // Two finger - setup for pinch zoom and pan
    const touch1 = e.touches[0];
    const touch2 = e.touches[1];
    if (touch1 && touch2) {
      initialPinchDistance = getTouchDistance(touch1, touch2);
      initialZoom = cameraStore.zoom;
      const center = getTouchCenter(touch1, touch2);
      lastMousePos = center;
      isDragging = true;
      
      // Cancel any ongoing slingshot
      if (isSlingshotting.value) {
        isSlingshotting.value = false;
        slingshotStartPos = null;
        slingshotLockedBodyId = null;
        ghostPath.value = [];
      }
    }
  }
};

const onTouchMove = (e: TouchEvent) => {
  e.preventDefault();
  
  // Block interaction during tour
  if (simulationStore.showIntroTour) return;
  
  if (e.touches.length === 1 && isSlingshotting) {
    // Single touch move - slingshot drag
    const touch = e.touches[0];
    if (touch) {
      const mouseEvent = new MouseEvent('mousemove', {
        clientX: touch.clientX,
        clientY: touch.clientY
      });
      onMouseMove(mouseEvent);
    }
  } else if (e.touches.length === 2) {
    // Two finger - pinch zoom and pan
    const touch1 = e.touches[0];
    const touch2 = e.touches[1];
    
    if (touch1 && touch2 && canvas.value) {
      const currentDistance = getTouchDistance(touch1, touch2);
      const center = getTouchCenter(touch1, touch2);
      
      // Handle pinch zoom
      if (initialPinchDistance !== null) {
        const zoomFactor = currentDistance / initialPinchDistance;
        const newZoom = Math.max(0.01, Math.min(initialZoom * zoomFactor, 100.0));
        
        // Zoom towards the center of the pinch
        const canvasCenter = new Vector2(canvas.value.width / 2, canvas.value.height / 2);
        const mouseDelta = center.sub(canvasCenter);
        const oldZoom = cameraStore.zoom;
        const offsetAdjustment = mouseDelta.mult(1/oldZoom - 1/newZoom);
        
        cameraStore.setZoom(newZoom);
        
        // Adjust offset (only if not locked to a body)
        if (!cameraStore.lockedBodyId) {
          cameraStore.offset = cameraStore.offset.add(offsetAdjustment);
        }
      }
      
      // Handle pan
      if (isDragging) {
        const delta = lastMousePos.sub(center).div(cameraStore.zoom);
        cameraStore.pan(delta);
        lastMousePos = center;
      }
    }
  }
};

const onTouchEnd = (e: TouchEvent) => {
  e.preventDefault();
  
  // Block interaction during tour
  if (simulationStore.showIntroTour) return;
  
  if (e.touches.length === 0) {
    // All touches released
    if (isSlingshotting.value) {
      const mouseEvent = new MouseEvent('mouseup', {
        clientX: currentMouseScreenPos.x,
        clientY: currentMouseScreenPos.y,
        button: 0
      });
      onMouseUp(mouseEvent);
    }
    isDragging = false;
    initialPinchDistance = null;
  } else if (e.touches.length === 1) {
    // One finger left - reset pinch
    initialPinchDistance = null;
    isDragging = false;
  }
};

onMounted(() => {
  window.addEventListener('resize', resizeCanvas);
  resizeCanvas();
  
  if (canvas.value) {
    // Mouse events
    canvas.value.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    canvas.value.addEventListener('wheel', onWheel);
    
    // Touch events for mobile
    canvas.value.addEventListener('touchstart', onTouchStart, { passive: false });
    canvas.value.addEventListener('touchmove', onTouchMove, { passive: false });
    canvas.value.addEventListener('touchend', onTouchEnd, { passive: false });
    
    // Keyboard events
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    
    // Prevent context menu on right click
    canvas.value.addEventListener('contextmenu', e => e.preventDefault());
  }

  lastTime = performance.now();
  animationFrameId = requestAnimationFrame(render);
});

onUnmounted(() => {
  window.removeEventListener('resize', resizeCanvas);
  if (canvas.value) {
    // Remove mouse events
    canvas.value.removeEventListener('mousedown', onMouseDown);
    window.removeEventListener('mousemove', onMouseMove);
    window.removeEventListener('mouseup', onMouseUp);
    canvas.value.removeEventListener('wheel', onWheel);
    
    // Remove touch events
    canvas.value.removeEventListener('touchstart', onTouchStart);
    canvas.value.removeEventListener('touchmove', onTouchMove);
    canvas.value.removeEventListener('touchend', onTouchEnd);
    
    // Remove keyboard events
    window.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('keyup', onKeyUp);
  }
  cancelAnimationFrame(animationFrameId);
});
</script>

<style scoped>
.canvas-container {
  width: 100vw;
  height: 100vh;
  position: absolute;
  top: 0;
  left: 0;
  overflow: hidden;
  background-color: #000;
}

canvas {
  display: block;
  touch-action: none; /* Prevent default touch actions like scrolling */
}

.multiple-button-container {
  position: absolute;
  top: 170px;
  left: 10px;
  z-index: 1000;
  pointer-events: auto;
}

.slingshot-tooltip {
  position: absolute;
  background: rgba(30, 30, 30, 0.95);
  color: #fff;
  padding: 8px 12px;
  border-radius: 6px;
  font-size: 0.9rem;
  font-weight: 500;
  pointer-events: none;
  z-index: 1000;
  white-space: nowrap;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
  border: 1px solid rgba(255, 255, 255, 0.2);
}

.slingshot-tooltip .key {
  background: rgba(255, 255, 255, 0.15);
  padding: 2px 6px;
  border-radius: 3px;
  font-family: monospace;
  font-weight: bold;
  color: #82B1FF;
}

/* Hide tooltip on mobile */
@media (max-width: 768px), (hover: none) {
  .slingshot-tooltip {
    display: none;
  }
}
</style>
