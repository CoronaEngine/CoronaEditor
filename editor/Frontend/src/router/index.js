import { notifyWorldError } from '../services/worldSessionLifecycle.js';
// 路由文件
import { createRouter, createWebHashHistory } from 'vue-router';

import { createWorldModeRouteGuard, worldModeService } from '../services/worldModeService.js';
import { appService } from '../services/appService.js';

import { getPluginComponent } from '../views/panelRegistry.js';

const routes = [
  { path: '/SceneControls', name: 'SceneControls', component: getPluginComponent('SceneControls') },
  { path: '/CabbageTasks', name: 'CabbageTasks', component: getPluginComponent('CabbageTasks') },
  {
    path: '/',
    name: 'MainPage',
    component: () => import('../views/layout/WorldEntry.vue'),
  },
  {
    path: '/StartScreen',
    name: 'StartScreen',
    component: () => import('../views/layout/StartScreen.vue'),
  },
  {
    path: '/NewGame',
    name: 'NewGame',
    component: () => import('../views/layout/NewGame.vue'),
  },
  {
    path: '/JoinGame',
    name: 'JoinGame',
    component: () => import('../views/layout/JoinGame.vue'),
  },
  {
    path: '/RecentGames',
    name: 'RecentGames',
    component: () => import('../views/layout/RecentGames.vue'),
  },
  {
    path: '/SceneBar',
    name: 'SceneBar',
    component: getPluginComponent('SceneTools'),
  },
  {
    path: '/NodeGraph',
    name: 'NodeGraphPanel',
    component: getPluginComponent('NodeGraphPanel'),
  },
  {
    path: '/CabbageChat',
    name: 'CabbageChatPanel',
    component: getPluginComponent('CabbageChatPanel'),
  },
  {
    path: '/Object',
    name: 'Object',
    component: getPluginComponent('Object'),
  },
  {
    path: '/Pet',
    name: 'Pet',
    component: getPluginComponent('AITool'),
  },
  {
    path: '/FileManager',
    name: 'FileManager',
    component: getPluginComponent('FileManager'),
  },
  {
    path: '/SetUp',
    name: 'SetUp',
    component: getPluginComponent('EditorSettings'),
  },
  {
    path: '/ProjectSettings',
    name: 'ProjectSettings',
    component: getPluginComponent('ProjectSettings'),
  },
  {
    path: '/CameraView',
    name: 'CameraView',
    component: () => import('../views/tools/CameraView.vue'),
  },
  {
    path: '/LightFieldCalibration',
    name: 'LightFieldCalibration',
    component: getPluginComponent('LightFieldCalibration'),
  },
];

const router = createRouter({
  history: createWebHashHistory(),
  routes,
});

router.beforeEach(createWorldModeRouteGuard({
  controller: worldModeService,
  closePanel: () => appService.closeThisTab(''),
  notify: (message, error) => notifyWorldError(error, message),
}));

window.__ROUTES__ = routes;

export default router;
