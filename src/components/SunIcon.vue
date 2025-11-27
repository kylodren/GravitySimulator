<template>
  <svg viewBox="0 0 24 24" :width="size" :height="size" xmlns="http://www.w3.org/2000/svg">
    <!-- Sun rays -->
    <g :stroke="color" stroke-width="1.5" stroke-linecap="round">
      <line x1="12" y1="2" x2="12" y2="5" />
      <line x1="12" y1="19" x2="12" y2="22" />
      <line x1="2" y1="12" x2="5" y2="12" />
      <line x1="19" y1="12" x2="22" y2="12" />
      <line x1="4.22" y1="4.22" x2="6.34" y2="6.34" />
      <line x1="17.66" y1="17.66" x2="19.78" y2="19.78" />
      <line x1="4.22" y1="19.78" x2="6.34" y2="17.66" />
      <line x1="17.66" y1="6.34" x2="19.78" y2="4.22" />
    </g>
    
    <!-- Sun body -->
    <circle cx="12" cy="12" r="5" :fill="color" />
    
    <!-- Inner glow -->
    <circle cx="12" cy="12" r="5" fill="#FFD54F" opacity="0.6" />
    
    <!-- Highlight -->
    <circle cx="10.5" cy="10" r="1.5" fill="#FFF9C4" opacity="0.9" />
  </svg>
</template>

<script setup lang="ts">
withDefaults(defineProps<{
  size?: number;
  color?: string;
}>(), {
  size: 32,
  color: '#FFC107'
});
</script>
