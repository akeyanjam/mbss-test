<script setup lang="ts">
import { ref, computed } from 'vue'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Pencil, Trash2, Plus, Check, X, RotateCcw } from 'lucide-vue-next'

interface KeyValuePair {
  key: string
  value: string
  isOverride?: boolean
}

const props = defineProps<{
  items: KeyValuePair[]
  originalItems?: KeyValuePair[]
  readonly?: boolean
  title?: string
  showReset?: boolean
}>()

const emit = defineEmits<{
  (e: 'update', items: KeyValuePair[]): void
  (e: 'reset'): void
}>()

// Track which row is being edited
const editingKey = ref<string | null>(null)
const editValue = ref('')

// New row state
const isAddingNew = ref(false)
const newKey = ref('')
const newValue = ref('')
const newKeyError = ref('')

// Check if a value is overridden (different from original)
function isOverridden(key: string, value: string): boolean {
  if (!props.originalItems) return false
  const original = props.originalItems.find(item => item.key === key)
  if (!original) return true // New key = override
  return original.value !== value
}

// Start editing a value
function startEdit(key: string, currentValue: string) {
  if (props.readonly) return
  editingKey.value = key
  editValue.value = currentValue
}

// Save edited value
function saveEdit(key: string) {
  if (!editValue.value.trim()) return
  
  const updated = props.items.map(item => 
    item.key === key 
      ? { ...item, value: editValue.value.trim() }
      : item
  )
  emit('update', updated)
  editingKey.value = null
  editValue.value = ''
}

// Cancel editing
function cancelEdit() {
  editingKey.value = null
  editValue.value = ''
}

// Delete a key-value pair
function deleteItem(key: string) {
  const updated = props.items.filter(item => item.key !== key)
  emit('update', updated)
}

// Start adding new row
function startAddNew() {
  isAddingNew.value = true
  newKey.value = ''
  newValue.value = ''
  newKeyError.value = ''
}

// Validate new key
function validateNewKey(): boolean {
  if (!newKey.value.trim()) {
    newKeyError.value = 'Key is required'
    return false
  }
  if (props.items.some(item => item.key === newKey.value.trim())) {
    newKeyError.value = 'Key already exists'
    return false
  }
  newKeyError.value = ''
  return true
}

// Save new row
function saveNewRow() {
  if (!validateNewKey()) return
  if (!newValue.value.trim()) return
  
  const updated = [
    ...props.items,
    { key: newKey.value.trim(), value: newValue.value.trim() }
  ]
  emit('update', updated)
  isAddingNew.value = false
  newKey.value = ''
  newValue.value = ''
}

// Cancel adding new row
function cancelAddNew() {
  isAddingNew.value = false
  newKey.value = ''
  newValue.value = ''
  newKeyError.value = ''
}

// Handle key input blur for validation
function onNewKeyBlur() {
  if (newKey.value.trim()) {
    validateNewKey()
  }
}

const hasOverrides = computed(() => {
  return props.items.some(item => isOverridden(item.key, item.value))
})
</script>

