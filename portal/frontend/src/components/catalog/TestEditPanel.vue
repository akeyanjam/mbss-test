<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { toast } from 'vue-sonner'
import { useUserStore } from '@/stores'
import { getTestByKey, updateTestOverrides } from '@/api/client'
import type { TestDefinition, TestConstants } from '@/types'

// UI Components
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import { VisuallyHidden } from 'reka-ui'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
import KeyValueEditor from './KeyValueEditor.vue'
import {
  FolderOpen,
  Tag,
  Save,
  Loader2,
  AlertCircle,
} from 'lucide-vue-next'

interface KeyValuePair {
  key: string
  value: string
}

const props = defineProps<{
  open: boolean
  testKey: string | null
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'saved', test: TestDefinition): void
}>()

const userStore = useUserStore()

// State
const isLoading = ref(false)
const isSaving = ref(false)
const error = ref<string | null>(null)
const test = ref<TestDefinition | null>(null)

// Working copy of overrides (what user is editing)
const workingOverrides = ref<TestConstants>({})
const hasChanges = ref(false)

// All environments from user store
const allEnvironments = computed(() => userStore.environments)

// Current active tab
const activeTab = ref<string>('')

// Load test data when panel opens
watch(() => [props.open, props.testKey], async ([open, testKey]) => {
  if (open && testKey && typeof testKey === 'string') {
    await loadTest(testKey)
  } else {
    // Reset state when closed
    test.value = null
    workingOverrides.value = {}
    hasChanges.value = false
    error.value = null
  }
}, { immediate: true })

// Set default active tab when environments load
watch(allEnvironments, (envs) => {
  if (envs && envs.length > 0 && !activeTab.value) {
    activeTab.value = envs[0].code
  }
}, { immediate: true })

async function loadTest(testKey: string) {
  isLoading.value = true
  error.value = null
  
  try {
    const data = await getTestByKey(testKey)
    test.value = data
    // Initialize working overrides from existing overrides
    workingOverrides.value = JSON.parse(JSON.stringify(data.overrides || {}))
    hasChanges.value = false
    
    // Set active tab to first environment
    if (allEnvironments.value && allEnvironments.value.length > 0) {
      activeTab.value = allEnvironments.value[0].code
    }
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Failed to load test'
  } finally {
    isLoading.value = false
  }
}

// Get merged values for an environment (constants + overrides)
function getMergedEnvValues(envCode: string): KeyValuePair[] {
  if (!test.value) return []
  
  const constants = test.value.constants
  const overrides = workingOverrides.value
  
  // Start with constants for this env
  const envConstants = constants.environments?.[envCode] || {}
  const envOverrides = overrides.environments?.[envCode] || {}
  
  // Merge: overrides take precedence
  const merged: Record<string, string> = { ...envConstants as Record<string, string> }
  Object.assign(merged, envOverrides as Record<string, string>)
  
  return Object.entries(merged).map(([key, value]) => ({
    key,
    value: String(value),
  }))
}

// Get original values for an environment (from constants only)
function getOriginalEnvValues(envCode: string): KeyValuePair[] {
  if (!test.value) return []
  
  const envConstants = test.value.constants.environments?.[envCode] || {}
  
  return Object.entries(envConstants).map(([key, value]) => ({
    key,
    value: String(value),
  }))
}

// Get merged shared values
function getMergedSharedValues(): KeyValuePair[] {
  if (!test.value) return []
  
  const sharedConstants = test.value.constants.shared || {}
  const sharedOverrides = workingOverrides.value.shared || {}
  
  const merged: Record<string, string> = { ...sharedConstants as Record<string, string> }
  Object.assign(merged, sharedOverrides as Record<string, string>)
  
  return Object.entries(merged).map(([key, value]) => ({
    key,
    value: String(value),
  }))
}

// Get original shared values
function getOriginalSharedValues(): KeyValuePair[] {
  if (!test.value) return []
  
  const sharedConstants = test.value.constants.shared || {}
  
  return Object.entries(sharedConstants).map(([key, value]) => ({
    key,
    value: String(value),
  }))
}

