import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { getTests, getFolders, getTags } from '@/api/client'
import type { TestDefinition, FolderNode } from '@/types'

/**
 * Build a hierarchical folder tree from flat folder paths.
 * Excludes the innermost folder since each test lives in its own folder (1:1 relationship).
 */
function buildFolderTree(folderPaths: string[], allTests: TestDefinition[]): FolderNode[] {
  const root: FolderNode[] = []
  
  // Count tests per folder path
  const testCounts = new Map<string, number>()
  for (const test of allTests) {
    const path = test.folderPath
    testCounts.set(path, (testCounts.get(path) || 0) + 1)
  }

  for (const fullPath of folderPaths) {
    const parts = fullPath.split('/')
    // Skip the last part - it's the test folder itself (1:1 with test)
    const parentParts = parts.slice(0, -1)
    
    if (parentParts.length === 0) continue // Skip if test is at root level
    
    let currentLevel = root
    let currentPath = ''

    for (const part of parentParts) {
      if (!part) continue
      currentPath = currentPath ? `${currentPath}/${part}` : part

      // Check if this node already exists at current level
      let node = currentLevel.find(n => n.name === part)
      
      if (!node) {
        // Count tests in this folder and all subfolders
        let count = 0
        for (const [path] of testCounts) {
          if (path === currentPath || path.startsWith(currentPath + '/')) {
            count += 1
          }
        }

        node = {
          name: part,
          path: currentPath,
          testCount: count,
          children: [],
        }
        currentLevel.push(node)
      }

      currentLevel = node.children
    }
  }

  return root
}

export const useTestsStore = defineStore('tests', () => {
  const tests = ref<TestDefinition[]>([])
  const folders = ref<FolderNode[]>([])
  const tags = ref<string[]>([])
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  // Selection state
  const selectedTestKeys = ref<Set<string>>(new Set())
  const selectedTags = ref<string[]>([])
  const selectedFolder = ref<string | null>(null)

  // Computed
  const filteredTests = computed(() => {
    let result = tests.value

    // Filter by selected folder (shows only folder content)
    if (selectedFolder.value) {
      result = result.filter(t => t.folderPath.startsWith(selectedFolder.value + '/'))
    }

    // Filter by tags
    if (selectedTags.value.length > 0) {
      result = result.filter(t =>
        selectedTags.value.some(tag => (t.tags || []).includes(tag))
      )
    }

    return result
  })

  const selectedTests = computed(() =>
    tests.value.filter(t => selectedTestKeys.value.has(t.testKey))
  )

  const selectedCount = computed(() => selectedTestKeys.value.size)

  const hasSelection = computed(() => selectedCount.value > 0)

  // Actions
  async function fetchTests() {
    isLoading.value = true
    error.value = null

    try {
      const [testsRes, foldersRes, tagsRes] = await Promise.all([
        getTests(),
        getFolders(),
        getTags(),
      ])

      tests.value = testsRes.tests
      // Build tree structure from flat folder paths
      folders.value = buildFolderTree(foldersRes.folders, testsRes.tests)
      tags.value = tagsRes.tags
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to fetch tests'
    } finally {
      isLoading.value = false
    }
  }

  function toggleTestSelection(testKey: string) {
    if (selectedTestKeys.value.has(testKey)) {
      selectedTestKeys.value.delete(testKey)
    } else {
      selectedTestKeys.value.add(testKey)
    }
    // Trigger reactivity
    selectedTestKeys.value = new Set(selectedTestKeys.value)
  }

  function selectAllFiltered() {
    filteredTests.value.forEach(t => selectedTestKeys.value.add(t.testKey))
    selectedTestKeys.value = new Set(selectedTestKeys.value)
  }

  function deselectAllFiltered() {
    filteredTests.value.forEach(t => selectedTestKeys.value.delete(t.testKey))
    selectedTestKeys.value = new Set(selectedTestKeys.value)
  }

  function selectFolder(folderPath: string) {
    // Clear tag filters when selecting a folder
    selectedTags.value = []
    selectedFolder.value = folderPath
    
    // Select all tests in this folder
    const testsInFolder = tests.value.filter(t => t.folderPath.startsWith(folderPath + '/'))
    selectedTestKeys.value = new Set(testsInFolder.map(t => t.testKey))
  }

  function clearSelection() {
    selectedTestKeys.value = new Set()
  }

  function setSelectedFolder(folder: string | null) {
    selectedFolder.value = folder
  }

  function setSelectedTags(newTags: string[]) {
    selectedTags.value = newTags
  }

  function toggleTag(tag: string) {
    // Clear folder selection when using tag filters
    selectedFolder.value = null
    
    const idx = selectedTags.value.indexOf(tag)
    if (idx >= 0) {
      selectedTags.value.splice(idx, 1)
    } else {
      selectedTags.value.push(tag)
    }
    
    // Select all filtered tests after tag change
    // Need to recompute filtered tests first
    const filtered = selectedTags.value.length > 0
      ? tests.value.filter(t => selectedTags.value.some(tg => (t.tags || []).includes(tg)))
      : tests.value
    selectedTestKeys.value = new Set(filtered.map(t => t.testKey))
  }

  function clearFilters() {
    selectedFolder.value = null
    selectedTags.value = []
  }

  return {
    // State
    tests,
    folders,
    tags,
    isLoading,
    error,
    selectedTestKeys,
    selectedTags,
    selectedFolder,
    // Computed
    filteredTests,
    selectedTests,
    selectedCount,
    hasSelection,
    // Actions
    fetchTests,
    toggleTestSelection,
    selectAllFiltered,
    deselectAllFiltered,
    selectFolder,
    clearSelection,
    setSelectedFolder,
    setSelectedTags,
    toggleTag,
    clearFilters,
  }
})
