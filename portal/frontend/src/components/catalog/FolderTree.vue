<script setup lang="ts">
import { ref } from 'vue'
import type { FolderNode } from '@/types'
import { ChevronRight, ChevronDown, Folder, FolderOpen } from 'lucide-vue-next'

const props = defineProps<{
  folders: FolderNode[]
  selectedFolder: string | null
  depth?: number
}>()

const emit = defineEmits<{
  select: [folderPath: string]
}>()

const expandedFolders = ref<Set<string>>(new Set())

function toggleExpand(path: string) {
  if (expandedFolders.value.has(path)) {
    expandedFolders.value.delete(path)
  } else {
    expandedFolders.value.add(path)
  }
  expandedFolders.value = new Set(expandedFolders.value)
}

function handleSelect(path: string) {
  emit('select', path)
}

function isExpanded(path: string): boolean {
  return expandedFolders.value.has(path)
}

function isSelected(path: string): boolean {
  return props.selectedFolder === path
}
</script>

<template>
  <div class="space-y-0.5">
    <div
      v-for="folder in folders"
      :key="folder.path"
    >
      <div
        class="flex items-center gap-1 px-2 py-1.5 rounded-md cursor-pointer transition-colors text-sm"
        :class="[
          isSelected(folder.path)
            ? 'bg-primary text-primary-foreground'
            : 'hover:bg-accent text-foreground'
        ]"
        :style="{ paddingLeft: `${(depth ?? 0) * 12 + 8}px` }"
        @click="handleSelect(folder.path)"
      >
        <!-- Expand/Collapse Toggle -->
        <button
          v-if="folder.children && folder.children.length > 0"
          class="p-0.5 -ml-1 rounded hover:bg-black/10"
          @click.stop="toggleExpand(folder.path)"
        >
          <ChevronDown
            v-if="isExpanded(folder.path)"
            class="w-3.5 h-3.5"
          />
          <ChevronRight v-else class="w-3.5 h-3.5" />
        </button>
        <div v-else class="w-4" />

        <!-- Folder Icon -->
        <FolderOpen
          v-if="isExpanded(folder.path) || isSelected(folder.path)"
          class="w-4 h-4 shrink-0"
        />
        <Folder v-else class="w-4 h-4 shrink-0" />

        <!-- Folder Name -->
        <span class="truncate flex-1">{{ folder.name }}</span>

        <!-- Test Count -->
        <span
          class="text-xs px-1.5 py-0.5 rounded-full"
          :class="[
            isSelected(folder.path)
              ? 'bg-primary-foreground/20 text-primary-foreground'
              : 'bg-muted text-muted-foreground'
          ]"
        >
          {{ folder.testCount }}
        </span>
      </div>

      <!-- Children -->
      <div v-if="folder.children && folder.children.length > 0 && isExpanded(folder.path)">
        <FolderTree
          :folders="folder.children"
          :selectedFolder="selectedFolder"
          :depth="(depth ?? 0) + 1"
          @select="emit('select', $event)"
        />
      </div>
    </div>
  </div>
</template>
