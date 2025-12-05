<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { toast } from 'vue-sonner'
import { getSchedules, deleteSchedule, toggleSchedule } from '@/api/client'
import type { Schedule } from '@/types'

// Components
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import EnvironmentBadge from '@/components/shared/EnvironmentBadge.vue'
import {
  Plus,
  RefreshCw,
  Pencil,
  Trash2,
  Clock,
  Folder,
  Tag,
  FileText,
  Inbox,
} from 'lucide-vue-next'

const router = useRouter()

// State
const schedules = ref<Schedule[]>([])
const isLoading = ref(true)
const error = ref<string | null>(null)
const isRefreshing = ref(false)
const deleteDialogOpen = ref(false)
const scheduleToDelete = ref<Schedule | null>(null)
const isDeleting = ref(false)
const togglingIds = ref<Set<string>>(new Set())

// Fetch schedules
async function fetchSchedules(showRefresh = false) {
  if (showRefresh) {
    isRefreshing.value = true
  } else {
    isLoading.value = true
  }
  error.value = null

  try {
    const data = await getSchedules()
    schedules.value = data.schedules
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Failed to fetch schedules'
  } finally {
    isLoading.value = false
    isRefreshing.value = false
  }
}

async function handleToggle(schedule: Schedule) {
  const originalState = schedule.enabled
  togglingIds.value.add(schedule.id)
  
  try {
    console.log('Toggling schedule:', schedule.id, 'from', originalState, 'to', !originalState)
    const updatedSchedule = await toggleSchedule(schedule.id, !originalState)
    console.log('Toggle response:', updatedSchedule)
    
    // Replace the entire array to trigger reactivity
    const index = schedules.value.findIndex(s => s.id === schedule.id)
    if (index !== -1) {
      schedules.value = [
        ...schedules.value.slice(0, index),
        updatedSchedule,
        ...schedules.value.slice(index + 1)
      ]
    }
    
    toast.success(updatedSchedule.enabled ? 'Schedule enabled' : 'Schedule disabled')
  } catch (e) {
    toast.error('Failed to toggle schedule', {
      description: e instanceof Error ? e.message : 'Unknown error',
    })
    console.error('Toggle error:', e)
  } finally {
    togglingIds.value.delete(schedule.id)
  }
}

function confirmDelete(schedule: Schedule) {
  scheduleToDelete.value = schedule
  deleteDialogOpen.value = true
}

async function handleDelete() {
  if (!scheduleToDelete.value) return

  isDeleting.value = true
  try {
    await deleteSchedule(scheduleToDelete.value.id)
    schedules.value = schedules.value.filter(s => s.id !== scheduleToDelete.value!.id)
    toast.success('Schedule deleted')
    deleteDialogOpen.value = false
  } catch (e) {
    toast.error('Failed to delete schedule', {
      description: e instanceof Error ? e.message : 'Unknown error',
    })
  } finally {
    isDeleting.value = false
    scheduleToDelete.value = null
  }
}

function getSelectorLabel(schedule: Schedule): { icon: typeof Folder; text: string } {
  switch (schedule.selector.type) {
    case 'folder':
      return { icon: Folder, text: `Folder: ${schedule.selector.folderPrefix}` }
    case 'tags':
      return { icon: Tag, text: `Tags: ${schedule.selector.tags.join(', ')}` }
    case 'explicit':
      return { icon: FileText, text: `${schedule.selector.testKeys.length} specific tests` }
    default:
      return { icon: FileText, text: 'Unknown selector' }
  }
}

function formatCron(cron: string): string {
  // Simple cron description - could be enhanced with a library
  const parts = cron.split(' ')
  if (parts.length < 5) return cron

  // Check for common patterns
  if (cron === '0 0 * * *') return 'Daily at midnight'
  if (cron === '0 0 * * 1-5') return 'Weekdays at midnight'
  if (cron.startsWith('0 ') && parts[2] === '*' && parts[3] === '*' && parts[4] === '*') {
    const hour = parseInt(parts[1] ?? '0')
    const ampm = hour >= 12 ? 'PM' : 'AM'
    const hour12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour
    return `Daily at ${hour12}:00 ${ampm}`
  }

  return cron
}

function formatLastTriggered(dateStr: string | undefined): string {
  if (!dateStr) return 'Never'
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffHours < 1) return 'Less than an hour ago'
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  return date.toLocaleDateString()
}

