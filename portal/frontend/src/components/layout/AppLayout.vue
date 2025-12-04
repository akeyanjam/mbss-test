<script setup lang="ts">
import { RouterLink, useRoute } from 'vue-router'
import { useUserStore } from '@/stores'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  FlaskConical,
  History,
  Calendar,
  LogOut,
  User,
} from 'lucide-vue-next'

const route = useRoute()
const userStore = useUserStore()

const navItems = [
  { to: '/', label: 'Test Catalog', icon: FlaskConical },
  { to: '/runs', label: 'Run History', icon: History },
  { to: '/schedules', label: 'Schedules', icon: Calendar },
]

function getInitials(email: string): string {
  const localPart = email.split('@')[0] ?? ''
  const parts = localPart.split('.')
  const first = parts[0] ?? ''
  const second = parts[1] ?? ''
  if (first.length > 0 && second.length > 0) {
    return (first.charAt(0) + second.charAt(0)).toUpperCase()
  }
  return email.slice(0, 2).toUpperCase()
}

function handleLogout() {
  userStore.clearEmail()
}
</script>

<template>
  <div class="min-h-screen bg-background flex flex-col">
    <!-- Top Navigation Bar -->
    <header class="h-14 border-b border-border bg-card shadow-sm shrink-0">
      <div class="h-full px-4 flex items-center justify-between">
        <!-- Logo & Brand -->
        <div class="flex items-center gap-6">
          <RouterLink to="/" class="flex items-center gap-2">
            <div class="w-8 h-8 rounded bg-primary flex items-center justify-center">
              <FlaskConical class="w-5 h-5 text-primary-foreground" />
            </div>
            <span class="font-semibold text-lg text-foreground">MBSS Test Portal</span>
          </RouterLink>

          <!-- Main Navigation -->
          <nav class="flex items-center gap-1">
            <RouterLink
              v-for="item in navItems"
              :key="item.to"
              :to="item.to"
              class="flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors"
              :class="[
                route.path === item.to || (item.to !== '/' && route.path.startsWith(item.to))
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground hover:bg-accent'
              ]"
            >
              <component :is="item.icon" class="w-4 h-4" />
              {{ item.label }}
            </RouterLink>
          </nav>
        </div>

        <!-- User Menu -->
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" class="flex items-center gap-2 h-9">
              <Avatar class="w-7 h-7">
                <AvatarFallback class="bg-secondary text-secondary-foreground text-xs">
                  {{ getInitials(userStore.email || '') }}
                </AvatarFallback>
              </Avatar>
              <span class="text-sm text-muted-foreground max-w-[200px] truncate">
                {{ userStore.email }}
              </span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" class="w-56">
            <DropdownMenuLabel class="font-normal">
              <div class="flex flex-col space-y-1">
                <p class="text-sm font-medium">Signed in as</p>
                <p class="text-xs text-muted-foreground truncate">{{ userStore.email }}</p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem disabled>
              <User class="mr-2 h-4 w-4" />
              <span>Environments: {{ userStore.environments.length }}</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem @click="handleLogout" class="text-destructive focus:text-destructive">
              <LogOut class="mr-2 h-4 w-4" />
              <span>Sign out</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>

    <!-- Main Content -->
    <main class="flex-1 overflow-auto">
      <slot />
    </main>
  </div>
</template>
