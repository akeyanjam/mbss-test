<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { toast } from 'vue-sonner'
import { useUserStore } from '@/stores'
import {
  getScheduleById,
  createSchedule,
  updateSchedule,
} from '@/api/client'
import type { Schedule, ScheduleSelector } from '@/types'

// Components
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Badge } from '@/components/ui/badge'
import {
  ArrowLeft,
  Save,
  Folder,
  Tag,
  FileText,
  AlertTriangle,
} from 'lucide-vue-next'

const route = useRoute()
const router = useRouter()
const userStore = useUserStore()

// State
const isLoading = ref(false)
const isSaving = ref(false)
const error = ref<string | null>(null)

// Form state
const name = ref('')
const cron = ref('0 0 2 * * *') // Default: 2 AM daily
const environment = ref('')
const selectorType = ref<'folder' | 'tags' | 'explicit'>('folder')
const folderPrefix = ref('')
const tags = ref<string[]>([])
const testKeys = ref<string[]>([])

// Computed
const isEditMode = computed(() => !!route.params.id)
const scheduleId = computed(() => route.params.id as string | undefined)

const isValid = computed(() => {
  if (!name.value.trim()) return false
  if (!cron.value.trim()) return false
  if (!environment.value) return false

  switch (selectorType.value) {
    case 'folder':
      return !!folderPrefix.value.trim()
    case 'tags':
      return tags.value.length > 0
    case 'explicit':
      return testKeys.value.length > 0
    default:
      return false
  }
})

const selector = computed((): ScheduleSelector => {
  switch (selectorType.value) {
    case 'folder':
      return { type: 'folder', folderPrefix: folderPrefix.value }
    case 'tags':
      return { type: 'tags', tags: [...tags.value] }
    case 'explicit':
      return { type: 'explicit', testKeys: [...testKeys.value] }
  }
})

// Common cron presets
const cronPresets = [
  { label: 'Every hour', value: '0 0 * * * *' },
  { label: 'Daily at 2 AM', value: '0 0 2 * * *' },
  { label: 'Daily at 6 AM', value: '0 0 6 * * *' },
  { label: 'Daily at midnight', value: '0 0 0 * * *' },
  { label: 'Weekdays at 6 AM', value: '0 0 6 * * 1-5' },
  { label: 'Every Sunday at 2 AM', value: '0 0 2 * * 0' },
]

// Load schedule if editing
async function loadSchedule() {
  if (!scheduleId.value) return

  isLoading.value = true
  error.value = null

  try {
    const schedule = await getScheduleById(scheduleId.value)
    populateForm(schedule)
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Failed to load schedule'
  } finally {
    isLoading.value = false
  }
}

function populateForm(schedule: Schedule) {
  name.value = schedule.name
  cron.value = schedule.cron
  environment.value = schedule.environment
  selectorType.value = schedule.selector.type

  switch (schedule.selector.type) {
    case 'folder':
      folderPrefix.value = schedule.selector.folderPrefix
      break
    case 'tags':
      tags.value = [...schedule.selector.tags]
      break
    case 'explicit':
      testKeys.value = [...schedule.selector.testKeys]
      break
  }
}

// Parse selector from query params (when coming from Test Catalog)
function parseQuerySelector() {
  const selectorParam = route.query.selector as string | undefined
  if (!selectorParam) return

  try {
    const parsed = JSON.parse(selectorParam) as ScheduleSelector
    selectorType.value = parsed.type

    switch (parsed.type) {
      case 'folder':
        folderPrefix.value = parsed.folderPrefix
        break
      case 'tags':
        tags.value = [...parsed.tags]
        break
      case 'explicit':
        testKeys.value = [...parsed.testKeys]
        break
    }
  } catch {
    // Invalid selector, ignore
  }
}

async function handleSubmit() {
  if (!isValid.value) return

  isSaving.value = true
  try {
    if (isEditMode.value && scheduleId.value) {
      await updateSchedule(scheduleId.value, {
        name: name.value,
        cron: cron.value,
        environment: environment.value,
        selector: selector.value,
        userEmail: userStore.email!,
      })
      toast.success('Schedule updated')
    } else {
      await createSchedule({
        name: name.value,
        cron: cron.value,
        environment: environment.value,
        selector: selector.value,
        userEmail: userStore.email!,
      })
      toast.success('Schedule created')
    }
    router.push('/schedules')
  } catch (e) {
    toast.error('Failed to save schedule', {
      description: e instanceof Error ? e.message : 'Unknown error',
    })
  } finally {
    isSaving.value = false
  }
}

