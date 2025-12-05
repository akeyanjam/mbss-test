<script setup lang="ts">
import { onMounted, computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { toast } from 'vue-sonner'
import { useTestsStore, useUserStore } from '@/stores'
import { createRun } from '@/api/client'
import type { ScheduleSelector } from '@/types'

// Components
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Skeleton } from '@/components/ui/skeleton'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '@/components/ui/resizable'
import FolderTree from '@/components/catalog/FolderTree.vue'
import TagFilter from '@/components/catalog/TagFilter.vue'
import RunDialog from '@/components/catalog/RunDialog.vue'
import TestStatusBadge from '@/components/shared/TestStatusBadge.vue'
import {
  Play,
  Calendar,
  CheckSquare,
  Square,
  FolderOpen,
  Tag,
  X,
} from 'lucide-vue-next'

const router = useRouter()
const testsStore = useTestsStore()
const userStore = useUserStore()

const showRunDialog = ref(false)
const isCreatingRun = ref(false)

onMounted(() => {
  testsStore.fetchTests()
})

// Computed
// Force reactivity by depending on selectedCount
function isTestSelected(testKey: string): boolean {
  void testsStore.selectedCount // trigger reactivity
  return testsStore.selectedTestKeys.has(testKey)
}

const allFilteredSelected = computed(() => {
  void testsStore.selectedCount // trigger reactivity
  if (testsStore.filteredTests.length === 0) return false
  return testsStore.filteredTests.every(t => testsStore.selectedTestKeys.has(t.testKey))
})

const someFilteredSelected = computed(() => {
  void testsStore.selectedCount // trigger reactivity
  if (testsStore.filteredTests.length === 0) return false
  const selected = testsStore.filteredTests.filter(t => testsStore.selectedTestKeys.has(t.testKey))
  return selected.length > 0 && selected.length < testsStore.filteredTests.length
})

const hasActiveFilters = computed(() => {
  return testsStore.selectedFolder !== null || testsStore.selectedTags.length > 0
})

// Build selector for schedule based on current selection method
const scheduleSelector = computed((): ScheduleSelector | null => {
  if (testsStore.selectedFolder) {
    return { type: 'folder', folderPrefix: testsStore.selectedFolder }
  }
  if (testsStore.selectedTags.length > 0) {
    return { type: 'tags', tags: [...testsStore.selectedTags] }
  }
  if (testsStore.selectedTestKeys.size > 0) {
    return { type: 'explicit', testKeys: Array.from(testsStore.selectedTestKeys) }
  }
  return null
})

// Actions
function toggleSelectAll() {
  if (allFilteredSelected.value) {
    testsStore.deselectAllFiltered()
  } else {
    testsStore.selectAllFiltered()
  }
}

function handleFolderSelect(folderPath: string) {
  testsStore.selectFolder(folderPath)
}

function clearFolderSelection() {
  testsStore.setSelectedFolder(null)
  testsStore.clearSelection()
}

function clearAllFilters() {
  testsStore.clearFilters()
  testsStore.clearSelection()
}

async function handleRunCreate(environment: string) {
  if (testsStore.selectedTestKeys.size === 0) return

  isCreatingRun.value = true
  try {
    // Build metadata based on selection method
    const metadata: import('@/types').RunMetadata = testsStore.selectedFolder
      ? {
          selectionType: 'folder',
          folder: testsStore.selectedFolder,
        }
      : testsStore.selectedTags.length > 0
      ? {
          selectionType: 'tags',
          tags: [...testsStore.selectedTags],
        }
      : {
          selectionType: 'manual',
          testNames: Array.from(testsStore.selectedTestKeys),
        }

    const run = await createRun({
      testKeys: Array.from(testsStore.selectedTestKeys),
      environment,
      userEmail: userStore.email!,
      metadata,
    })

    toast.success('Run created', {
      description: `Started ${testsStore.selectedTestKeys.size} test(s) on ${environment}`,
    })

    testsStore.clearSelection()
    showRunDialog.value = false
    router.push(`/runs/${run.id}`)
  } catch (e) {
    toast.error('Failed to create run', {
      description: e instanceof Error ? e.message : 'Unknown error',
    })
  } finally {
    isCreatingRun.value = false
  }
}