onMounted(() => {
  fetchSchedules()
})
</script>

<template>
  <div class="flex flex-col max-w-[1400px]">
    <!-- Header -->
    <div class="flex items-center justify-between mb-6">
      <div>
        <h1 class="text-3xl font-bold tracking-tight">Schedules</h1>
        <p class="text-muted-foreground mt-1">
          {{ schedules.length }} scheduled test runs
        </p>
      </div>
      <div class="flex items-center gap-2">
        <Button
          variant="outline"
          size="icon"
          @click="fetchSchedules(true)"
          :disabled="isRefreshing"
        >
          <RefreshCw class="w-4 h-4" :class="{ 'animate-spin': isRefreshing }" />
        </Button>
        <Button @click="router.push('/schedules/new')">
          <Plus class="w-4 h-4 mr-2" />
          New Schedule
        </Button>
      </div>
    </div>

    <!-- Loading State -->
    <div v-if="isLoading" class="space-y-3">
      <div class="space-y-3">
        <Skeleton v-for="i in 5" :key="i" class="h-24 w-full" />
      </div>
    </div>

    <!-- Error State -->
    <div v-else-if="error">
      <div class="text-center py-12">
        <p class="text-destructive">{{ error }}</p>
        <Button variant="outline" class="mt-4" @click="fetchSchedules()">
          Retry
        </Button>
      </div>
    </div>

    <!-- Empty State -->
    <div v-else-if="schedules.length === 0">
      <div class="text-center py-12">
        <Inbox class="w-12 h-12 text-muted-foreground mx-auto mb-4" />
        <p class="text-muted-foreground mb-4">No schedules yet</p>
        <p class="text-sm text-muted-foreground mb-4">
          Create a schedule from the Test Catalog by selecting tests and clicking "Schedule"
        </p>
        <Button @click="router.push('/catalog')">
          Go to Test Catalog
        </Button>
      </div>
    </div>

    <!-- Schedules List -->
    <div v-else class="space-y-3">
        <div
          v-for="schedule in schedules"
          :key="schedule.id"
          class="p-4 rounded-lg border border-border bg-card"
        >
          <div class="flex items-start justify-between gap-4">
            <!-- Left: Info -->
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-3">
                <h3 class="font-medium text-foreground">{{ schedule.name }}</h3>
                <Badge v-if="!schedule.enabled" variant="outline" class="text-xs">
                  Disabled
                </Badge>
              </div>

              <div class="mt-2 flex items-center gap-4 flex-wrap">
                <EnvironmentBadge :code="schedule.environment" />
                <span class="flex items-center gap-1 text-sm text-muted-foreground">
                  <Clock class="w-3.5 h-3.5" />
                  {{ formatCron(schedule.cron) }}
                </span>
                <span class="flex items-center gap-1 text-sm text-muted-foreground">
                  <component :is="getSelectorLabel(schedule).icon" class="w-3.5 h-3.5" />
                  {{ getSelectorLabel(schedule).text }}
                </span>
              </div>

              <div class="mt-2 text-xs text-muted-foreground">
                Last triggered: {{ formatLastTriggered(schedule.lastTriggeredAt) }}
              </div>
            </div>

            <!-- Right: Actions -->
            <div class="flex items-center gap-3 shrink-0">
              <Switch
                :model-value="schedule.enabled"
                :disabled="togglingIds.has(schedule.id)"
                @update:model-value="() => handleToggle(schedule)"
              />
              <Button
                variant="ghost"
                size="icon"
                @click="router.push(`/schedules/${schedule.id}/edit`)"
              >
                <Pencil class="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                class="text-destructive hover:text-destructive"
                @click="confirmDelete(schedule)"
              >
                <Trash2 class="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
    </div>

    <!-- Delete Confirmation Dialog -->
    <AlertDialog :open="deleteDialogOpen" @update:open="deleteDialogOpen = $event">
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Schedule</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to delete "{{ scheduleToDelete?.name }}"?
            This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel :disabled="isDeleting">Cancel</AlertDialogCancel>
          <AlertDialogAction
            class="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            :disabled="isDeleting"
            @click="handleDelete"
          >
            {{ isDeleting ? 'Deleting...' : 'Delete' }}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </div>
</template>
