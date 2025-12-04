<script setup lang="ts">
import { ref, watch } from 'vue'
import { useUserStore } from '@/stores'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { AlertTriangle, Play } from 'lucide-vue-next'

const props = defineProps<{
  open: boolean
  testCount: number
  isLoading: boolean
}>()

const emit = defineEmits<{
  close: []
  submit: [environment: string]
}>()

const userStore = useUserStore()
const selectedEnvironment = ref<string>('')

// Reset selection when dialog opens
watch(() => props.open, (isOpen) => {
  if (isOpen) {
    // Default to first non-prod environment, or first available
    const nonProd = userStore.environments.find(e => !e.isProd)
    selectedEnvironment.value = nonProd?.code ?? userStore.environments[0]?.code ?? ''
  }
})

function handleSubmit() {
  if (selectedEnvironment.value) {
    emit('submit', selectedEnvironment.value)
  }
}

function isProdEnvironment(code: string): boolean {
  return userStore.environments.find(e => e.code === code)?.isProd ?? false
}
</script>

<template>
  <Dialog :open="open" @update:open="emit('close')">
    <DialogContent class="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>Run Tests</DialogTitle>
        <DialogDescription>
          Run {{ testCount }} selected test{{ testCount !== 1 ? 's' : '' }}
        </DialogDescription>
      </DialogHeader>

      <div class="space-y-4 py-4">
        <!-- Environment Selection -->
        <div class="space-y-2">
          <Label>Target Environment</Label>
          <Select v-model="selectedEnvironment">
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

        <!-- Production Warning -->
        <div
          v-if="selectedEnvironment && isProdEnvironment(selectedEnvironment)"
          class="flex items-start gap-3 p-3 bg-destructive/10 border border-destructive/20 rounded-md"
        >
          <AlertTriangle class="w-5 h-5 text-destructive shrink-0 mt-0.5" />
          <div class="text-sm">
            <p class="font-medium text-destructive">Production Environment</p>
            <p class="text-muted-foreground mt-0.5">
              You are about to run tests against the production environment. Please ensure this is intentional.
            </p>
          </div>
        </div>

        <!-- No Environments Warning -->
        <div
          v-if="userStore.environments.length === 0"
          class="text-center py-4 text-muted-foreground"
        >
          <p>You don't have access to any environments.</p>
          <p class="text-sm mt-1">Contact your administrator for access.</p>
        </div>
      </div>

      <DialogFooter>
        <Button variant="outline" @click="emit('close')" :disabled="isLoading">
          Cancel
        </Button>
        <Button
          @click="handleSubmit"
          :disabled="!selectedEnvironment || isLoading || userStore.environments.length === 0"
        >
          <Play v-if="!isLoading" class="w-4 h-4 mr-2" />
          {{ isLoading ? 'Creating...' : 'Run Tests' }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
