<script setup lang="ts">
import { ref } from 'vue'
import { toast } from 'vue-sonner'
import { useUserStore } from '@/stores'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { FlaskConical, Mail } from 'lucide-vue-next'

const userStore = useUserStore()
const email = ref('')
const isLoading = ref(false)
const error = ref('')

async function handleSubmit() {
  const trimmedEmail = email.value.trim().toLowerCase()
  
  // Basic validation
  if (!trimmedEmail) {
    error.value = 'Email is required'
    return
  }
  
  if (!trimmedEmail.includes('@') || !trimmedEmail.includes('.')) {
    error.value = 'Please enter a valid email address'
    return
  }

  error.value = ''
  isLoading.value = true

  try {
    await userStore.setEmail(trimmedEmail)
    
    if (userStore.environments.length === 0) {
      toast.warning('No environments available', {
        description: 'You may not have access to any test environments. Contact your administrator.',
      })
    } else {
      toast.success('Welcome!', {
        description: `You have access to ${userStore.environments.length} environment(s).`,
      })
    }
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Failed to verify email'
    toast.error('Error', { description: error.value })
  } finally {
    isLoading.value = false
  }
}
</script>

<template>
  <div class="min-h-screen bg-background flex items-center justify-center p-4">
    <Card class="w-full max-w-md">
      <CardHeader class="text-center space-y-4">
        <div class="mx-auto w-16 h-16 rounded-xl bg-primary flex items-center justify-center">
          <FlaskConical class="w-9 h-9 text-primary-foreground" />
        </div>
        <div>
          <CardTitle class="text-2xl">MBSS Test Portal</CardTitle>
          <CardDescription class="mt-2">
            Enter your email to access the test dashboard
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent>
        <form @submit.prevent="handleSubmit" class="space-y-4">
          <div class="space-y-2">
            <Label for="email">Email Address</Label>
            <div class="relative">
              <Mail class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                id="email"
                v-model="email"
                type="email"
                placeholder="your.name@bofa.com"
                class="pl-10"
                :disabled="isLoading"
                autofocus
              />
            </div>
            <p v-if="error" class="text-sm text-destructive">{{ error }}</p>
          </div>
          <Button type="submit" class="w-full" :disabled="isLoading">
            <span v-if="isLoading">Verifying...</span>
            <span v-else>Continue</span>
          </Button>
        </form>
        <p class="mt-4 text-xs text-center text-muted-foreground">
          Your email is used to determine which environments you can access.
        </p>
      </CardContent>
    </Card>
  </div>
</template>
