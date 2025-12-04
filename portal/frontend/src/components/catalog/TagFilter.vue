<script setup lang="ts">
import { Badge } from '@/components/ui/badge'
import { Check } from 'lucide-vue-next'

defineProps<{
  tags: string[]
  selectedTags: string[]
}>()

const emit = defineEmits<{
  toggle: [tag: string]
}>()

function isSelected(tag: string, selectedTags: string[]): boolean {
  return selectedTags.includes(tag)
}
</script>

<template>
  <div class="flex flex-wrap gap-1.5">
    <button
      v-for="tag in tags"
      :key="tag"
      @click="emit('toggle', tag)"
      class="inline-flex items-center"
    >
      <Badge
        :variant="isSelected(tag, selectedTags) ? 'default' : 'outline'"
        class="cursor-pointer transition-colors gap-1"
        :class="[
          isSelected(tag, selectedTags)
            ? 'bg-primary hover:bg-primary/90'
            : 'hover:bg-accent'
        ]"
      >
        <Check
          v-if="isSelected(tag, selectedTags)"
          class="w-3 h-3"
        />
        {{ tag }}
      </Badge>
    </button>
    <p v-if="tags.length === 0" class="text-xs text-muted-foreground">
      No tags available
    </p>
  </div>
</template>