// Update environment values
function updateEnvValues(envCode: string, items: KeyValuePair[]) {
  if (!test.value) return
  
  // Build the new override for this environment
  const originalEnv = test.value.constants.environments?.[envCode] || {}
  const newOverrides: Record<string, string> = {}
  
  for (const item of items) {
    const originalValue = originalEnv[item.key]
    // Only store as override if different from original or new key
    if (originalValue === undefined || String(originalValue) !== item.value) {
      newOverrides[item.key] = item.value
    }
  }
  
  // Also track deletions: if original had a key that's not in items, we need to handle it
  // For now, we'll just store what's different
  
  // Update working overrides
  if (!workingOverrides.value.environments) {
    workingOverrides.value.environments = {}
  }
  
  if (Object.keys(newOverrides).length > 0) {
    workingOverrides.value.environments[envCode] = newOverrides
  } else {
    delete workingOverrides.value.environments[envCode]
  }
  
  hasChanges.value = true
}

// Update shared values
function updateSharedValues(items: KeyValuePair[]) {
  if (!test.value) return
  
  const originalShared = test.value.constants.shared || {}
  const newOverrides: Record<string, string> = {}
  
  for (const item of items) {
    const originalValue = originalShared[item.key]
    if (originalValue === undefined || String(originalValue) !== item.value) {
      newOverrides[item.key] = item.value
    }
  }
  
  if (Object.keys(newOverrides).length > 0) {
    workingOverrides.value.shared = newOverrides
  } else {
    delete workingOverrides.value.shared
  }
  
  hasChanges.value = true
}

// Reset environment overrides
function resetEnvOverrides(envCode: string) {
  if (workingOverrides.value.environments) {
    delete workingOverrides.value.environments[envCode]
    if (Object.keys(workingOverrides.value.environments).length === 0) {
      delete workingOverrides.value.environments
    }
  }
  hasChanges.value = true
}

// Reset shared overrides
function resetSharedOverrides() {
  delete workingOverrides.value.shared
  hasChanges.value = true
}

// Check if user has access to an environment
function hasEnvAccess(envCode: string): boolean {
  return userStore.hasAccessTo(envCode)
}

// Save overrides
async function saveOverrides() {
  if (!test.value || !props.testKey) return
  
  isSaving.value = true
  
  try {
    // Clean up empty objects
    const cleanOverrides: TestConstants = {}
    if (workingOverrides.value.shared && Object.keys(workingOverrides.value.shared).length > 0) {
      cleanOverrides.shared = workingOverrides.value.shared
    }
    if (workingOverrides.value.environments) {
      const envs: Record<string, Record<string, unknown>> = {}
      for (const [env, values] of Object.entries(workingOverrides.value.environments)) {
        if (values && Object.keys(values).length > 0) {
          envs[env] = values
        }
      }
      if (Object.keys(envs).length > 0) {
        cleanOverrides.environments = envs
      }
    }
    
    const updated = await updateTestOverrides(props.testKey, cleanOverrides as Record<string, unknown>)
    test.value = updated
    workingOverrides.value = JSON.parse(JSON.stringify(updated.overrides || {}))
    hasChanges.value = false
    
    toast.success('Overrides saved', {
      description: `Configuration for ${test.value.friendlyName} has been updated.`,
    })
    
    emit('saved', updated)
  } catch (e) {
    toast.error('Failed to save overrides', {
      description: e instanceof Error ? e.message : 'Unknown error',
    })
  } finally {
    isSaving.value = false
  }
}

function handleClose() {
  emit('close')
}
</script>

