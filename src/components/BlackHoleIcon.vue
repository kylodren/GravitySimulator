<template>
  <svg viewBox="0 0 24 24" :width="size" :height="size" xmlns="http://www.w3.org/2000/svg">
    <!-- Outer accretion disk -->
    <ellipse 
      cx="12" 
      cy="12" 
      rx="10" 
      ry="3" 
      fill="none" 
      stroke="#9C27B0" 
      stroke-width="1.5"
      opacity="0.7"
    />
    
    <!-- Inner accretion disk -->
    <ellipse 
      cx="12" 
      cy="12" 
      rx="7" 
      ry="2" 
      fill="none" 
      stroke="#BA68C8" 
      stroke-width="1"
      opacity="0.8"
    />
    
    <!-- Black hole event horizon -->
    <circle cx="12" cy="12" r="4.5" :fill="color" />
    
    <!-- Absolute darkness in center -->
    <circle cx="12" cy="12" r="3.5" fill="#000000" />
    
    <!-- Gravitational lensing effect -->
    <circle 
      cx="12" 
      cy="12" 
      r="4.5" 
      fill="none" 
      stroke="#9C27B0" 
      stroke-width="0.5"
      opacity="0.4"
    />
  </svg>
</template>

<script setup lang="ts">
withDefaults(defineProps<{
  size?: number;
  color?: string;
}>(), {
  size: 32,
  color: '#1A1A1A'
});
</script>