function handleScheduleClick() {
  if (!scheduleSelector.value) return
  
  // Navigate to schedule editor with selector in query
  router.push({
    name: 'schedule-new',
    query: {
      selector: JSON.stringify(scheduleSelector.value),
    },
  })
}
</script>

<template>
  <div class="flex flex-col h-[calc(100vh-8rem)]">
    <!-- Page Header -->
    <div class="flex items-center justify-between mb-6">
      <div>
        <h1 class="text-3xl font-bold tracking-tight">Test Catalog</h1>
        <p class="text-muted-foreground mt-1">
          {{ testsStore.tests.length }} tests available
        </p>
      </div>
      <div class="flex items-center gap-2">
        <Button
          variant="outline"
          :disabled="!testsStore.hasSelection"
          @click="handleScheduleClick"
        >
          <Calendar class="w-4 h-4 mr-2" />
          Schedule
        </Button>
        <Button
          :disabled="!testsStore.hasSelection"
          @click="showRunDialog = true"
        >
          <Play class="w-4 h-4 mr-2" />
          Run Selected ({{ testsStore.selectedCount }})
        </Button>
      </div>
    </div>

    <!-- Main Content -->
    <div class="flex-1 rounded-lg border bg-card overflow-hidden">
      <ResizablePanelGroup direction="horizontal" class="h-full">
      <!-- Sidebar -->
      <ResizablePanel :defaultSize="25" :minSize="15" :maxSize="40">
        <div class="h-full flex flex-col border-r border-border bg-card">
          <!-- Folder Tree -->
          <div class="flex-1 overflow-hidden">
            <div class="px-4 py-3 border-b border-border">
              <h2 class="text-sm font-medium text-foreground flex items-center gap-2">
                <FolderOpen class="w-4 h-4" />
                Folders
              </h2>
            </div>
            <ScrollArea class="h-[calc(100%-48px)]">
              <div class="p-2">
                <template v-if="testsStore.isLoading">
                  <div class="space-y-2 p-2">
                    <Skeleton class="h-6 w-full" />
                    <Skeleton class="h-6 w-3/4 ml-4" />
                    <Skeleton class="h-6 w-2/3 ml-4" />
                    <Skeleton class="h-6 w-full" />
                  </div>
                </template>
                <FolderTree
                  v-else
                  :folders="testsStore.folders"
                  :selectedFolder="testsStore.selectedFolder"
                  @select="handleFolderSelect"
                />
              </div>
            </ScrollArea>
          </div>

          <!-- Tag Filter -->
          <div class="border-t border-border">
            <div class="px-4 py-3 border-b border-border">
              <h2 class="text-sm font-medium text-foreground flex items-center gap-2">
                <Tag class="w-4 h-4" />
                Tags
              </h2>
            </div>
            <div class="p-3">
              <TagFilter
                :tags="testsStore.tags"
                :selectedTags="testsStore.selectedTags"
                @toggle="testsStore.toggleTag"
              />
            </div>
          </div>
        </div>
      </ResizablePanel>

      <ResizableHandle />

      <!-- Test List -->
      <ResizablePanel :defaultSize="75">
        <div class="h-full flex flex-col">
          <!-- Active Filters Bar -->
          <div v-if="hasActiveFilters" class="px-4 py-2 bg-muted/50 border-b border-border flex items-center gap-2 flex-wrap">
            <span class="text-xs text-muted-foreground">Showing:</span>
            <Badge
              v-if="testsStore.selectedFolder"
              variant="secondary"
              class="gap-1 pr-1"
            >
              <FolderOpen class="w-3 h-3" />
              {{ testsStore.selectedFolder }}
              <button
                @click="clearFolderSelection"
                class="ml-1 hover:bg-accent rounded p-0.5"
              >
                <X class="w-3 h-3" />
              </button>
            </Badge>
            <Badge
              v-for="tag in testsStore.selectedTags"
              :key="tag"
              variant="secondary"
              class="gap-1 pr-1"
            >
              <Tag class="w-3 h-3" />
              {{ tag }}
              <button
                @click="testsStore.toggleTag(tag)"
                class="ml-1 hover:bg-accent rounded p-0.5"
              >
                <X class="w-3 h-3" />
              </button>
            </Badge>
            <Button
              variant="ghost"
              size="sm"
              class="h-6 text-xs"
              @click="clearAllFilters"
            >
              Clear all
            </Button>
          </div>

          <!-- Table Header -->
          <div class="px-4 py-2 border-b border-border bg-muted/30 flex items-center gap-4">
            <button
              @click="toggleSelectAll"
              class="flex items-center justify-center w-5 h-5"
            >
              <CheckSquare
                v-if="allFilteredSelected"
                class="w-4 h-4 text-primary"
              />
              <div
                v-else-if="someFilteredSelected"
                class="w-4 h-4 border-2 border-primary rounded flex items-center justify-center"
              >
                <div class="w-2 h-2 bg-primary rounded-sm" />
              </div>
              <Square v-else class="w-4 h-4 text-muted-foreground" />
            </button>
            <div class="flex-1 text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Test Name
            </div>
            <div class="w-32 text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Tags
            </div>
            <div class="w-24 text-xs font-medium text-muted-foreground uppercase tracking-wide text-center">
              Status
            </div>
          </div>

          <!-- Test List -->
          <ScrollArea class="flex-1">
            <div v-if="testsStore.isLoading" class="p-4 space-y-3">
              <Skeleton v-for="i in 8" :key="i" class="h-12 w-full" />
            </div>
            <div v-else-if="testsStore.filteredTests.length === 0" class="p-8 text-center">
              <p class="text-muted-foreground">No tests found</p>
              <Button
                v-if="hasActiveFilters"
                variant="link"
                @click="testsStore.clearFilters"
              >
                Clear filters
              </Button>
            </div>
            <div v-else>
              <div
                v-for="test in testsStore.filteredTests"
                :key="test.testKey"
                class="px-4 py-3 border-b border-border hover:bg-muted/30 flex items-center gap-4 cursor-pointer transition-colors"
                @click="testsStore.toggleTestSelection(test.testKey)"
              >
                <Checkbox
                  :model-value="isTestSelected(test.testKey)"
                  @click.stop
                  @update:model-value="testsStore.toggleTestSelection(test.testKey)"
                />
                <div class="flex-1 min-w-0">
                  <p class="font-medium text-foreground truncate">
                    {{ test.friendlyName }}
                  </p>
                  <p class="text-xs text-muted-foreground truncate">
                    {{ test.folderPath }}
                  </p>
                </div>
                <div class="w-32 flex flex-wrap gap-1">
                  <Badge
                    v-for="tag in (test.tags || []).slice(0, 2)"
                    :key="tag"
                    variant="outline"
                    class="text-xs"
                  >
                    {{ tag }}
                  </Badge>
                  <Badge
                    v-if="test.tags && test.tags.length > 2"
                    variant="outline"
                    class="text-xs"
                  >
                    +{{ test.tags.length - 2 }}
                  </Badge>
                </div>
                <div class="w-24 flex justify-center">
                  <TestStatusBadge status="pending" />
                </div>
              </div>
            </div>
          </ScrollArea>
        </div>
      </ResizablePanel>
      </ResizablePanelGroup>
    </div>

    <!-- Run Dialog -->
    <RunDialog
      :open="showRunDialog"
      :testCount="testsStore.selectedCount"
      :isLoading="isCreatingRun"
      @close="showRunDialog = false"
      @submit="handleRunCreate"
    />
  </div>
</template>
