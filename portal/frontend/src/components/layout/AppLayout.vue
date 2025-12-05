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
  LayoutDashboard,
} from 'lucide-vue-next'

const route = useRoute()
const userStore = useUserStore()

const navItems = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/catalog', label: 'Test Catalog', icon: FlaskConical },
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
  <div class="h-screen bg-background flex overflow-hidden">
    <!-- Sidebar Navigation - Fixed/Sticky -->
    <aside class="w-20 border-r border-border bg-card shrink-0 flex flex-col">
      <!-- Logo -->
      <div class="h-16 flex items-center justify-center border-b border-border shrink-0">
        <RouterLink to="/" class="flex items-center justify-center">
          <div class="w-10 h-10 rounded bg-primary flex items-center justify-center">
            <FlaskConical class="w-6 h-6 text-primary-foreground" />
          </div>
        </RouterLink>
      </div>

      <!-- Navigation Items -->
      <nav class="flex-1 flex flex-col gap-2 p-2 py-4">
        <RouterLink
          v-for="item in navItems"
          :key="item.to"
          :to="item.to"
          class="flex flex-col items-center justify-center py-3 px-2 rounded-md transition-colors"
          :class="[
            route.path === item.to || (item.to !== '/' && route.path.startsWith(item.to))
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:text-foreground hover:bg-accent'
          ]"
        >
          <component :is="item.icon" class="w-5 h-5 mb-1" />
          <span class="text-[10px] font-medium text-center leading-tight">
            {{ item.label }}
          </span>
        </RouterLink>
      </nav>

      <!-- User Menu at Bottom -->
      <div class="p-2 border-t border-border shrink-0">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" class="w-full h-auto py-3 px-2 rounded-md flex flex-col items-center">
              <Avatar class="w-8 h-8 mb-1">
                <AvatarFallback class="bg-secondary text-secondary-foreground text-xs">
                  {{ getInitials(userStore.email || '') }}
                </AvatarFallback>
              </Avatar>
              <span class="text-[10px] font-medium text-muted-foreground">Account</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="right" align="end" class="w-56">
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
    </aside>

    <!-- Main Content Area - Scrollable -->
    <div class="flex-1 flex flex-col min-w-0 overflow-hidden">
      <!-- Top Bar -->
      <header class="h-16 border-b border-border bg-card shrink-0 px-6 flex items-center">
        <h1 class="text-xl font-semibold text-foreground">MBSS Test Portal</h1>
      </header>

      <!-- Main Content - Scrollable -->
      <main class="flex-1 overflow-y-auto p-6">
        <slot />
      </main>
    </div>
  </div>
</template>
