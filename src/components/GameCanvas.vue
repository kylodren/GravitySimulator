<template>
  <div class="canvas-container" ref="container">
    <canvas ref="canvas"></canvas>
    <div class="overlay-ui">
      <!-- We'll add UI controls here later or in a separate component -->
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import { useSimulationStore } from '../stores/simulation';
import { useCameraStore } from '../stores/camera';
import { Vector2 } from '../core/Vector2';

const container = ref<HTMLDivElement | null>(null);
const canvas = ref<HTMLCanvasElement | null>(null);
const simulationStore = useSimulationStore();
const cameraStore = useCameraStore();

let animationFrameId: number;
let lastTime = 0;

// Performance tracking
let fpsFrames = 0;
let fpsLastTime = 0;
let currentFPS = 60;

// Slingshot configuration
const SLINGSHOT_VELOCITY = 2.0; // Velocity multiplier for slingshot launches

// Input handling state
let isDragging = false;
let lastMousePos = new Vector2(0, 0);
let isRightDragging = false;
let lastSpawnTime = 0;
const SPAWN_INTERVAL = 50; // ms between spawns during right-click drag

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

const render = (timestamp: number) => {
  if (!canvas.value) return;
  const ctx = canvas.value.getContext('2d');
  if (!ctx) return;

  const dt = (timestamp - lastTime) / 1000; // Delta time in seconds
  lastTime = timestamp;

  // Calculate FPS
  fpsFrames++;
  if (timestamp - fpsLastTime >= 1000) { // Update every second
    currentFPS = Math.round((fpsFrames * 1000) / (timestamp - fpsLastTime));
    fpsFrames = 0;
    fpsLastTime = timestamp;
  }

  // Update Physics
  simulationStore.update(dt);

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
        // Add trail point for visible bodies
        if (!body.trail) body.trail = [];
        const currentVel = body.velocity.mag();
        body.trail.push({
          position: body.position.clone(),
          velocity: currentVel
        });
        
        // Update cached velocity range
        if (body.trailMinVel === undefined || currentVel < body.trailMinVel) {
          body.trailMinVel = currentVel;
        }
        if (body.trailMaxVel === undefined || currentVel > body.trailMaxVel) {
          body.trailMaxVel = currentVel;
        }
        
        // Limit trail length
        if (body.trail.length > 300) {
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

  // Handle Shift + Slingshot spawning
  if (isSlingshotting && isShiftPressed && slingshotStartPos) {
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
      const baseVelocity = pullVector.mult(SLINGSHOT_VELOCITY);
      
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
        color: simulationStore.creationSettings.color
      });
      
      // Reset isStatic to false after placing a body
      simulationStore.creationSettings.isStatic = false;

      lastShiftSpawnTime = now;
    }
  }

  // Clear Canvas
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, canvas.value.width, canvas.value.height);

  // Draw Grid (Optional, for reference)
  // ...

  // Draw Trails
  if (simulationStore.showTrails) {
    // Use cached velocity ranges from all bodies
    let minVel = Infinity;
    let maxVel = 0;
    
    for (const body of simulationStore.bodies) {
      if (body.trail && body.trail.length > 0 && body.trailMinVel !== undefined && body.trailMaxVel !== undefined) {
        minVel = Math.min(minVel, body.trailMinVel);
        maxVel = Math.max(maxVel, body.trailMaxVel);
      }
    }
    
    // Use actual current range for immediate color response
    if (minVel !== Infinity && maxVel > minVel) {
      globalMinVel = minVel;
      globalMaxVel = maxVel;
    }
    
    // Use the actual range without padding, map velocities directly
    const velocityRange = globalMaxVel - globalMinVel || 1;
    
    // Second pass: draw trails with per-segment colors based on stored velocities
    for (const body of simulationStore.bodies) {
      if (body.trail && body.trail.length > 1) {
        // Draw more points for smoother trails (reduce sampling)
        const sampleRate = Math.max(1, Math.floor(body.trail.length / 500));
        
        // Draw trail as smooth colored segments using quadratic curves
        for (let i = 0; i < body.trail.length - 1; i += sampleRate) {
          const point = body.trail[i];
          const nextIdx = Math.min(i + sampleRate, body.trail.length - 1);
          const nextPoint = body.trail[nextIdx];
          
          if (!point || !nextPoint) continue;
          
          // Map velocity directly to 0-1 range
          let velocityRatio = (point.velocity - globalMinVel) / velocityRange;
          velocityRatio = Math.min(1, Math.max(0, velocityRatio)); // Clamp to 0-1
          
          // Map to full color spectrum: 240 (blue) -> 0 (red)
          const hue = Math.round(240 - (velocityRatio * 240));
          const saturation = 100;
          
          ctx.beginPath();
          const screenStart = worldToScreen(point.position);
          const screenEnd = worldToScreen(nextPoint.position);
          
          // Use quadratic curve if we have a midpoint
          if (i + Math.floor(sampleRate / 2) < body.trail.length - 1 && sampleRate > 1) {
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
          
          ctx.strokeStyle = `hsla(${hue}, ${saturation}%, 50%, 0.5)`;
          ctx.lineWidth = Math.max(1, body.radius * cameraStore.zoom * 0.3);
          ctx.stroke();
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
  ctx.font = '14px monospace';
  ctx.textAlign = 'right';
  
  const fpsText = `FPS: ${currentFPS}`;
  const bodyCountText = `Bodies: ${simulationStore.bodies.length}`;
  
  // Measure text width for background
  const maxWidth = Math.max(
    ctx.measureText(fpsText).width,
    ctx.measureText(bodyCountText).width
  );
  
  const rightMargin = canvas.value.width - 10;
  const topMargin = 50;
  
  // Background for readability
  ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
  ctx.fillRect(rightMargin - maxWidth - 20, topMargin, maxWidth + 20, 50);
  
  // FPS text with color coding
  if (currentFPS >= 50) {
    ctx.fillStyle = '#4CAF50'; // Green - good
  } else if (currentFPS >= 30) {
    ctx.fillStyle = '#FFC107'; // Yellow - okay
  } else {
    ctx.fillStyle = '#F44336'; // Red - bad
  }
  ctx.fillText(fpsText, rightMargin - 10, topMargin + 20);
  
  // Body count
  ctx.fillStyle = '#FFFFFF';
  ctx.fillText(bodyCountText, rightMargin - 10, topMargin + 40);
  
  ctx.restore();

  animationFrameId = requestAnimationFrame(render);
};

// Input Event Handlers
const ghostPath = ref<Vector2[]>([]);
const onMouseDown = (e: MouseEvent) => {
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
    
    // Reset isStatic to false after placing a body
    simulationStore.creationSettings.isStatic = false;
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
      
      isSlingshotting = true;
    }
  }
};

let slingshotStartPos: Vector2 | null = null;
let slingshotLockedBodyId: string | null = null; // Track if slingshot was started while locked to a body
let isSlingshotting = false;
let isShiftPressed = false;
let lastShiftSpawnTime = 0;
const SHIFT_SPAWN_INTERVAL = 100; // 10 bodies per second (1000ms / 10 = 100ms)
let currentMouseScreenPos = new Vector2(0, 0);

// Track velocity range over time for smooth color mapping
let globalMinVel = Infinity;
let globalMaxVel = 0;

const onMouseMove = (e: MouseEvent) => {
  const currentMousePos = new Vector2(e.clientX, e.clientY);
  currentMouseScreenPos = currentMousePos;
  
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
        color: simulationStore.creationSettings.color
      });
      
      // Reset isStatic to false after placing a body
      simulationStore.creationSettings.isStatic = false;
      lastSpawnTime = now;
    }
  }

  if (isSlingshotting && slingshotStartPos) {
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
    const velocity = pullVector.mult(SLINGSHOT_VELOCITY);

    ghostPath.value = simulationStore.predictPath(
        actualStartPos, 
        velocity, 
        simulationStore.creationSettings.mass,
        1500
    );
  }
};

