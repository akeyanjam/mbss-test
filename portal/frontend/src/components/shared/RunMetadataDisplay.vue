<script setup lang="ts">
import type { RunMetadata } from '@/types'
import { Tag, Folder, ListChecks } from 'lucide-vue-next'
import { Badge } from '@/components/ui/badge'

defineProps<{
  metadata?: RunMetadata
}>()
</script>

<template>
  <div v-if="metadata" class="flex items-center gap-2 text-sm">
    <!-- Folder selection -->
    <div v-if="metadata.selectionType === 'folder' && metadata.folder" class="flex items-center gap-1.5">
      <Folder class="w-3.5 h-3.5 text-muted-foreground" />
      <span class="text-muted-foreground">Folder:</span>
      <Badge variant="secondary" class="text-xs">{{ metadata.folder }}</Badge>
    </div>

    <!-- Tags selection -->
    <div v-else-if="metadata.selectionType === 'tags' && metadata.tags && metadata.tags.length > 0" class="flex items-center gap-1.5 flex-wrap">
      <Tag class="w-3.5 h-3.5 text-muted-foreground" />
      <span class="text-muted-foreground">Tags:</span>
      <Badge v-for="tag in metadata.tags" :key="tag" variant="secondary" class="text-xs">
        {{ tag }}
      </Badge>
    </div>

    <!-- Manual selection -->
    <div v-else-if="metadata.selectionType === 'manual' && metadata.testNames && metadata.testNames.length > 0" class="flex items-center gap-1.5">
      <ListChecks class="w-3.5 h-3.5 text-muted-foreground" />
      <span class="text-muted-foreground">Tests:</span>
      <span class="text-xs text-foreground">{{ metadata.testNames.length }} selected</span>
      <span v-if="metadata.testNames.length <= 3" class="text-xs text-muted-foreground">
        ({{ metadata.testNames.join(', ') }})
      </span>
    </div>

    <!-- Schedule with test names -->
    <div v-else-if="metadata.selectionType === 'schedule' && metadata.testNames && metadata.testNames.length > 0" class="flex items-center gap-1.5">
      <ListChecks class="w-3.5 h-3.5 text-muted-foreground" />
      <span class="text-muted-foreground">Tests:</span>
      <span class="text-xs text-foreground">{{ metadata.testNames.length }} selected</span>
      <span v-if="metadata.testNames.length <= 3" class="text-xs text-muted-foreground">
        ({{ metadata.testNames.join(', ') }})
      </span>
    </div>
  </div>
</template>
