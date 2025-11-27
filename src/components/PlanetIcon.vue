<template>
  <svg viewBox="0 0 24 24" :width="size" :height="size" xmlns="http://www.w3.org/2000/svg">
    <!-- Planet body -->
    <circle cx="12" cy="12" r="7" :fill="color" />
    
    <!-- Surface features -->
    <ellipse cx="9" cy="10" rx="2" ry="1.5" fill="#1976D2" opacity="0.6" />
    <ellipse cx="14" cy="14" rx="1.5" ry="1" fill="#1976D2" opacity="0.5" />
    
    <!-- Atmospheric ring -->
    <ellipse 
      cx="12" 
      cy="12" 
      rx="10" 
      ry="3" 
      fill="none" 
      stroke="#64B5F6" 
      stroke-width="1"
      opacity="0.6"
    />
    
    <!-- Highlight -->
    <circle cx="10" cy="9" r="1.5" fill="#E3F2FD" opacity="0.8" />
  </svg>
</template>

<script setup lang="ts">
withDefaults(defineProps<{
  size?: number;
  color?: string;
}>(), {
  size: 32,
  color: '#2196F3'
});
</script>
