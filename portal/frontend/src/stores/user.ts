import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { getUserEnvironments } from '@/api/client'
import type { Environment } from '@/types'

const STORAGE_KEY = 'mbss_user_email'

export const useUserStore = defineStore('user', () => {
  const email = ref<string | null>(localStorage.getItem(STORAGE_KEY))
  const environments = ref<Environment[]>([])
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  const isAuthenticated = computed(() => !!email.value)

  async function setEmail(newEmail: string) {
    email.value = newEmail
    localStorage.setItem(STORAGE_KEY, newEmail)
    await fetchUserEnvironments()
  }

  function clearEmail() {
    email.value = null
    environments.value = []
    localStorage.removeItem(STORAGE_KEY)
  }

  async function fetchUserEnvironments() {
    if (!email.value) {
      environments.value = []
      return
    }

    isLoading.value = true
    error.value = null

    try {
      const response = await getUserEnvironments(email.value)
      environments.value = response.environments
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to fetch environments'
      environments.value = []
    } finally {
      isLoading.value = false
    }
  }

  function hasAccessTo(envCode: string): boolean {
    return environments.value.some(env => env.code === envCode)
  }

  // Initialize environments if email exists
  if (email.value) {
    fetchUserEnvironments()
  }

  return {
    email,
    environments,
    isLoading,
    error,
    isAuthenticated,
    setEmail,
    clearEmail,
    fetchUserEnvironments,
    hasAccessTo,
  }
})
