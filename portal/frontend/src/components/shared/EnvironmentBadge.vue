<script setup lang="ts">
import { Badge } from '@/components/ui/badge'
import { Server } from 'lucide-vue-next'

defineProps<{
  code: string
  isProd?: boolean
}>()
</script>

<template>
  <Badge
    variant="outline"
    :class="[
      'gap-1',
      isProd
        ? 'bg-red-50 text-red-700 border-red-200'
        : 'bg-blue-50 text-blue-700 border-blue-200'
    ]"
  >
    <Server class="w-3 h-3" />
    {{ code }}
  </Badge>
</template>
