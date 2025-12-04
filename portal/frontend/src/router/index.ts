import { createRouter, createWebHistory } from 'vue-router'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      name: 'catalog',
      component: () => import('@/pages/TestCatalog.vue'),
      meta: { title: 'Test Catalog' }
    },
    {
      path: '/runs',
      name: 'runs',
      component: () => import('@/pages/RunHistory.vue'),
      meta: { title: 'Run History' }
    },
    {
      path: '/runs/:runId',
      name: 'run-view',
      component: () => import('@/pages/RunView.vue'),
      meta: { title: 'Run Details' }
    },
    {
      path: '/schedules',
      name: 'schedules',
      component: () => import('@/pages/Schedules.vue'),
      meta: { title: 'Schedules' }
    },
    {
      path: '/schedules/new',
      name: 'schedule-new',
      component: () => import('@/pages/ScheduleEditor.vue'),
      meta: { title: 'New Schedule' }
    },
    {
      path: '/schedules/:id/edit',
      name: 'schedule-edit',
      component: () => import('@/pages/ScheduleEditor.vue'),
      meta: { title: 'Edit Schedule' }
    },
  ]
})

// Update document title on navigation
router.beforeEach((to, _from, next) => {
  document.title = `${to.meta.title || 'MBSS'} | MBSS Test Portal`
  next()
})

export default router
