<template>
  <svg viewBox="0 0 24 24" :width="size" :height="size" xmlns="http://www.w3.org/2000/svg">
    <path 
      d="M12 3 L15 5 L17 4 L19 7 L21 9 L20 12 L21 15 L18 17 L16 19 L13 20 L10 19 L7 18 L5 15 L3 12 L4 9 L6 6 L9 4 L12 3 Z"
      :fill="color"
      stroke="#555"
      stroke-width="0.5"
    />
    <circle cx="8" cy="9" r="1.5" fill="#555" opacity="0.6" />
    <circle cx="15" cy="11" r="1" fill="#555" opacity="0.5" />
    <circle cx="11" cy="15" r="1.2" fill="#555" opacity="0.4" />
  </svg>
</template>

<script setup lang="ts">
withDefaults(defineProps<{
  size?: number;
  color?: string;
}>(), {
  size: 32,
  color: '#808080'
});
</script>
