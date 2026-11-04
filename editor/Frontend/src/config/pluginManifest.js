/**
 * 面板静态注册表 - Vue 面板的 UI 元数据
 * 面板 id 是前端状态/路由身份；旧 Python service 名称只在兼容边界中保留。
 */
export const PLUGIN_MANIFEST = [
  {
    id: 'SceneControls', routePath: '/SceneControls',
    displayNameKey: 'plugins.SceneControls', displayName: '场景控制',
    pageType: 'view', defaultDock: 'left', defaultWidth: 380, defaultHeight: 350,
  },
  {
    id: 'CabbageTasks', routePath: '/CabbageTasks',
    displayNameKey: 'plugins.CabbageTasks', displayName: 'AI 任务',
    pageType: 'plugin', defaultDock: 'left', defaultWidth: 420, defaultHeight: 420,
  },
  {
    id: 'SceneTools',
    routePath: '/SceneBar',
    displayNameKey: 'plugins.SceneTools',
    displayName: '场景管理',
    pageType: 'view',
    defaultDock: 'right',
    defaultWidth: 360,
    defaultHeight: 540,
  },
  {
    id: 'LightFieldCalibration',
    routePath: '/LightFieldCalibration',
    displayNameKey: 'plugins.LightFieldCalibration',
    displayName: '光场3D UI标定',
    pageType: 'view',
    defaultDock: 'right',
    defaultWidth: 300,
    defaultHeight: 300,
  },
  {
    id: 'Object',
    routePath: '/Object',
    displayNameKey: 'plugins.Object',
    displayName: '对象',
    pageType: 'view',
    defaultDock: 'right',
    defaultWidth: 360,
    defaultHeight: 540,
  },
  {
    id: 'AITool',
    routePath: '/Pet',
    displayNameKey: 'plugins.AITool',
    displayName: '白菜助手',
    pageType: 'plugin',
    defaultDock: 'bottom',
    defaultWidth: 200,
    defaultHeight: 200,
  },
  {
    id: 'LogTool',
    routePath: '/LogView',
    displayNameKey: 'plugins.LogTool',
    displayName: '日志工具',
    pageType: 'view',
    defaultDock: 'bottom',
    defaultWidth: 1100,
    defaultHeight: 200,
  },
  {
    id: 'FileManager',
    routePath: '/FileManager',
    displayNameKey: 'plugins.FileManager',
    displayName: '文件管理器',
    pageType: 'view',
    defaultDock: 'left',
    defaultWidth: 300,
    defaultHeight: 600,
  },
  {
    id: 'ProjectSettings',
    routePath: '/ProjectSettings',
    displayNameKey: 'plugins.ProjectSettings',
    displayName: '项目设置',
    pageType: 'special',
    defaultDock: 'center',
    defaultWidth: 600,
    defaultHeight: 800,
  },
  {
    id: 'NodeGraphPanel',
    routePath: '/NodeGraph',
    displayNameKey: 'plugins.NodeGraphPanel',
    displayName: '节点',
    pageType: 'view',
    // Start as a centered ImGui window; users can dock it like any other work panel.
    defaultDock: 'center',
    defaultWidth: 1480,
    defaultHeight: 790,
    floating: true,
  },
  {
    id: 'CabbageChatPanel',
    routePath: '/CabbageChat',
    displayNameKey: 'plugins.CabbageChatPanel',
    displayName: 'AI 创作助手',
    pageType: 'plugin',
    defaultDock: 'left',
    defaultWidth: 420,
    defaultHeight: 600,
  },
  {
    id: 'EditorSettings',
    routePath: '/SetUp',
    displayNameKey: 'plugins.EditorSettings',
    displayName: '暂停菜单',
    pageType: 'special',
    defaultDock: 'center',
    defaultWidth: 620,
    defaultHeight: 720,
  },
];

/** 按 id 快速查找 */
export function getPluginManifest(id) {
  return PLUGIN_MANIFEST.find((p) => p.id === id);
}