<template>
  <Sheet :open="open" @update:open="(val) => !val && handleClose()">
    <SheetContent 
      side="right" 
      class="w-full sm:max-w-[50vw] p-0 flex flex-col"
      :aria-describedby="undefined"
    >
      <!-- Hidden title for accessibility when loading/error -->
      <VisuallyHidden v-if="isLoading || error || !test" as-child>
        <SheetTitle>Test Configuration</SheetTitle>
      </VisuallyHidden>

      <!-- Loading State -->
      <div v-if="isLoading" class="flex-1 p-6 space-y-4">
        <Skeleton class="h-8 w-3/4" />
        <Skeleton class="h-4 w-1/2" />
        <Skeleton class="h-4 w-full" />
        <div class="pt-4 space-y-2">
          <Skeleton class="h-10 w-full" />
          <Skeleton class="h-32 w-full" />
        </div>
      </div>

      <!-- Error State -->
      <div v-else-if="error" class="flex-1 p-6 flex flex-col items-center justify-center gap-4">
        <AlertCircle class="w-12 h-12 text-destructive" />
        <p class="text-destructive text-center">{{ error }}</p>
        <Button variant="outline" @click="handleClose">Close</Button>
      </div>

      <!-- Content -->
      <template v-else-if="test">
        <!-- Header -->
        <SheetHeader class="px-6 pt-6 pb-4 border-b border-border">
          <div class="flex items-start justify-between gap-4 pr-8">
            <div class="space-y-1 min-w-0">
              <SheetTitle class="text-xl font-semibold truncate">
                {{ test.friendlyName }}
              </SheetTitle>
              <SheetDescription v-if="test.description" class="text-sm text-muted-foreground line-clamp-2">
                {{ test.description }}
              </SheetDescription>
            </div>
            <!-- Save Button -->
            <Button
              v-if="hasChanges"
              size="sm"
              class="shrink-0"
              :disabled="isSaving"
              @click="saveOverrides"
            >
              <Loader2 v-if="isSaving" class="w-4 h-4 mr-2 animate-spin" />
              <Save v-else class="w-4 h-4 mr-2" />
              Save
            </Button>
          </div>

          <!-- Test Info -->
          <div class="flex flex-wrap items-center gap-3 mt-3 text-sm text-muted-foreground">
            <div class="flex items-center gap-1.5">
              <FolderOpen class="w-4 h-4" />
              <span class="font-mono text-xs">{{ test.folderPath }}</span>
            </div>
          </div>

          <!-- Tags -->
          <div v-if="test.tags && test.tags.length > 0" class="flex flex-wrap items-center gap-2 mt-3">
            <Tag class="w-4 h-4 text-muted-foreground" />
            <Badge
              v-for="tag in test.tags"
              :key="tag"
              variant="secondary"
              class="text-xs"
            >
              {{ tag }}
            </Badge>
          </div>
        </SheetHeader>

        <!-- Configuration Editor -->
        <ScrollArea class="flex-1">
          <div class="p-6 space-y-6">
            <!-- Environment Tabs -->
            <div>
              <h3 class="text-sm font-medium text-foreground mb-3">Environment Configuration</h3>
              
              <Tabs v-model="activeTab" class="w-full">
                <TabsList class="w-full justify-start h-auto flex-wrap gap-1 bg-muted/50 p-1">
                  <TabsTrigger
                    v-for="env in allEnvironments"
                    :key="env.code"
                    :value="env.code"
                    class="text-xs px-3 py-1.5"
                    :class="env.isProd ? 'data-[state=active]:bg-amber-100 data-[state=active]:text-amber-900 dark:data-[state=active]:bg-amber-900 dark:data-[state=active]:text-amber-100' : ''"
                  >
                    {{ env.code }}
                    <Badge 
                      v-if="workingOverrides.environments?.[env.code]" 
                      variant="secondary" 
                      class="ml-1.5 h-4 px-1 text-[10px] bg-amber-200 text-amber-800 dark:bg-amber-800 dark:text-amber-200"
                    >
                      modified
                    </Badge>
                  </TabsTrigger>
                </TabsList>

                <TabsContent
                  v-for="env in allEnvironments"
                  :key="env.code"
                  :value="env.code"
                  class="mt-4"
                >
                  <KeyValueEditor
                    :items="getMergedEnvValues(env.code)"
                    :original-items="getOriginalEnvValues(env.code)"
                    :readonly="!hasEnvAccess(env.code)"
                    :show-reset="true"
                    @update="(items) => updateEnvValues(env.code, items)"
                    @reset="resetEnvOverrides(env.code)"
                  />
                  <p v-if="!hasEnvAccess(env.code)" class="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                    <AlertCircle class="w-3 h-3" />
                    You don't have access to modify {{ env.code }} configuration
                  </p>
                </TabsContent>
              </Tabs>
            </div>

            <Separator />

            <!-- Shared Values -->
            <div>
              <KeyValueEditor
                :items="getMergedSharedValues()"
                :original-items="getOriginalSharedValues()"
                :readonly="false"
                title="Shared Configuration"
                :show-reset="true"
                @update="updateSharedValues"
                @reset="resetSharedOverrides"
              />
              <p class="text-xs text-muted-foreground mt-2">
                Shared values apply to all environments unless overridden.
              </p>
            </div>
          </div>
        </ScrollArea>
      </template>
    </SheetContent>
  </Sheet>
</template>
