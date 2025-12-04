<script setup lang="ts">
import { computed } from 'vue'
import { Badge } from '@/components/ui/badge'
import type { RunStatus } from '@/types'
import {
  Clock,
  Loader2,
  CheckCircle2,
  XCircle,
  Ban,
} from 'lucide-vue-next'

const props = defineProps<{
  status: RunStatus
  showIcon?: boolean
}>()

const config = computed(() => {
  switch (props.status) {
    case 'queued':
      return {
        label: 'Queued',
        icon: Clock,
        class: 'bg-amber-100 text-amber-700 border-amber-200',
      }
    case 'running':
      return {
        label: 'Running',
        icon: Loader2,
        class: 'bg-blue-100 text-blue-700 border-blue-200',
        iconClass: 'animate-spin',
      }
    case 'passed':
      return {
        label: 'Passed',
        icon: CheckCircle2,
        class: 'bg-green-100 text-green-700 border-green-200',
      }
    case 'failed':
      return {
        label: 'Failed',
        icon: XCircle,
        class: 'bg-red-100 text-red-700 border-red-200',
      }
    case 'cancelled':
      return {
        label: 'Cancelled',
        icon: Ban,
        class: 'bg-gray-100 text-gray-600 border-gray-200',
      }
    default:
      return {
        label: 'Unknown',
        icon: Clock,
        class: 'bg-muted text-muted-foreground',
      }
  }
})
</script>

<template>
  <Badge variant="outline" :class="['gap-1', config.class]">
    <component
      v-if="showIcon !== false"
      :is="config.icon"
      class="w-3 h-3"
      :class="config.iconClass"
    />
    {{ config.label }}
  </Badge>
</template>