<template>
  <div class="space-y-3">
    <!-- Header with title and reset button -->
    <div v-if="title || showReset" class="flex items-center justify-between">
      <h4 v-if="title" class="text-sm font-medium text-foreground">{{ title }}</h4>
      <Button
        v-if="showReset && hasOverrides && !readonly"
        variant="ghost"
        size="sm"
        class="h-7 text-xs gap-1"
        @click="emit('reset')"
      >
        <RotateCcw class="w-3 h-3" />
        Reset
      </Button>
    </div>

    <!-- Key-Value List -->
    <div class="rounded-md border border-border overflow-hidden">
      <!-- Header row -->
      <div class="grid grid-cols-[1fr_1fr_auto] gap-2 px-3 py-2 bg-muted/50 border-b border-border text-xs font-medium text-muted-foreground uppercase tracking-wide">
        <div>Key</div>
        <div>Value</div>
        <div class="w-16"></div>
      </div>

      <!-- Items -->
      <div class="divide-y divide-border">
        <div
          v-for="item in items"
          :key="item.key"
          class="grid grid-cols-[1fr_1fr_auto] gap-2 px-3 py-2 items-center hover:bg-muted/30 transition-colors"
        >
          <!-- Key -->
          <div class="text-sm font-mono truncate" :title="item.key">
            {{ item.key }}
          </div>

          <!-- Value (editable) -->
          <div v-if="editingKey === item.key" class="flex items-center gap-1">
            <Input
              v-model="editValue"
              class="h-8 text-sm font-mono"
              @keyup.enter="saveEdit(item.key)"
              @keyup.escape="cancelEdit"
              autofocus
            />
            <Button
              variant="ghost"
              size="sm"
              class="h-8 w-8 p-0"
              @click="saveEdit(item.key)"
            >
              <Check class="w-4 h-4 text-green-600" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              class="h-8 w-8 p-0"
              @click="cancelEdit"
            >
              <X class="w-4 h-4 text-muted-foreground" />
            </Button>
          </div>
          <div
            v-else
            class="text-sm font-mono truncate"
            :class="isOverridden(item.key, item.value) ? 'text-amber-600 dark:text-amber-400 font-medium' : 'text-foreground'"
            :title="item.value"
          >
            {{ item.value }}
          </div>

          <!-- Actions -->
          <div v-if="editingKey !== item.key" class="flex items-center gap-1 w-16 justify-end">
            <Button
              v-if="!readonly"
              variant="ghost"
              size="sm"
              class="h-7 w-7 p-0"
              @click="startEdit(item.key, item.value)"
            >
              <Pencil class="w-3.5 h-3.5 text-muted-foreground" />
            </Button>
            <Button
              v-if="!readonly"
              variant="ghost"
              size="sm"
              class="h-7 w-7 p-0 hover:text-destructive"
              @click="deleteItem(item.key)"
            >
              <Trash2 class="w-3.5 h-3.5" />
            </Button>
          </div>
          <div v-else class="w-16"></div>
        </div>

        <!-- New row input -->
        <div v-if="isAddingNew" class="grid grid-cols-[1fr_1fr_auto] gap-2 px-3 py-2 items-start bg-muted/20">
          <div>
            <Input
              v-model="newKey"
              placeholder="Enter key"
              class="h-8 text-sm font-mono"
              :class="newKeyError ? 'border-destructive' : ''"
              @blur="onNewKeyBlur"
              @keyup.escape="cancelAddNew"
              autofocus
            />
            <p v-if="newKeyError" class="text-xs text-destructive mt-1">{{ newKeyError }}</p>
          </div>
          <Input
            v-model="newValue"
            placeholder="Enter value"
            class="h-8 text-sm font-mono"
            @keyup.enter="saveNewRow"
            @keyup.escape="cancelAddNew"
          />
          <div class="flex items-center gap-1 w-16 justify-end">
            <Button
              variant="ghost"
              size="sm"
              class="h-8 w-8 p-0"
              :disabled="!newKey.trim() || !newValue.trim()"
              @click="saveNewRow"
            >
              <Check class="w-4 h-4 text-green-600" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              class="h-8 w-8 p-0"
              @click="cancelAddNew"
            >
              <X class="w-4 h-4 text-muted-foreground" />
            </Button>
          </div>
        </div>

        <!-- Empty state -->
        <div v-if="items.length === 0 && !isAddingNew" class="px-3 py-4 text-center text-sm text-muted-foreground">
          No values configured
        </div>
      </div>

      <!-- Add button -->
      <div v-if="!readonly && !isAddingNew" class="px-3 py-2 border-t border-border">
        <Button
          variant="ghost"
          size="sm"
          class="h-7 text-xs gap-1 w-full justify-center"
          @click="startAddNew"
        >
          <Plus class="w-3 h-3" />
          Add Value
        </Button>
      </div>
    </div>
  </div>
</template>