// Initialize
onMounted(() => {
  if (isEditMode.value) {
    loadSchedule()
  } else {
    parseQuerySelector()
    // Default environment
    const nonProd = userStore.environments.find(e => !e.isProd)
    environment.value = nonProd?.code ?? userStore.environments[0]?.code ?? ''
  }
})

// Watch for environment changes to validate access
watch(environment, (env) => {
  if (env && !userStore.hasAccessTo(env)) {
    environment.value = ''
  }
})
</script>

<template>
  <div class="h-full flex flex-col">
    <!-- Header -->
    <div class="border-b border-border bg-card px-6 py-4">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-4">
          <Button variant="ghost" size="icon" @click="router.push('/schedules')">
            <ArrowLeft class="w-4 h-4" />
          </Button>
          <div>
            <h1 class="text-xl font-semibold text-foreground">
              {{ isEditMode ? 'Edit Schedule' : 'New Schedule' }}
            </h1>
            <p class="text-sm text-muted-foreground mt-0.5">
              {{ isEditMode ? 'Modify schedule settings' : 'Create a new scheduled test run' }}
            </p>
          </div>
        </div>
        <Button :disabled="!isValid || isSaving" @click="handleSubmit">
          <Save class="w-4 h-4 mr-2" />
          {{ isSaving ? 'Saving...' : 'Save Schedule' }}
        </Button>
      </div>
    </div>

    <!-- Loading State -->
    <div v-if="isLoading" class="flex-1 p-6">
      <div class="max-w-2xl mx-auto space-y-4">
        <Skeleton class="h-10 w-full" />
        <Skeleton class="h-10 w-full" />
        <Skeleton class="h-32 w-full" />
      </div>
    </div>

    <!-- Error State -->
    <div v-else-if="error" class="flex-1 p-6">
      <div class="text-center py-12">
        <p class="text-destructive">{{ error }}</p>
        <Button variant="outline" class="mt-4" @click="loadSchedule">
          Retry
        </Button>
      </div>
    </div>

    <!-- Form -->
    <div v-else class="flex-1 overflow-auto p-6">
      <div class="max-w-2xl mx-auto space-y-6">
        <!-- Basic Info -->
        <Card>
          <CardHeader>
            <CardTitle>Basic Information</CardTitle>
            <CardDescription>Name and timing for this schedule</CardDescription>
          </CardHeader>
          <CardContent class="space-y-4">
            <!-- Name -->
            <div class="space-y-2">
              <Label for="name">Schedule Name</Label>
              <Input
                id="name"
                v-model="name"
                placeholder="e.g., Nightly Smoke Tests"
              />
            </div>

            <!-- Cron -->
            <div class="space-y-2">
              <Label for="cron">Schedule (Cron Expression)</Label>
              <div class="flex gap-2">
                <Input
                  id="cron"
                  v-model="cron"
                  placeholder="0 0 2 * * *"
                  class="font-mono"
                />
                <Select v-model="cron">
                  <SelectTrigger class="w-[200px]">
                    <SelectValue placeholder="Presets" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem
                      v-for="preset in cronPresets"
                      :key="preset.value"
                      :value="preset.value"
                    >
                      {{ preset.label }}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <p class="text-xs text-muted-foreground">
                Format: second minute hour day-of-month month day-of-week
              </p>
            </div>

            <!-- Environment -->
            <div class="space-y-2">
              <Label>Target Environment</Label>
              <Select v-model="environment">
                <SelectTrigger>
                  <SelectValue placeholder="Select environment" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem
                    v-for="env in userStore.environments"
                    :key="env.code"
                    :value="env.code"
                  >
                    <div class="flex items-center gap-2">
                      <span>{{ env.name }}</span>
                      <span class="text-xs text-muted-foreground">({{ env.code }})</span>
                      <span
                        v-if="env.isProd"
                        class="text-xs bg-destructive/10 text-destructive px-1.5 py-0.5 rounded"
                      >
                        PROD
                      </span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <!-- Test Selection -->
        <Card>
          <CardHeader>
            <CardTitle>Test Selection</CardTitle>
            <CardDescription>Choose which tests to run on this schedule</CardDescription>
          </CardHeader>
          <CardContent class="space-y-4">
            <!-- Selector Type -->
            <RadioGroup v-model="selectorType" class="space-y-3">
              <div class="flex items-start space-x-3">
                <RadioGroupItem value="folder" id="folder" />
                <div class="flex-1">
                  <Label for="folder" class="flex items-center gap-2 cursor-pointer">
                    <Folder class="w-4 h-4" />
                    By Folder
                  </Label>
                  <p class="text-xs text-muted-foreground mt-0.5">
                    Run all tests in a specific folder
                  </p>
                </div>
              </div>
              <div class="flex items-start space-x-3">
                <RadioGroupItem value="tags" id="tags" />
                <div class="flex-1">
                  <Label for="tags" class="flex items-center gap-2 cursor-pointer">
                    <Tag class="w-4 h-4" />
                    By Tags
                  </Label>
                  <p class="text-xs text-muted-foreground mt-0.5">
                    Run all tests matching specific tags
                  </p>
                </div>
              </div>
              <div class="flex items-start space-x-3">
                <RadioGroupItem value="explicit" id="explicit" />
                <div class="flex-1">
                  <Label for="explicit" class="flex items-center gap-2 cursor-pointer">
                    <FileText class="w-4 h-4" />
                    Specific Tests
                  </Label>
                  <p class="text-xs text-muted-foreground mt-0.5">
                    Run a specific list of tests
                  </p>
                </div>
              </div>
            </RadioGroup>

            <!-- Folder Input -->
            <div v-if="selectorType === 'folder'" class="pt-4 border-t border-border">
              <Label for="folderPrefix">Folder Path</Label>
              <Input
                id="folderPrefix"
                v-model="folderPrefix"
                placeholder="e.g., auth or auth/login"
                class="mt-2"
              />
              <p class="text-xs text-muted-foreground mt-1">
                All tests in this folder and subfolders will be included
              </p>
            </div>

            <!-- Tags Input -->
            <div v-if="selectorType === 'tags'" class="pt-4 border-t border-border">
              <Label>Tags</Label>
              <div class="flex flex-wrap gap-2 mt-2">
                <Badge
                  v-for="tag in tags"
                  :key="tag"
                  variant="secondary"
                  class="gap-1"
                >
                  {{ tag }}
                  <button
                    @click="tags = tags.filter(t => t !== tag)"
                    class="ml-1 hover:text-destructive"
                  >
                    ×
                  </button>
                </Badge>
              </div>
              <div class="flex gap-2 mt-2">
                <Input
                  placeholder="Add tag..."
                  @keydown.enter.prevent="(e: KeyboardEvent) => {
                    const input = e.target as HTMLInputElement
                    const value = input.value.trim()
                    if (value && !tags.includes(value)) {
                      tags.push(value)
                      input.value = ''
                    }
                  }"
                />
              </div>
              <p class="text-xs text-muted-foreground mt-1">
                Tests matching any of these tags will be included
              </p>
            </div>

            <!-- Explicit Tests -->
            <div v-if="selectorType === 'explicit'" class="pt-4 border-t border-border">
              <Label>Test Keys</Label>
              <div class="flex flex-wrap gap-2 mt-2">
                <Badge
                  v-for="key in testKeys"
                  :key="key"
                  variant="secondary"
                  class="gap-1"
                >
                  {{ key }}
                  <button
                    @click="testKeys = testKeys.filter(k => k !== key)"
                    class="ml-1 hover:text-destructive"
                  >
                    ×
                  </button>
                </Badge>
              </div>
              <div v-if="testKeys.length === 0" class="mt-2 p-4 bg-muted/50 rounded-md">
                <div class="flex items-start gap-2">
                  <AlertTriangle class="w-4 h-4 text-amber-500 mt-0.5" />
                  <div class="text-sm">
                    <p class="font-medium">No tests selected</p>
                    <p class="text-muted-foreground mt-0.5">
                      Go to the Test Catalog, select tests, and click "Schedule" to pre-populate this list.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  </div>
</template>