const onMouseUp = (e: MouseEvent) => {
  isDragging = false;
  isRightDragging = false;
  
  if (isSlingshotting && slingshotStartPos) {
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
    const velocity = pullVector.mult(SLINGSHOT_VELOCITY);

    simulationStore.addBody({
      id: crypto.randomUUID(),
      position: actualStartPos,
      velocity: velocity,
      mass: simulationStore.creationSettings.mass,
      radius: simulationStore.creationSettings.radius,
      color: simulationStore.creationSettings.color
    });
    
    // Reset isStatic to false after placing a body
    simulationStore.creationSettings.isStatic = false;

    isSlingshotting = false;
    slingshotStartPos = null;
    slingshotLockedBodyId = null;
    ghostPath.value = [];
  }
};

const onWheel = (e: WheelEvent) => {
  e.preventDefault();
  
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

onMounted(() => {
  window.addEventListener('resize', resizeCanvas);
  resizeCanvas();
  
  if (canvas.value) {
    canvas.value.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    canvas.value.addEventListener('wheel', onWheel);
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
    canvas.value.removeEventListener('mousedown', onMouseDown);
    window.removeEventListener('mousemove', onMouseMove);
    window.removeEventListener('mouseup', onMouseUp);
    canvas.value.removeEventListener('wheel', onWheel);
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
}
</style>
