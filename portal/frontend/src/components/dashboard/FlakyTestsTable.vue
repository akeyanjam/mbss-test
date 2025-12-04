<script setup lang="ts">
import { useRouter } from 'vue-router'
import { AlertTriangle, CheckCircle2, XCircle } from 'lucide-vue-next'

defineProps<{
  tests: Array<{
    testKey: string
    testName: string
    flakinessScore: number
    executions: {
      total: number
      passed: number
      failed: number
    }
    lastResults: string[]
    environments: string[]
    lastFailure: {
      runId: string
      date: string
      environment: string
      errorMessage: string | null
    } | null
  }>
}>()

const router = useRouter()

function getScoreColor(score: number) {
  if (score >= 50) return 'text-red-600 bg-red-50'
  if (score >= 30) return 'text-orange-600 bg-orange-50'
  return 'text-yellow-600 bg-yellow-50'
}

function getResultIcon(result: string) {
  return result === 'passed' ? CheckCircle2 : XCircle
}

function getResultColor(result: string) {
  return result === 'passed' ? 'text-green-600' : 'text-red-600'
}

function viewFailure(runId: string) {
  router.push(`/runs/${runId}`)
}
</script>

<template>
  <div class="overflow-x-auto">
    <table class="w-full">
      <thead class="bg-muted/50">
        <tr>
          <th class="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Test Name
          </th>
          <th class="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Flakiness
          </th>
          <th class="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Last 10 Results
          </th>
          <th class="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Executions
          </th>
          <th class="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Environments
          </th>
          <th class="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Last Failure
          </th>
        </tr>
      </thead>
      <tbody class="divide-y">
        <tr
          v-for="test in tests"
          :key="test.testKey"
          class="hover:bg-muted/30 transition-colors"
        >
          <td class="px-6 py-4">
            <div class="flex items-center gap-2">
              <AlertTriangle class="h-4 w-4 text-orange-600 flex-shrink-0" />
              <div>
                <div class="text-sm font-medium">{{ test.testName }}</div>
                <div class="text-xs text-muted-foreground">{{ test.testKey }}</div>
              </div>
            </div>
          </td>
          <td class="px-6 py-4 whitespace-nowrap">
            <span 
              class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium"
              :class="getScoreColor(test.flakinessScore)"
            >
              {{ test.flakinessScore }}%
            </span>
          </td>
          <td class="px-6 py-4">
            <div class="flex gap-1">
              <component
                v-for="(result, idx) in test.lastResults.slice(0, 10)"
                :key="idx"
                :is="getResultIcon(result)"
                class="h-4 w-4"
                :class="getResultColor(result)"
              />
            </div>
          </td>
          <td class="px-6 py-4 whitespace-nowrap text-sm">
            <div>
              <span class="text-green-600 font-medium">{{ test.executions.passed }}</span>
              <span class="text-muted-foreground mx-1">/</span>
              <span class="text-red-600 font-medium">{{ test.executions.failed }}</span>
              <span class="text-muted-foreground mx-1">/</span>
              <span class="text-gray-600">{{ test.executions.total }}</span>
            </div>
          </td>
          <td class="px-6 py-4">
            <div class="flex flex-wrap gap-1">
              <span
                v-for="env in test.environments"
                :key="env"
                class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800"
              >
                {{ env }}
              </span>
            </div>
          </td>
          <td class="px-6 py-4">
            <div v-if="test.lastFailure" class="text-sm">
              <button
                @click="viewFailure(test.lastFailure.runId)"
                class="text-blue-600 hover:text-blue-800 hover:underline"
              >
                View
              </button>
              <div class="text-xs text-muted-foreground mt-1">
                {{ new Date(test.lastFailure.date).toLocaleDateString() }}
              </div>
            </div>
            <span v-else class="text-sm text-muted-foreground">-</span>
          </td>
        </tr>
      </tbody>
    </table>
    
    <div v-if="tests.length === 0" class="text-center py-12 text-muted-foreground">
      No flaky tests detected
    </div>
  </div>
</template>
