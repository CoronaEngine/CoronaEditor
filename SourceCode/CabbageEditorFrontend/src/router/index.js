// 路由文件
import { comments } from 'blockly/core';
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
    },
    {
        path: '/WelcomePagePE',
        name: 'WelcomePagePE',
        component: () => import('../views/WelcomePagePE.vue')
    },
    {
      path: '/MainPagePE',
      name: 'MainPagePE',
      component: () => import('../views/MainPagePE.vue')
    },
    {
      path: '/SceneBarPE',
      name: 'SceneBarPE',
      component: () => import('../views/SceneBarPe.vue')
    },
    {
      path: '/PetPE',
      name: 'PetPE',
      component: () => import('../views/PetPE.vue')
    },
    {
      path: '/AITalkBarPE',
      name: 'AITalkBarPE',
      component: () => import('../views/AITalkBarPE.vue')
    },
    {
      path: '/SetUp',
      name: 'SetUp',
      component: () => import('../views/SetUp.vue')
    },
]

const router = createRouter({
  history: createWebHashHistory(),
  routes,
})

router.beforeEach((to, from) => {})

window.__ROUTES__ = routes;

export default router
