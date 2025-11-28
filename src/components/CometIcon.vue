<template>
  <svg :width="size" :height="size" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <!-- Comet nucleus (bright core) -->
    <circle cx="16" cy="8" r="3" fill="#87CEEB" />
    <circle cx="16" cy="8" r="2" fill="#E0F7FA" />
    
    <!-- Comet tail (streaks pointing away) -->
    <path d="M14 9 L6 15" stroke="#87CEEB" stroke-width="2" opacity="0.6" stroke-linecap="round"/>
    <path d="M14.5 10.5 L4 18" stroke="#87CEEB" stroke-width="1.5" opacity="0.4" stroke-linecap="round"/>
    <path d="M13 8 L7 12" stroke="#B0E0E6" stroke-width="1.5" opacity="0.5" stroke-linecap="round"/>
    <path d="M14 7 L8 10" stroke="#E0F7FA" stroke-width="1" opacity="0.7" stroke-linecap="round"/>
  </svg>
</template>

<script setup lang="ts">
defineProps<{
  size?: number;
}>();
</script>
