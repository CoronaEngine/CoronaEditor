// 路由文件
import { createRouter, createWebHashHistory } from 'vue-router'

const routes = [
    {
        path: '/',
        name: 'WelcomePage',
        component: () => import('../views/WelcomePage.vue')
    },
    {
      path: '/MainPage',
      name: 'MainPage',
      component: () => import('../views/MainPage.vue')
    },
    {
      path: '/AITalkBar',
      name: 'AITalkBar',
      component: () => import('../views/AITalkBar.vue')
    },
    {
      path: '/SceneBar',
      name: 'SceneBar',
      component: () => import('../views/SceneBar.vue')
    },
    {
      path: '/Object',
      name: 'Object',
      component: () => import('../views/Object.vue')
    },
    {
      path: '/Pet',
      name: 'Pet',
      component: () => import('../views/Pet.vue')
    },
    {
      path: '/Test',
      name: 'Test',
      component: () => import('../views/Test.vue')
    }
]

const router = createRouter({
  history: createWebHashHistory(),
  routes,
})

router.beforeEach((to, from) => {})

window.__ROUTES__ = routes;

export default router
