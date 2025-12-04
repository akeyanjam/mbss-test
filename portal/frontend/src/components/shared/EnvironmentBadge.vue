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
        : 'bg-secondary/10 text-secondary border-secondary/20'
    ]"
  >
    <Server class="w-3 h-3" />
    {{ code }}
  </Badge>
</template>
