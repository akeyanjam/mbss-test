<script setup lang="ts">
import { Toaster } from 'vue-sonner'
import AppLayout from '@/components/layout/AppLayout.vue'
import EmailPrompt from '@/components/EmailPrompt.vue'
import { useUserStore } from '@/stores'

const userStore = useUserStore()
</script>

<template>
  <Toaster position="top-right" :duration="4000" richColors />
  <EmailPrompt v-if="!userStore.isAuthenticated" />
  <AppLayout v-else>
    <RouterView />
  </AppLayout>
</template>
