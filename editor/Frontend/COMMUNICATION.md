# 前端通信边界与迁移说明

## 最终验收结论（2026-11-08）

本次 Web 通信、生命周期与旧接口收敛按 WEB-OPT-00 至 13 完成当前配对版本验收。权威逐项记录：2026-11-08-web-consolidation-final-verification.md；运行结果与原生二进制散列：build/web-opt-ai-workflow-lifetime-acceptance.json。以下历史段落的 planned/active/待处理、运行中或失败状态仅表示当时情况，不能覆盖此处最终记录。

- Engine 本地 9c94a1d7ca859b2ba4e207a9674b8079a58fd921；Editor 本地 e3107026234fee2414cccea05633681e24d78df1，pin 配对一致。Conan Editor 部署 62219、当前 native tests 重建 87216 均 exit0；196 个生产源码文件与部署逐文件一致。
- 1257 JS、65 Python、51 退休接口/pin、lint/Vite；当前产物完整12套 Vue/11面板、CEF 禁页面 JSON 的具名 V8/真实主停靠分离相机、双实例完整联机/对象同步均通过。双实例已按用户明确要求验证原生断开清房后显式重开重入及状态恢复，不增加自动重试。
- 五业务专项 Blockly/archive/scene-pull/native-file/resources 均通过；资源包括真实原生取消、模型/图片/音频导入、45骨骼IK与997Hz输出回环。Conan重建后四项原生回归20302完整exit0，35.78秒；最新native-file宿主1791完整exit0，SHA256=c9a21fa0fff51eaae0191854869459c741bfa7e569bcbc0d5c5378126412f388，旧宿主结果不代替本次证明。
- manifest169项逐字核对165项仅非Web契约保留/4删除、无差异，current_cef均false；生产BroadcastChannel仅webMessages，src/api无JSON编解码。CEF绑定源没有dump/parse或旧Python snapshot调用；独立存储/HTTP/模型文本/网络协议JSON及非Web适配按范围保留。
- AI工作流的同路径重开、首await/后续await、旧catch与取消provider后新generation归属已修复并通过14项专项。最后新增的夹具修正只接入现有世界owner和提前释放自有hooks，真实点击/原生回复、旧scope拒绝和全部文件不变断言保留；首次失败证据/原生GPU风险都写入最终报告。
- exe=440ed238ab859af6afe043e7564607a9fe34e110bc847c91e3040c325f5994c8，frontend=30c224aa6908740c82f64295ae16bc751034911f2e40564f1a25292836dcfedb。固定1Actor/2Camera各20次性能见最终报告，仅证明投影体积与当前小场景延迟，不承诺组合请求减少或大场景提速。
- 既有 Vulkan DEVICE_LOST、StablePlanes约1.49GB临时分配bad_alloc均未修复，后续成功不证明已修复；SoundCard discontinuity警告保留。这些不是本次Web收敛已修复项，也未通过改Horizon/ImGui规避。
- 不push；Markdown/inventory不暂存提交，仅本地。Engine保留用户Optics DEBUG注释hunk，Editor只余原本本地文档。未主动修改Horizon/ImGui；Conan沿用既有自动补丁/依赖流程，不手改锁。

## 历史实施记录（以最终验收结论为准）

## 当前实施：AI 工作流世界归属与最终组合验收（2026-11-08）

- 当前运行验收：完整 UI 20395 exit0（run-02ccr7rb，12 套），CEF 55395 exit0（web-opt-ai-workflow-lifetime-cef-result.json，passed/nativeBindings/cleanup_ok/graceful_exit=true），双实例 4521 exit0（run-hlbxttim，native/optics/unexpected failures 均空；ENet stop/显式重开重入及停网对象恢复通过）。196 个生产 JS/Vue/TS/Python 部署源码逐文件一致，见 web-opt-ai-workflow-lifetime-deployed-sources.json。
- 五业务专项最终均 exit0，fixture=build/web-business-smoke/ai-workflow-itlk1por：Blockly blockly-wmorig0m、archive-75rtr7jv、scene-pull-o1cbyi7m 的失败保留，修正后 scene-pull-final.log 通过、native-file-2agyezt0、resources-6e3nyznt。资源实测原生取消、Vue 模型/图片/音频导入、45骨骼 IK冲突/恢复；997Hz loopback振幅 baseline=0 / playing=0.00876182406040056 / stopped=0，未落盘原始音频；SoundCard discontinuity warning 保留。
- 业务夹具改由已存在的 projectLauncherService 完成 Web 开档，不绕过旧窗口保存屏障；session-only 阶段使用 SceneBar 避开 MainPage 独立助手写入，文件不变断言未排除任何文件，并增加差异诊断。scene-pull 在 owner 关闭 detached 文档前释放测试 hooks，不忽略 cleanup 异常。代码本地提交 9c94a1d7；Blockly 首次原生直接开档屏障失败与首次 owner 版助手写入差异、scene-pull 关闭后 cleanup 失败均保留日志，不标绿。
- 原生4项 ctest 64583 exit0（32.49秒），但对应程序早于最近C++源提交，不能单凭该次绿关闭版本门禁。已通过 Conan tests 入口启动 87216，重建 CameraWindowIdentity/VisionEngineScene/CollaborativeLoopback/native-file 宿主，日志 web-opt-ai-workflow-lifetime-native-build.log；待终态后重跑4项及native-file。整体 goal 仍 active，不提前关闭 WEB-OPT-13。

- 接续终态：Engine 配对提交 bf318fa5（固定 Editor e310702）；测试夹具独立提交 fb8da750。完整 UI 20395 完整 exit0，build/web-opt-ai-workflow-lifetime-packaged-all-final.log / build/web-packaged-ui-smoke/run-02ccr7rb/result.json，12 套全部通过、cleanup_ok=true、optics_failures=[]；原始失败证据保留。CEF 55395 当前仍在运行，未标通过。
- 当前 169 项 manifest 定义逐字核对 165 保留/4删除，无差异；current_cef 全 false。生产 BroadcastChannel 构造仅 api/webMessages.js；无旧通用调用或 src/api JSON 编解码。inventory current_source_commit 已更新 bf318fa5，文档/inventory 不暂存。

- 上轮为 progress：Conan 部署 62219 完整 exit0，退休接口/工作区 pin 52393 完整 exit0、51 passed。Editor 本地 e3107026234fee2414cccea05633681e24d78df1；Engine 配对 pin 待本地提交，无 push。文档/inventory 仅本地，不暂存提交；保留用户 Optics hunk，不主动修改 Horizon/ImGui。
- aiWorkflows 在首个 await 前捕获 projectIdentity/revision，load/startGoal/startScore/goalStatus/readContext 贯穿原始归属；路径/revision 更换取消旧任务，旧 catch 不写新档案。明确重新启动已取消的 goal 会领取新 generation，其他窗口恢复有效 provider 与评分平滑保持。14 项新回归先复现失败、修复后通过；全量 1257 JS、65 Python、lint/Vite 通过。证据均为 build/web-opt-ai-workflow-lifetime-*，取消 provider 的独立红为 web-opt-ai-workflow-cancelled-provider-red.log。
- 当前部署 frontend SHA256=30c224aa6908740c82f64295ae16bc751034911f2e40564f1a25292836dcfedb，exe SHA256=440ed238ab859af6afe043e7564607a9fe34e110bc847c91e3040c325f5994c8。
- 首次完整 UI 29525 exit1，run-1o57yvon：focus 通过，environment 在“real selection Actor index reply held”前置超时，cleanup_ok=true、optics_failures=[]。原夹具在创建 Actor/等待 SceneBar 后才拦截读取，后台刷新可能已缓存 Actor。改为创建前拦截所有 MainPage index 回复，仍使用真实点击/原生回复并断言新请求发生、退休后无 Dock 副作用；不改生产代码或降低断言。独立 environment 76992 完整 exit0；完整 all 20395 正在执行，尚未标通过。
- 当前组合 CEF、双实例、资源/音频及四业务探针尚待串行验证。既有 DEVICE_LOST/bad_alloc 风险未修复，不将历史结果当当前组合证明。整体 goal 保持 active。

## 当前实施：助手事件、加载与生成请求归属（2026-11-08）

- 上轮属于progress。本轮Editor本地c9e24407efa795a31c4a4f86ce99f8b31a08f979，Engine本地ed4146c8062ccdb77c8e1d3a962e110c5dbde261固定配对pin。所有本批会话终态；Engine只有用户Optics DEBUG注释hunk，Editor只有原有本地Markdown，暂存区空。无push、文档/inventory只保留本地、不暂存提交；不主动修改Horizon/ImGui。
- sendEvent在队列执行前及回执后核对项目路径/revision/ready；已退休排队事件不发送，旧回执不再发布上下文或触发新世界评分。8项新增回归原实现先1pass/7fail（web-opt-assistant-events-red.log），后全部通过；保留当前世界发布及评分的正常路径。
- loadCurrentWorld先确认归属再解释失败响应，并对已退休请求的拒绝返回null。goal启动/轮询沿用启动世界scope/revision，状态查询前后及异常路径核对归属，轮询去重键包含revision，避免同路径重开+同taskId复用旧promise。后台旧错误不打印为新世界失败，当前错误保持可见。10项新增回归先3pass/7fail（web-opt-assistant-world-requests-red.log），后全部通过；含正常完成、真实调用者错误和后台路径。
- 合计34项助手生命周期回归，全量1243 JS、65Python、lint/Vite通过。Conan98751完整exit0（web-opt-assistant-world-editor-deploy.log），退休接口/pin76976完整exit0、51pass（web-opt-assistant-world-retired-pin.log），pytest已知插件warning保留。未手改Conan锁或依赖；只更新Editor本地pin。
- 完整12套UI3514完整exit0（web-opt-assistant-world-packaged-all.log，run-um67z1yg），全部11面板与生命周期通过，baseline真实1→1，cleanup_ok=true、optics_failures=[]。最终CEF93458完整exit0（web-opt-assistant-world-cef.log / web-opt-assistant-world-cef-result.json），应用JSON禁用后具名V8、真实主/停靠/分离/相机及旧路由拒绝通过，passed/nativeBindings/cleanup_ok/graceful_exit均true。CEF fixture不替代packaged Vue或多实例证据。
- 当前frontend=8a190212127a03ec8c1d9a53eb7c0e3f52e27b00f33ff6801a8b58dc8229ec42；native exe仍440ed238ab859af6afe043e7564607a9fe34e110bc847c91e3040c325f5994c8。当前CEF固定1Actor/2Camera、每项20次：tree/index/properties/cameras为1671/194/664/1322字节，p50约17.9/18.2/18.0/17.9ms，p95约18.7/18.6/18.5/18.5ms，延迟接近，不能宣传为大场景加速。
- 169旧方法逐字核对165非Web定义保留、4删除、无差异（web-opt-assistant-world-inventory-audit.log）；current_cef均false。生产JS/Vue无通用旧桥/Proxy、src/api无JSON编解码；BroadcastChannel生产构造只有webMessages。inventory current_source_commit更新本批Engine配对提交。
- 新增仅本地2026-11-08-web-consolidation-delivery-audit.md，按WEB-OPT-00..13及七项完成标准列出实现、专项证据和缺口。本批未重跑双实例/完整资源音频/四旧业务探针，保留上一组合与历史结果，不搬用为当前组合验收。整体goal仍active：AIWorkflows后续await与旧catch的revision传递仍需进一步审计/复现，最终组合专项与逐项交付尚未全部闭环。
- 上轮Vulkan DEVICE_LOST及UI异常关闭风险仍未修复，本次CEF绿不证明已修复；此前StablePlanes约1.49GB临时分配bad_alloc同样未修复。两类原生失败及run-nud_f8li的测试前提超时证据保留，不混为评分生命周期问题。


## 当前实施：助手评分的世界归属（2026-11-08）

- 本批代码已本地提交：Editor f44ada703fbf04c8dc1bcefba365a6fbceb94109；Engine e9f7226b063e17e1ebdedd2a65b0404dc17fb119固定对应pin。无push；所有Markdown/inventory仅本地、不暂存提交。Engine只余用户Optics DEBUG注释hunk，Editor只余原本本地文档；不主动修改Horizon/ImGui，暂存区为空。所有本批会话均终态。
- 评分启动与轮询由同一世界操作拥有，捕获revision/规范项目路径/scope，使用操作身份保护复用taskId；并发启动共用一次请求。世界revision/path/readiness变化同步退休、取消等待，旧回复/错误不能发布或清理新任务；保留当前世界skipped/completed profile、有效错误与重试。独立Vue effectScope使视图卸载不终止世界评分，同时保留后续切世界的退休检查；没有新增通信模块或原生接口。
- TDD证据：15项实际服务回归先3pass/12fail（web-opt-score-lifetime-red.log），后通过；视图作用域附加回归先1!=0失败（web-opt-score-view-scope-red.log），修复后共16项通过。全量1225 JS、65 Python（既有pytest插件warning）、lint/Vite、Conan37494及51项退休接口/pin71185均完整通过。
- 当前产物完整12套UI47829完整exit0（web-opt-score-lifetime-packaged-all-final.log，run-xpqoemzi），含全部11面板与旧回调退休，baseline真实1→1，cleanup_ok=true、optics_failures=[]。增强双实例66146完整exit0（web-opt-score-lifetime-multi.log，run-wmc91gza）：旧业务/原生断开清房/显式重开重入/停网对象恢复均通过，native_failures/optics_failures/unexpected_process_exits均空，cleanup_ok=true。
- 保留失败证据：首次完整UI69147 exit1（run-nud_f8li）在环境SelectionLifetime索引回执前置条件超时；相同产物独立environment60579 exit0（run-udjunm47），之后完整all通过。未降低断言或宣称首次超时根因已修复，此为待跟踪测试稳定性风险。
- 最终CEF25407完整exit1（web-opt-score-lifetime-cef.log），PID36532，退出0xC0000409，在shared native camera properties with JSON disabled阶段CDP断开；此前主/停靠/分离消息及部分JSON禁用具名V8步骤通过，不能标完整CEF通过。真实运行日志2026-11-08_08-57-35_corona.log明确DisplaySystem vkWaitSemaphores VkResult=-4 / Vulkan DEVICE_LOST，随后多次Optics NodeFail。dump corona_engine.exe.36532.dmp的cdb栈（web-opt-score-lifetime-cef-crash-stack.log）显示UI ImGuiRenderer::render→HardwareExecutor::wait_completed→Queue::wait_for抛异常，关闭时shutdown_imgui_renderer等待再次抛异常/abort。本批未修改该路径，设备丢失的初始成因尚未定位；不能等同此前ReSTIR bad_alloc，也不能凭UI或cleanup绿忽略此失败。
- frontend=8ed0ef40d238866ae9267dbe70265b4cd2bfed1f3d28f0d6aacbd5f12acddb47；exe仍440ed238ab859af6afe043e7564607a9fe34e110bc847c91e3040c325f5994c8。169接口逐字核对165保留/4删除、无差异（web-opt-score-lifetime-inventory-audit.log），本地inventory commit定位更新e9f7226b。
- 整体goal仍active：本次最终CEF原生设备丢失与异常清理、此前ReSTIR分配风险、其余生命周期最终审计、WEB-OPT逐项交付审计仍未完成。sendEvent的迟到成功仍可能触发新世界的requestProfileScoreUpdate；这是后续待复现/修复的源码审计发现，不当作本批已处理。loadCurrentWorld/goalPlan旧错误归属等需继续按证据审计。

## 当前实施：LANChat连接状态收敛（2026-11-08）

- 最终终态：Engine本地8d56a961固定Editor6c849ad及增强断线探针；Conan92233、1209 JS/65 Python/51退休接口、增强双实例70083（run-537rcfz7）、完整12套UI63851（run-iuazlfzi）及最终CEF64104全部通过。真实PeerDisconnected后保持离线，显式重开/加入恢复聊天及停网期间对象；JSON禁用V8及主停靠分离CEF、正常退出通过。169接口定位更新8d56a961，无差异，所有会话终态，无push，文档/inventory未提交，用户Optics hunk保留，未主动修改Horizon/ImGui。下方运行中描述以本条为准。
- 整体继续active；下一源码风险为评分start回复后缺world/scope围栏，以及旧poll的catch/退休无条件清共享taskId。目前未加新回归或修复，不能将本批绿视作整体生命周期已审计完成。保持当前用户显式重连，不新增自动重试；原生ReSTIR分配风险仍开放。
- 接续终态：Conan92233与51项退休接口/pin61178通过；增强双实例70083完整exit0（run-537rcfz7），新增真实PeerDisconnected/清房停止/保持离线/显式重连后的聊天与对象恢复全部通过，旧业务和隔离断言保留通过，无native/Optics失败或提前退出，cleanup_ok=true。frontend=1e843f1d565c8135c1d92c3e71cfe729589a4ecb068fcb49e7cc7e780c813b44。完整12套UI63851仍运行，最终CEF与Engine配对提交待完成；下方早期“未执行”以本条为准。
- Editor本地6c849ad删除原生无发送方的reconnecting/reconnected及重连专用错误状态分支。真实断线仍清房停止会话、用户显式重连，未新增自动重试。11项store回归先5pass/6fail后通过，全量1209 JS、lint/Vite/Python65项通过。
- Engine工作区pin更新，Conan92233与退休接口/pin61178运行中，尚无当前组合完整验收。双实例测试已追加真实ENet断开/PeerDisconnected日志/清房/手动重开再加入、聊天与停网期间对象恢复，未执行，不冒作通过，也不声称覆盖丢包黑洞或自动恢复。整体active；文档仅本地不提交，无push，不主动修改Horizon/ImGui，保留用户Optics改动。

## 当前实施：助手与Blockly DTO复制统一（2026-11-08）

- 最终终态：Engine本地b73c46a9已固定Editor16203d8；Conan20629、51项退休接口/pin24739、完整12套UI74379（run-xidj2ppy）及最终CEF3143全部完整exit0。真实模型节点重挂编辑和所有11面板通过，baseline1→1；应用JSON禁用具名V8及主/停靠/分离通信、正常退出通过。frontend=a72a7a48e200dd6a51f52d0779b3ba5cee0cbf73dd997c14ef0bd0d0b8d061c4。169本地inventory定位已更新b73c46a9，165保留/4删除无差异；所有会话终态，下方运行中描述以本条为准。无push，文档/inventory未暂存提交，用户Optics hunk保留，Horizon/ImGui未主动修改。
- 本轮未重跑双实例，不用all/CEF替代该证据。网络store无原生来源的重连分支、其余生命周期最终审计及逐项交付仍开放；保持现有清房后用户重连，未新增自动恢复。原生ReSTIR分配风险未修复，整体active。
- 接续终态：退休接口/pin24739为51pass；完整UI79222因模型节点重挂后的独立DOM title查询为空而失败，保留失败证据。Engine测试提交acb8e351将取按钮/读标题/点击合并原子操作，未减少编辑断言；相同产物完整UI74379运行中，最终CEF仍待，不标完整交付。
- Editor本地089c7ff将助手store/图领域/教程领域复制统一到cloneWebDto，删除无生产发送方的baselineJson旧解析；操作历史details独立拥有，不再引用调用方对象。8项回归及1193 JS通过。
- Editor本地16203d8将MiniBlockly状态、NodeGraph快照及生成器真实Blockly载入前的复制也统一到cloneWebDto；5项回归及全量1198 JS通过。lint无错误（NodeGraph既有1条模板格式warning）、Vite、Python65项通过。
- Engine工作区pin已更新，Conan20629完整exit0；退休接口/pin24739及完整UI79222仍运行，最终CEF待执行，本组合未标交付。169接口源码165保留/4删除无差异；7个原生alias元数据均无CEF权限。
- 应用API/creative/viewport消息模块无JSON调用，src无JSON往返clone或baselineJson生产解析。JSON保留用途为HTTP/模型文本、存储文件、浏览器拖放字符串、生成代码及缓存/dirty/值比较，不将它们误删为通信桥。整体active，后续最终审计/断线语义/多实例等仍开放；文档仅本地不提交，无push，不主动修改Horizon/ImGui，保留用户Optics hunk。

## 当前实施：物理草稿与助手任务批次（2026-11-08）

- 最终终态：Engine本地93872237已固定Editor e355691及真实baseline探针；Conan9448完整exit0，退休接口/pin26057为51pass。完整12套UI89442完整exit0（run-zbhd5xha），11面板/保存重开/生命周期及baseline真实1→1通过；最终JSON禁用具名V8/主停靠分离CEF6282完整exit0，正常清理退出。frontend=f76ae2325fb17c9d13c82d8eacb379068c9481806c14901206fd2602279059e1。所有会话终态，下方运行中/待部署记录以此为准。原生分配风险仍开放，本轮未重跑双实例。剩余JSON clone分类、网络断线语义和最终审计未完成；整体active，无push，文档未暂存提交。
- 本地6e7184a：SceneControls物理草稿按六个字段监听并直接复制，不再JSON往返，同值/键顺序变化不覆盖编辑；10项回归先8pass/2fail再全绿。
- 本地e355691：助手任务批次复用现有场景操作围栏并捕获项目路径，退休后不继续提交任务/评分或报旧错误，各有效批次独立，结束释放token。16项MainPage setup回归及全量1185 JS通过，Python65pass（既有warning）、lint无错误、Vite通过；SceneControls有5条原模板格式warning。
- Engine工作区pin已更新，Conan Editor安装9448及退休接口/pin26057运行中；本组合部署与真实UI/CEF尚待终态。旧ReSTIR分配失败、其余JSON clone分类、网络断线语义和最终审计继续开放。文档仅本地、不提交，代码本地commit、不push；不主动修改Horizon/ImGui，保留用户Optics改动。

## 最新终态核对（2026-11-08）

- 覆盖下方历史运行中记录：退休绑定/CMake workspace11799已51pass；全部会话已终态。Editor3033e111为本地提交，Engine配对pin/探针尚未提交。
- 完整all34355在同路径重开阶段因原生StablePlanes初始化临时数组约1.49GB分配失败而退出，cdb确认bad_alloc及terminate/abort，详见Engine build/web-opt-main-project-transform-crash-stack.log；不能标绿，最终CEF尚未执行。
- 独立environment94590完整exit0，真实baseline事件1→1、环境及保存重开通过，不能替代完整all。助手多步骤持久化、physics草稿JSON复制、其余JSON分类、网络断线语义及最终逐项审计仍开放。不push，文档仅本地不提交，不主动修改Horizon/ImGui，保留用户Optics改动。

## 当前接续：项目刷新与变换基线（2026-11-08）

- Editor本地3033e1118f7d3f724dfd4c50e80b1e1a0b926009，变换baseline读取复用场景按Actor token，通知到达或新采样时退休旧回复；scene/archive变动清baseline。项目刷新共享scope/current校验，保留有效请求与无效旧通知的既有区分。19项生产setup回归与全量1159 JS、lint/Vite、Frontend Python65项通过，Conan34678完整exit0。
- 真实旧部署46181复现旧native属性样本使相同位置再次记录移动事件（1→2）；探针恢复所有边界方法和自有Actor状态，详见web-opt-main-project-transform-packaged-red.log。新部署完整UI运行中，最终CEF及Engine配对提交待完成，退休绑定/CMake workspace11799仍运行。
- 不push，文档仅本地，用户Optics hunk保留，Horizon/ImGui未主动修改；goal保持active，助手多步骤持久化、SceneControls草稿JSON复制及最终审计等仍待处理。以整体计划顶部最新证据为准。

## 当前接续：MainPage选择退休（2026-11-08）

- Editor本地1528d49ccb916be87f3fc264d4a0dcfd7011e2da，选择复用场景领域请求token并核对camera身份；旧索引及Object开窗/baseline采样共用有效性。处理新选择和模型节点选择替换、scene/archive/camera/handle ABA；普通同身份投影刷新继续有效；无相机或当前索引读取失败仍允许打开Object。
- 31项生产setup回归、全量1140 JS、lint/Vite、Frontend Python65项通过，Conan17537完整exit0。真实旧部署85942复现卸载后仍 open Object（web-opt-main-selection-lifetime-packaged-red-ready.log）；新部署完整12套UI66982完整exit0（run-zgmqoh9s），退休effects=[]、正常重挂与后续全部业务通过。CEF7381完整exit0，JSON禁用具名V8及主/停靠/分离文档通信通过，cleanup_ok/graceful_exit=true。Engine本地f2706ee5已配对本Editor及探针，frontend=d9804b933e6f0070191fe18804e0656a72142f4f6c9f4939b7f2c700d2f964c3。退休绑定/Git workspace40124仍在运行。所有文档仅本地、无push，用户Optics hunk保留，Horizon/ImGui未主动修改。本轮未重跑双实例网络。
- 退休绑定/Git workspace40124最终完整exit0：121项和6subtests通过（1条既有pytest插件warning）。本轮全部会话已终态，Engine/Editor暂存区均空，以上运行中记录以本条为准。
- goal仍active；项目事件错误、变换采样顺序、助手及JSON/最终审计待处理。详细过程与最终证据以本地整体计划顶部为准。

## 最新接续：环境批验收（2026-11-08）

- Editor本地8c027683已由Conan30584完整部署。原样独立environment14858、完整12套UI63250均exit0；完整结果run-xpkw1mrx包含旧环境投影退休、存活Dock网格写入、光照/物理及保存重开，cleanup_ok=true、optics_failures=[]。frontend=b5547cca9531f26286c48eda45044da3bbe492a55b825f2d0118aed1e345e6c8。最终CEF33270运行中，Engine配对pin/探针待本地提交。
- 旧完整17878崩溃转储本轮已解析：ReSTIR StablePlaneData约1.49GB分配抛std::bad_alloc，noexcept终止期间Python faulthandler再访问冲突；并无证据归因于资源轮询。没有修复原生内存分配问题，不用后续绿掩盖此风险。完整48662为graph CDP页面发现3秒超时失败，仍保留证据；工具连接预算统一20秒后，3项单测与完整63250通过，工具提交3e7132ce。
- 最终CEF33270已完整exit0：JSON禁用具名V8与真实主/停靠/分离CEF通信通过，cleanup_ok=true、graceful_exit=true。Engine本地b395f4e7已配对Editor8c027683和真实环境探针；以上待运行/提交描述以本条终态为准。本轮未重跑双实例网络。
- 不push，文档仅本地；用户Optics hunk保留，未主动修改Horizon/ImGui。整体goal仍active，MainPage选择及助手等异步路径、JSON归类和最终逐项审计仍待完成。细节以本地整体计划顶部接续为准。

## 当前实施：MainPage 环境编辑与资源轮询退休（2026-11-08）

- 上轮为progress，Engine HEAD a03629a5。Editor本地8c027683cea456168a4c328a95a2dde13113e039，pin工作区已更新。共享mainSceneOperation捕获view/scene/archive及领域请求身份；光照/网格/物理写入记录环境版本，旧组合投影仍可更新相机但不能回滚较新环境草稿。光照事件使用提交值，退休catch/finally不报旧错误/刷新新scene或清新busy。归档/场景切换集中清旧操作、timer与状态；资源poll停止同时退休在途回复与已排队timer，项目事件触发当前归档新采样。
- 完整生产setup复用mainPageFixtures（从原初始化测试抽出，保留所有原测试）：38项先7pass/31fail（web-opt-main-environment-lifetime-red.log）。补同归档切scene、foreign响应、退休入口及正常失败恢复/轮询，再48项通过（web-opt-main-environment-lifetime-green.log）。全量1109 JS、lint零错误/警告、Vite通过。旧camera projection夹具补环境版本/写入依赖；Python边界旧实时archive表达式改为捕获context断言，保留具名契约与退休alias检查；Frontend Python65项、退休接口/pin65项通过，各1条既有插件warning。
- 真实旧部署96443完整exit1（web-opt-main-environment-lifetime-packaged-red.log）：SceneControls实际DOM选择Vision ReSTIR触发真实getEnvironment，延迟该真实旧快照；另一EditorSettings Dock实际点击关闭网格，native状态已关闭，放行快照后主视口gridEnabled又变true。finally恢复方法、自有world网格和Vision PT，cleanup_ok=true、Optics failures=[]。探针不伪造native结果，不删减现有环境/保存重开断言。
- Conan Editor-only30584已完整exit0。完整UI17878已终态exit1（web-opt-main-environment-lifetime-packaged-all.log，run-aeppxedd），同路径重开后CDP连接断开。stdout确认07:26:32.709渲染线程34696发生EXCEPTION_ACCESS_VIOLATION（3221225477），此前有SDL surface teardown超时，随后Optics watchdog停在vision:view_prepare。尚无调用栈，不能归因于新增资源轮询，也不能将结果中的optics_failures=[]当作无原生故障。当前组合完整UI/最终CEF未通过；Engine pin/探针未提交。整体goal继续active，原生崩溃排查、剩余异步路径审计、JSON归类、网络断开策略和最终交付仍开放。
- 不push，Markdown/inventory仅本地、不暂存提交；用户Optics DEBUG注释保留，不主动修改Horizon/ImGui。

## 最新验收：MainPage 渲染退休与存活Dock重挂（2026-11-08）

- Editor仅本地1f5f61a（主渲染上下文）+ d6756f7b9f4fccc8737fa9c2a21c8d77102d9fcc（同文档provider版本）；Engine本地a03629a5已固定该pin与真实探针。Conan Editor-only32899完整exit0（web-opt-creative-remount-editor-deploy.log）。全部1061 JS、lint零错误/警告、Vite通过；65项退休接口/pin通过。Frontend Python65项本轮主渲染批已通过；Python均有1条既有插件warning。
- 最终完整12套UI65186完整exit0（web-opt-creative-remount-packaged-all.log，build/web-packaged-ui-smoke/run-m4phbs14/result.json）：退休MainPage render回执字段读取0、正常重挂=true，真实BroadcastChannel provider revision重挂前15、重挂后17，后续实际光照/网格/物理/保存重开全部通过。11面板及此前SceneBar/Object/ModelNode/Settings/dropdown退休、窗口/创建/标定/助手/Join/launcher/切世界回归通过，cleanup_ok=true、Optics failures=[]。
- 新组合frontend SHA256=39c410eafec703cd4ef0ff5864817a06cee5bc095827a1195417d44cbff3eb46；exe仍440ed238ab859af6afe043e7564607a9fe34e110bc847c91e3040c325f5994c8。最终CEF83452（web-opt-creative-remount-cef.log）完整exit0：JSON禁用具名V8、真实主/停靠/分离CEF通信通过，cleanup_ok=true、graceful_exit=true。本轮未重跑双实例网络，不搬用旧版本证据。所有构建/验收会话已终态，暂存区空。
- 本轮完整UI第一次13924（网格）和后续85752（光照）失败推动发现同文档版本回退；19697临时微任务trace运行虽绿，未作最终交付，临时trace已删除。夹具的分包/字段假设也已修正，未删减原生环境写入断言。
- 后续实质范围：MainPage环境（光照/网格/物理）的迟到失败、busy/读写竞争及资源状态轮询仍需单独失败回归；传输断开策略和最终逐项交付审计开放。整体goal继续active。无push，文档/inventory未暂存提交，用户Optics hunk保留，不主动修改Horizon/ImGui。

## 接续发现：同文档 provider 重挂版本回退（2026-11-08）

- MainPage渲染退休源码69项回归、全量1059 JS及Conan62236通过；旧部署83288真实迟到render_backend读取1次红。新部署的退休读取已为0，但完整13924在重挂后网格点击失败，补视口服务就绪后85752又在第二次光照点击失败，不能把这两个运行标为绿。
- 夹具补了真实viewportControlsService分包发现与getState就绪，纠正不属于该状态契约的cameraHandle假设；14442（分包未导出）与61588（错误字段）是夹具前置失败。临时native微任务trace19697完整exit0，但它改变了时序，不作最终组合验收，trace已移除。
- 源码定位createCreativePanelProvider每次Vue重挂将revision重置0，而CEF documentId与存活Dock client不变，client会拒收新的较低版本。新增同文档local/dock两项真实Web消息回归均先4!=5红（web-opt-creative-remount-red.log）；按消息文档对象WeakMap持续递增版本，现全量1061 JS、lint/Vite通过。没有新增通信通道/JSON DTO或双实现。
- Editor功能提交1f5f61a（主渲染上下文）及d6756f7b9f4fccc8737fa9c2a21c8d77102d9fcc（provider版本）；Engine pin工作区更新后者。Conan Editor-only32899（web-opt-creative-remount-editor-deploy.log）运行中，尚无最终完整all/CEF。新增真实BroadcastChannel版本观察会断言重挂后的最小版本大于重挂前最大版本，并保留所有环境写入/保存重开验收。
- 文档与inventory仅本地，代码仅本地功能提交，无push，不主动修改Horizon/ImGui，用户Optics hunk保留。整体goal继续active，环境其他异步路径与最终审计仍开放。

## 当前实施：MainPage 渲染编辑生命周期（2026-11-08）

- 上轮SceneBar为progress；本轮Engine HEAD仍92d6cbed，Editor本地1f5f61a56e186a7d58b833ece774ce60d02c5c68，pin工作区已更新。mainCameraOperation统一捕获view/scene/camera/archive/handle，并按渲染领域保存请求身份；初始化与显式mode共用身份，防迟到初始化覆盖新选择。快照切换绑定时集中退休pending选择/清busy；旧finally不能清新请求busy。保留不同渲染选项并行及正常失败回滚。
- 新生产声明执行回归66项全红（web-opt-main-render-lifetime-red.log），再补初始化退休3项也真实红（web-opt-main-render-lifetime-init-red.log）；修复后69项通过。旧夹具补实际共享声明及archive身份，原4项退休成功返回断言改为false，保留其新相机字段/错误断言。现全量1059 JS、lint零错误/警告、Vite通过；Frontend Python65项、退休接口/pin65项通过，各1条既有插件warning。
- 真实旧部署83288完整exit1（web-opt-main-render-lifetime-packaged-red.log）：实际SceneControls菜单点击Native，真实native成功回执延迟至实际router卸载MainPage后交付，退休组件仍读取1次render_backend。finally恢复facade和原路由；cleanup_ok=true、Optics failures=[]。
- Conan Editor-only62236（web-opt-main-render-lifetime-editor-deploy.log）运行中，部署完整all/最终CEF尚待，不提前标绿。后续实际缺口为MainPage光照/网格/物理及资源状态的其他异步路径、传输断线产品语义、最终逐项交付审计。整体goal继续active。
- 不push；文档/inventory仅本地不暂存提交；用户Optics DEBUG注释hunk保留，不主动修改Horizon/ImGui。

## 最新终态：SceneBar 编辑生命周期已配对验收（2026-11-08）

- 本地配对 Engine92d6cbed / Editor及pin f184269517e3c05ae4889d965c92ebaa497471e4。SceneBar以同一sceneOperation捕获view/scene/archive，退休回复不再开窗口、继续删除/重绑、刷新新场景、通知新上下文或写入旧错误；visibility请求revision防同值ABA，后端读写共享sequence。原生已发起create/save仍有效，保留现Dock与相机关闭后的0ms等待。
- 全量990 JS、所有改动文件lint零错误零警告、Vite通过（保留既有大分包提示）；Frontend Python65项、退休接口/pin65项通过（各1条既有插件warning）。54项核心生产setup回归先3pass/51fail，修复后通过，另加6项正常与失败回滚检查。
- Conan Editor-only31346完整exit0（web-opt-scene-bar-lifetime-editor-deploy.log）。真实旧部署79702完整exit1，实际DOM添加摄像头/native创建回复在实际Vue卸载后交付仍请求1个窗口。最终完整12套UI26575完整exit0（web-opt-scene-bar-lifetime-packaged-all.log，build/web-packaged-ui-smoke/run-rdj_7xup/result.json）：退休开窗请求0、正常重挂=true；此前Object/ModelNode/Settings/dropdown退休回归及全部11面板/停靠分离/窗口隐藏恢复、创建/标定/助手/Join/launcher/切世界继续通过，cleanup_ok=true、Optics failures=[]。
- 最终CEF62929完整exit0（web-opt-scene-bar-lifetime-cef.log）：JSON禁用具名V8、真实主/停靠/分离CEF通信通过，cleanup_ok=true、graceful_exit=true。frontend SHA256=5bd5e3265061e18295d8ccbb67b4cdc42e82c4b22e35c65d386a53a0bc10ea51；exe SHA256仍440ed238ab859af6afe043e7564607a9fe34e110bc847c91e3040c325f5994c8。本轮未重跑双实例网络，不搬用旧版本结果作本次验证。
- 所有构建/验收会话已终态，暂存区空；Engine唯一未提交代码仍为用户Optics DEBUG注释hunk，Editor只余本地文档。无push，Markdown/inventory未提交，不主动修改Horizon/ImGui。整体goal继续active，下一实质缺口为下列MainPage编辑回执归属、断线语义及最终逐项交付审计。

## 当前实施：SceneBar 编辑回执退休（2026-11-08）

- Editor 本地 f184269517e3c05ae4889d965c92ebaa497471e4；复用 viewLifetime，集中捕获 scene/archive，为删除相机、创建后开窗、资源重绑、保存、focus、截图、可见性和后端切换添加回执归属检查。可见性 revision 防同值 ABA，后端 read/toggle 共用请求序列；保留原生已发起操作及相机关闭后的既有 0ms 退休等待。
- 完整生产 setup 的 54 项回归先 3pass/51fail（web-opt-scene-bar-lifetime-red.log），修复后全绿；补正常保存/重绑/取消/删除及失败回滚，现全量 990 JS、定向 lint、Vite 均通过。Frontend Python65项及退休接口/pin65项通过，各1条既有 pytest 插件 warning。旧抽取夹具补入实际生产 sceneOperation，保留原权限/身份/字段断言。
- 真实旧部署79702完整exit1（web-opt-scene-bar-lifetime-packaged-red-camera.log）：点击实际添加摄像头按钮、等待真实 native 创建成功、Vue router 完成卸载后才交付回执，退休 SceneBar 仍请求1次窗口。探针阻止该退休窗口创建，finally 恢复方法/路由并删除自有摄像头。首次32849在既有 ModelNode 行消失时点击空元素，属夹具时序问题，不作生产红；改等候并原子点击实际行。
- Engine pin 已更新 f184269；Conan Editor-only31346（web-opt-scene-bar-lifetime-editor-deploy.log）完整exit0；本组合完整12套UI26575（web-opt-scene-bar-lifetime-packaged-all.log）运行中，最终CEF待执行。不可套用上一批部署结果。总目标、其余异步路径审计、断线语义澄清与逐项交付继续开放。
- 不 push；Markdown/inventory仅本地不暂存提交；用户Optics DEBUG注释 hunk保留，不主动修改Horizon/ImGui。

## 待收尾的实际范围（2026-11-08 复核）

1. SceneBar 本批源码/单测/Conan部署、完整真实UI与最终CEF均完成，Engine92d6cbed已固定本地配对提交。
2. MainPage其余异步编辑路径：selectMainRenderMode在native回执与catch中直接写共享后端/模式；toggleMainVisionAccumulation及同类选项的isCurrent仅比较scene/camera，需补核view/archive和请求归属；updateSceneLight的catch/finally仍可能刷新或释放新请求状态。当前仅源码审计结果，尚无本轮失败回归，不宣称已修复。
3. 网络传输断开后的产品语义仍待确认：保持当前清房后由用户重连，或新增自动重试/保留房间。此前已验证显式离开重入与双实例状态同步，不能视作传输临时中断自动恢复。
4. WEB-OPT-13：待剩余生命周期路径逐项审计后，按最终Engine/Editor pin与实际产物重新配对验收，更新169旧接口本地inventory及边界说明。整体goal保持active；以下旧历史段落的“待处理”以最新终态为准。

## 最新终态：Object属性/变换及延迟监听器已验证（2026-11-08）

Engine本地86296628 / Editor及pin6ceacac5e56fc193c76dcef74f2b16335d67fa4c。Conan7313、最终完整12套UI83042（run-wlh8il94）与JSON禁用CEF42666均完整exit0。退休dropdown document listeners=[]、Object physics events=[]，正常重挂编辑和已有alias/ModelNode/EditorSettings退休回归通过；UI cleanup_ok=true、Optics failures=[]，CEF graceful_exit=true。frontend SHA256=4d15503463a5f9da7f029b3f2b9490dbfeceaedca5c448d3360c08d3f6a2ebb6。全量930 JS、lint/Vite、Frontend Python65项及退休接口/pin65项通过。所有本批会话已终态、暂存区空，仅用户Optics代码hunk保留未提交。

后续SceneBar相机删除/创建开窗、资源重绑、后端切换及相关save/focus/visibility回执仅完成源码风险识别，尚未验证或修改；断线语义和逐项最终交付仍开放。整体保持active，代码仅本地功能commit，没有push，Markdown/inventory不暂存提交，不主动修改Horizon/ImGui。

## 当前：Object属性回执与延迟指令注册（2026-11-08）

Editor本地acbbb47保护Object其余属性/变换/保存工作流：旧Actor回执不回滚新选择、不记录错误归属的物理/变换事件；render/body保留各自revision防同值ABA。变换成功事件等待实际native写入，RAF尚未执行时由同一flush提交；背景错误观察保留失败Promise，变换失败不继续scene.save，修正并重交后可保存。已发起的显式保存仍按捕获scene/archive完成，但退休回执不写新UI或通知新上下文。完整setup先22pass/24fail，扩展相机锁/选择busy再57pass/9fail，后全量926 JS、lint/Vite通过。真实物理旧部署43171在卸载后仍发physics_changed而exit1；Conan80572与真实properties25293均完整exit0，退休事件=[]且重挂编辑正常。Engine本地e9b31654已固定该pin/探针。

main.js的click-outside延迟监听器注册再独立修复：4项生产directive回归先1pass/3fail，后全量930 JS、lint/Vite、Python65项和退休接口/pin65项通过。真实SceneTools dropdown89535在实际router.push卸载后仍留下mousedown/touchstart监听器而完整exit1。Editor本地6ceacac5e56fc193c76dcef74f2b16335d67fa4c记录/取消timer，排队回调核对原handler身份，不影响重挂新实例；Conan7313完整exit0，新组合完整all83042仍运行中，最终CEF待执行，不提前标全绿。前两次物理probe无法取得分包service及首次directive probe使用异步hash事件导致测试前置失败，均不作生产红证据；现探针只观测实际部署模块/真实DOM/native结果，finally恢复自有方法/handler/路由。

后续实质审计为SceneBar删除相机、资源重绑、相机创建后开窗及渲染后端回执的view/archive/scene归属；目前仅源码风险，尚未复现或修改。断线策略与最终逐项交付审计仍开放。没有push，Markdown/inventory不暂存提交，Horizon/ImGui及用户Optics hunk不主动修改。

## 最新：Object选择工作流完成配对运行验收（2026-11-08）

Engine本地ce3af489 / Editor及pin95c480fc4caf46073cd80ab53f8bd54684b79673。Conan Editor-only50127、完整12套UI85691（run-e1r6hks5）及JSON禁用CEF30775均完整exit0；Object真实迟到rename字段读取0、正常重挂通过，ModelNode可见性和设置页退休探针继续通过，cleanup_ok=true、Optics failures=[]，CEF graceful_exit=true。frontend SHA256=a7350099e5b2d3e09ff22d32d270f87c9b6ac770302dc86165c09b023d7b7513。全量880 JS、定向lint/Vite、Frontend Python65项及退休接口/pin65项通过。Python首次目录错误收集失败后从editor目录重跑通过，不当作生产错误。

本批无存活构建/测试进程。下一实际审计为Object其余属性失败回滚、物理事件及变换/保存异步工作流；其余视图最终生命周期、断线语义确认和总交付审计仍开放。所有代码仅本地commit，没有push，文档/inventory不暂存提交，不主动修改Horizon/ImGui及用户Optics hunk。

## 当前：模型节点退休已验收，Object选择回执待新部署（2026-11-08）

ModelNode的真实迟到native mutation回复旧部署读取2个字段而失败；Conan39414安装Editor2cafb2f后，完整12套UI15036与JSON禁用CEF81132均完整exit0，迟到字段读取0、正常重挂/可见性编辑通过，graceful_exit=true。Engine本地db2c738c固定pin及真实探针，frontend SHA256=5e8205ef85f4fc1d4cd3276370e029ce2ef770850c084cdc544d12601f0a636d。

后续审计Object资源chooser/rebind及rename：完整生产setup13项先2pass/11fail，现复用viewLifetime、loadSequence、archive/scene/GUID围栏，保存发起身份，失效chooser回执不再启动rebind，迟到rename/rebind成功/失败不写旧选择。新增取消再开、正常rename、第二await退休与busy恢复后全量880 JS、lint、Vite通过；Editor仅本地95c480fc4caf46073cd80ab53f8bd54684b79673。真实旧部署6060在DOM Enter rename后路由卸载，迟到回复仍读取1个new_name字段而完整exit1；仅延迟facade真实回复，finally还原自有Actor名称。首次独立properties运行未导航主页面，已补runner前置，不当生产红。当前Conan50127仍live、pin工作区95c480f，新部署真实绿待取得。Object其余异步属性/保存、断线策略与整体审计继续开放；没有push，文档不暂存提交，Horizon/ImGui及用户Optics改动不主动修改。

## 最新验证与本地提交（2026-11-08）

用户再次要求先不推送远端；本批没有 push，所有 Markdown 文档继续仅本地、不暂存提交。Engine 本地7e620e5a补原生 Actor 状态广播和开房 seed，f57b4a27固定设置页生命周期版本e714352及真实探针。Conan4024完整exit0后，增强双实例64545、完整12套UI87831及当前产物CEF96656均完整exit0。真实双实例覆盖开房前对象、创建/删除、双向变换/可见性/重命名和显式离开重入；设置页退休后迟到字段读取0且正常重挂。该批frontend SHA256=b10110f1002f61eec9cbdc9932d62196afd9944ed7b3eec7c06e987aaa95e9b5，Editor/pin=e714352。

后续 ModelNodeHierarchy 复用 createViewLifetime，保留 Actor身份/request/版本校验，退休后的排队 mutation 不发 native 写入，迟到回执/读取/展开/ResizeObserver 不写旧视图。完整生产setup回归先1pass/7fail，后定向8项通过；补Actor切换拒绝、原生失败恢复、读失败重试和mounted nextTick退休后，全量858 JS、lint、Vite通过。本地Editor提交2cafb2fa2b141c80a066a15af07d56fd78bce17a，尚未更新Engine pin或部署，不能引用上述e714352运行证据作为该修改的真实UI验收。断线语义及最终生命周期/交付审计仍开放，整体active。

## 当前：设置页退休、对象同步和快照通道（2026-11-08）

Editor本地e714352a8eca56b5b2d13896b0dc230fcf28eca7复用createViewLifetime保护EditorSettings；AI读取/保存、viewport请求的回执/失败/finally和排队速度回调不再影响退休视图，保留既有取消/订阅/timer清理。完整setup先1pass/6fail，扩展11项后全量846 JS、lint0error/1条既有格式warning、Vite通过。真实旧部署panels12337在路由卸载后仍读取2个脱敏设置字段而exit1，测试不保存Key；新部署必须验证0次读取和正常重挂，尚未标真实绿。

Engine已本地提交93507859修复PeerManager回调stop后poll继续访问host；e32f8287补具名Actor创建/变换/删除的原生广播，真实双实例、离线创建后重入、12套all及JSON禁用CEF具名回归通过（exe865985d9…/旧Editor1ada924）。后续属性/重命名双向及开房前对象均真实红；工作区补原生状态广播与seed。seed发包后首次来客仍缺对象，查明快照BEGIN/END控制通道会先于bulk分片到达；b142d4cc统一三类快照消息到bulk可靠有序通道，真实ENet双端原生回归先红后绿。此为native网络JSON协议，不恢复Web通用广播接口或JSON文本DTO。

当前pin=e714352；Conan tests86928和CameraWindowIdentityTests完整exit0，pin版本16pass；examples4024仍在部署，组合真实双实例、设置页panels/all和最终CEF回归待取得。以上新旧产物证据不可混用。ModelNodeHierarchy排队mutation/迟到加载的退休风险尚待复现；断线策略澄清及整体最终审计继续开放。文档仅本地，不暂存提交，不push、不主动修改Horizon/ImGui，用户Optics改动保留。

## 最新：LANChat 多实例业务与气泡生命周期（2026-11-08）

当前Engine e02b83b2 / Editor及pin1ada924760e43be30ab6f0ff727ea0c505d3de4a，仅本地提交。Editor修复AIHintBubble：共享viewLifetime与展示/auto-hide版本，旧nextTick、关闭/隐藏/进度回调不能影响新提示；关闭timer登记并在卸载/替换时清理，重复dismiss只调度一次。show/hintText watcher作为唯一初始化，删除重复mounted逻辑，模板悬停/离开改为实际调用暂停/恢复方法。

定向先1pass/6fail，9项覆盖后全量835 JS、lint、Vite、版本16项通过。旧部署真实88420在mouseenter后hide/progress仍为1，明确exit1。Conan93048、真实launcher6955及完整12套all26514均完整exit0（run-x97x7dfx），包含实际Teleport气泡悬停/恢复、替换提示取消旧close、确认新close已启动再卸载及所有timer归零，其他全部套通过。frontend SHA256=2a4dd2c146707b55844329560f987f6463c86d5cc30b22b2d67832ada5cec4d5；Engine2dbe2a49提交探针与pin。

随后Engine e02b83b2仅新增真实LANChat双实例验收，无生产变更，不重复构建。8634与加严发现/原生角色的83414均完整exit0（web-opt-lanchat-business-discovery.log，run-hjoe03cd）：真实发现房主、加入前历史同步、双方消息恰好一次且id/seq/顺序一致、host/guest与原生host/client角色、离开后成员变更、显式重入、历史持久列表/加载及关房ROOM_CLOSED通知通过，保留原有Vue编辑和Dock/owner/foreign archive隔离。两个network.project_root显式指向测试自有目录，历史不写用户项目或runtime；两个Job进程清理成功，Optics failures=[]。显式重入不等于自动断线重连；自动重连、对象同步与最终交付仍开放。无存活本批会话，无push，文档仅本地，用户Optics hunk保留，Horizon/ImGui未主动修改。

## 最新：StartScreen 动画与 Pet 提示退休（2026-11-08）

Editor本地3a0f0a0077f144956566c33380fec433db9b3453：复用viewLifetime，退休后的nextTick不显示提示或启动动画，返回/退出动画完成回调不写旧UI或关闭进程；RAF、resize回调同样围栏。StartScreen用GSAP自己的context登记动画并在卸载revert，补释放粒子geometry/material，不清理其他页面动画，不增加通信层。

7项完整生产setup回归先2pass/5fail后全绿，全量826 JS、lint、Vite、版本16项通过。旧部署真实launcher41819 exit1（run-ig8uxoi5）：实际退出确认后路由卸载，仍调用closeProcess；探针在Web facade拦截该动作，不让测试引擎真的退出。Conan23452和最新真实launcher22681完整exit0，三次退出/普通面板/取消卸载后无closeProcess，RAF/timer/监听器归零，脱离DOM的style不再改变。frontend SHA256=b24bdb97eddf89311ccbb91f9140fad4f4838130c9a4d88e1337d20144e602c7。新增launcher后完整all为12套，11680完整exit0（run-k2s5b_me），全部11面板及创建/选择、标定、助手、JoinGame、launcher、切世界通过，cleanup_ok=true、Optics failures=[]。Engine7cf8efda已本地提交探针与3a0f0a0 pin，无本批存活会话。无push，文档仅本地，Horizon/ImGui和用户Optics hunk未主动修改。AIHintBubble的nextTick及关闭timer、完整LANChat多实例、最终交付审计仍开放。

## 最新：NewGame 激活等待退休（2026-11-08）

Editor本地264130be7e15f770b2b499ce50cdc2f9ce66a6d9将NewGame迁到共享viewLifetime，保留项目选择superseded和project revision。激活读取后和每次200ms等待前检查current；卸载清理250ms轮询及单次等待并resolve，迟到回执不继续任务/开房或写旧busy。正常创建、任务和房间顺序保留，没有新增通信接口。

完整生产script setup回归先3pass/10fail，扩充revision变化及正常重试后全量819 JS、lint和Vite通过。真实creation探针扩展为实际NewGame挂载、native就绪回执延迟、实际卸载和正常重挂；旧部署56097也exit0，只作为就绪生命周期验收，不冒充激活timer缺陷的真实红证据。Conan82500、最新creation21273（run-8uj9mgwm）和完整11套all10287（run-9s24xix7）均完整exit0，全部11面板及创建/选择、标定、助手、JoinGame、切世界通过，cleanup_ok=true、Optics failures=[]。frontend SHA256=bf83ae7766511135e0404f0d10b34d8a59882ea6b5582245430598da76e2ca42。Engine81956f69已本地提交真实探针和264130b pin，无本批存活会话，文档仅本地、未push，整体active。后续实质缺口为Pet的nextTick迟到提示、StartScreen动画回调/卸载保护、完整LANChat业务及最终交付审计。

## 最新：Dock退出期间活动查询（2026-11-08）

Editor本地d7bd49473c5db2f87cca47e01f0ab21b6e07c6e0：窗口关闭的只读activitySnapshot可能与其他Dock正常退出相遇。webMessages仍以CONTEXT_CHANGED拒绝失效快照，附PEER_LEFT原因；只有活动查询在该原因下按原超时预算重新收集，存活窗口的活动仍阻止关闭。保存、原生操作、普通上下文变更和超时不重试，不增加通信层。

真实BroadcastChannel回归先红后绿，完整804 JS、lint、Vite及版本16项通过。Conan27152 exit0；真实标定21259 exit0（web-opt-activity-departure-packaged-green.log，run-poj2ndmz），frontend SHA256=b0ad6f3a708db77bfd1b74aa09ef661b4cf824f41ec1cef42d38dae5c4e2de04。完整11套all30516完整exit0（web-opt-activity-departure-packaged-all.log，run-_wb9wic6），标定/助手/JoinGame/切世界及全部11面板通过，cleanup_ok=true、Optics failures=[]。仅等待原生target退休的前次清理探针仍失败，原始失败记录保留。Engine25b5ee24已本地提交真实验收与pin，最终配对Editor d7bd494；无本批存活构建/测试会话，无push，文档仅本地，Horizon/ImGui及用户Optics改动未主动修改。NewGame轮询退休、完整LANChat多实例及最终交付审计仍开放，整体未完成。

## 最新：JoinGame 建房与加入退休（2026-11-08）

Editor本地55c231fac15f321ff460262d0b6b2e5b4a779ab7，Engine真实探针07c60de8；工作区pin已更新但尚未提交，未push。JoinGame继续使用viewLifetime，在查询/停止旧会话、创建/打开联机项目、设置项目根、启动/连接网络的异步回执之后检查页面是否退休，阻止后续工作及旧UI写入；保留项目选择superseded版本，不回滚有效页面已发起的native操作，不新增会话所有权协议。

定向23项、全量802项JS、Vite及pin版本16项通过。Conan11858 exit0，独立真实join56380 exit0（run-zbilima6），host/guest退休后无后续禁止操作。该探针不替代完整网络业务验收。完整11套all77864 exit1：标定套finally清理closePanelTab收到CONTEXT_CHANGED，尚需定位；cleanup_ok=true、Optics failures=[]。本批完整all不得标通过，最终pin提交暂缓。完整LANChat多实例业务、其他视图最终生命周期审计及最终交付仍开放。文档仅本地，用户Optics注释保留，Horizon/ImGui未主动修改。

## 最新：JoinGame 搜索退休（2026-11-08）

当前本地Engine2585a428 / Editor及pin166ee95b54f67fe8bd017ac1066e6ad7563d3ca8，未push。JoinGame复用createViewLifetime，搜索每个await后阻止退休工作继续；卸载时取消3秒间隔和1.5秒单次timer并结束等待Promise，迟到发现结果及本机地址成功/失败不写旧组件。没有新通信模块、DTO或JSON文本中转。

七项回归先1pass/6fail后7pass，全量786 JS、定向lint（0error/2条既有格式warning）、Vite及pin版本16项通过（1条既有pytest插件warning）。旧部署真实run-1k4qowso证明clearDiscoveredPeers回执前实际卸载后仍发起searchLan；初轮run-so31awx0是探针setTimeout接收者错误，不作生产红证据。Conan94133完整exit0，无锁不一致，frontend SHA256=1fa67ad5926e2d56657c6d11a59797e294c18771b399cc7e9ad9364e8e99a138，JoinGame源码和部署文件一致。

独立join31048及最终11套all27803完整exit0（web-opt-join-discovery-packaged-all.log，run-8z0lu0rb）：clear/search回执及1500ms等待期间实际卸载都不继续native work、无残留单次timer，正常重挂搜索通过，其他10套及全部11面板通过；cleanup_ok=true、Optics failures=[]。Engine45185ba9提交真实探针，2585a428更新pin，无存活构建/测试会话。JoinGame建房/加入工作流、完整LANChat多实例与最终交付审计仍开放。文档仅本地，用户Optics注释保留，Horizon/ImGui未主动修改。

## 最新：快速切世界与原生隐藏恢复验收（2026-11-08）

Engine4b14d2a7新增验收，Editor及pin仍6e19a883ec608a6a6cd01a96b11cb070d946e0bc，生产产物无修改。真实MainPage旧相机投影回执延迟，中间世界native open已完成但launcher未返回时提交最终世界；中间选择superseded，初始旧快照不派发旧archive命令，最终真实输入仅写latest-camera，恰好保留一个MainPage输入监听器。focus复用原生HWND最小化恢复流程，4 HWND真实执行，主窗口/CameraView监听器列表、CEF文档/tab/archive保留，相机输入恢复。

首次十套run-4zw1s9to在助手generation退出处失败，日志显示遗留标定窗口来自测试强制Page.reload之前的旧generation。按现有设计，启动恢复探针在故意重建主文档前先走生产setEditorUiEnabled(false)退休会话；标定关闭也改为appService.closePanelTab清理登记。不新增旧Dock跨强制热重载自动重绑，不削弱正常generation全部退出断言。最终十套92762完整exit0（web-opt-world-hidden-lifetime-packaged-final.log，run-fj895s5b），全部11面板、标定、助手及新增lifetime通过，cleanup_ok=true、Optics failures=[]。本批文档仅本地，未push；下一生命周期缺口是JoinGame异步搜索链卸载后继续执行，完整LANChat多实例及最终交付审计仍开放。

## 最新：CameraView 迟到回执退休（2026-11-08）

当前本地Engine09c47c89 / Editor及pin6e19a883ec608a6a6cd01a96b11cb070d946e0bc，未push。CameraView保存设置与脚本状态轮询复用viewLifetime，卸载后的成功/失败回执均不再更新旧组件；保存回执也不再resize当前原生窗口。没有新增通信层或DTO，没有JSON文本通信。四项迟到回归先红后绿，779 JS全量、Vite、版本16项通过；lint无error/四条既有Vue格式warning，pytest保留一条既有插件warning。

首次部署遗漏更新pin，入口切回旧92fd054，作为实际红基线：run-9d3py9yh在真实设置回执前卸载CameraView，交付后仍resize384x516，不能算修复部署通过。更新pin后的Conan82103完整exit0，frontend SHA256=932f4580f33f672b4cddb3cb4619b37db54ec3200694a94d8ea6b71846dfd76a。真实focus1667及九套all43615（run-wogdw_sw）均完整exit0：退休设置回执后resize为0；首次drag await、readCameras、selection注册期间实际卸载，初始化停止、迟到token只off一次；重复重挂输入恢复、native tab身份不变。cleanup_ok=true、Optics failures=[]，无存活构建/测试会话。快速切世界/隐藏恢复及其他视图、完整LANChat业务与最终交付审计仍开放。所有文档只在本地，用户Optics注释保留，Horizon/ImGui未主动修改。

## 最新：助手跨owner消费者与单次初始化（2026-11-08）

当前本地Engine72ac094e / Editor及pin92fd05416e0832f870c94f12031287a874d3a10d，均未push，文档仅本地。消息订阅用已有ownerEpoch向本地回调传来源，四个生产消费者交实际Pinia action；store按owner划分时间线，替换owner的较早业务时间可接受，同owner过期值仍拒绝。owner来源不加入DTO、不新建协议，旧owner仍由公共transport拒绝。真实BroadcastChannel+真实store回归及独立store回归先红后绿。

NodeGraph的手动初始化查询与subscribe emitCurrent曾重复；真实旧部署run-tyumdjco明确失败于duplicate initial context reads。现删除手动查询，领域请求函数转私有，统一由订阅初始化及退休围栏处理，清理退休测试stub。774 JS通过，lint 0 error/1条既有Vue格式warning，Vite/最终pin版本16项通过（1条既有pytest插件warning）；Conan89191完整exit0，无锁不一致，frontend=1423dbc7d2b4cc5a6181cac101fe1029a4771554e338d309c2717ae2fa5a21e3，服务源码/部署=24454f1a2a2daa12f2727a9402e1d7b90f9e0b27be86030aad93e7a914e6068f，exe仍db68ce73…。

独立assistant61453及最终九套all76389完整exit0（web-opt-assistant-owner-graph-packaged-all.log，run-im_e3qmg）：任务板/聊天/NodeGraph初始化各一次owner读取，初始reply前实际卸载不写store、重挂各自第二次查询且tab身份不变；startup/双向/storage拒绝/主重挂、11面板/2 HWND最小化恢复/图保存关闭与失败重试/标定均通过。正常generation切换前既有5个CEF文档全部退出（其中助手tab36/37/38），新任务板tab41正确hydrate且generation匹配；cleanup_ok=true、Optics failures=[]，无存活会话。按现有createEditorWindowSession.prepare/retire的规则先退休登记Dock再创建新generation，不要求旧Dock自动重绑。上述证据不扩展到强制主文档热重载后的旧窗口恢复。WEB-OPT-06计划内场景现有证据齐备；其他视图竞态、完整LANChat多实例和最终交付审计继续开放。

## 最新：助手后台顺序、启动恢复与初始化卸载（2026-11-08）

当前本地Engine61daf844 / Editor及pin fd5e29115e18ef0e0113080f64101c2811d2923f，未push，文档不暂存提交。后台业务updatedAt与活动快照的发布时间分开：loadCurrentWorld复用publishBackendContext，按projectScopeId/ownerEpoch/worldModeState.revision跟踪已接受的后台顺序，拒绝较旧后台结果；合法完成结果发布单调活动时间，保留当前图上下文和合法选择。读取不改写后台返回context对象或另造消息总线。原工作流本来就会contextTransaction提交存档；本批保留该既有持久化行为。

四项确定性回归先红后绿，773项完整JS、lint、Vite及版本16项通过（1条既有pytest插件warning）。真实红run-n5spufdh在实际主文档reload/真实持久化/真实AI工作流完成后，暂缓Web facade返回，聊天Vue取消选择先到，再交付load结果后仍停留恢复缓存任务；web-opt-assistant-startup-completed-load-red.log实际exit1。普通启动及低层commit暂缓的前两轮探针实际exit0，两个找不到AI facade的探针错误也不是生产缺陷，均保留日志；最终导入实际部署领域bundle，不修改readonly V8。

7821f1e部署40324完整exit0后，真实assistant83534完整exit0（web-opt-assistant-startup-retirement-packaged.log，run-8jcmyw44）：恢复cache后交付真实load，立即正确显示存档两任务及消息并保留较新选择；任务板/聊天在初始owner reply前实际路由卸载，回复交付后store不变，重挂各自第二次查询owner且tab身份不变；后续双向、晚加入、主重挂/storage拒绝均通过。cleanup_ok=true、Optics failures=[]。

fd5e291进一步补齐同路径新会话的后台clock重置，旧会话迟到load仍返回null。最终Conan32454已完整exit0，frontend SHA256=71b8e67392b2ff363744ddf942958da2d5760f8bbeddb2aea8682c2a6af48387，服务源码/部署SHA256同为344bd100169470d7fc3233704c0f9750470cfd1b98ae17c84b6b49052a81ac0b，主exe仍db68ce73…。最终九套packaged all29457完整exit0（web-opt-assistant-startup-session-packaged-all.log）：全部11面板/2 HWND最小化恢复/图保存关闭与失败重试/标定重挂/助手startup及初始化退休均执行通过，助手3存活tabId35/36/37，storage写拒绝5次仍同步，peer活动读写0，cleanup_ok=true、Optics failures=[]。最终fd5e291具有独立完整验收，当前无存活构建/测试会话。助手跨owner后Vue/store对较旧业务时间及native generation变化按现有Dock设计的退休/恢复预期仍待核对；不预设要求旧Dock自动重绑。其余视图竞态、完整LANChat及最终交付门槛继续开放。

## 最新：助手快照与真实文档同步（2026-11-08）

当前本地Engine18c35c00 / Editor及pin72ce6a5，均未push，文档不暂存提交。助手订阅按projectScopeId/ownerEpoch隔离时间戳和模块缓存，避免切项目或更换owner后拒收合法快照；store应用快照selectedTaskKey（含显式取消），后端未带选择字段时保留合法本地选择。真实验收还定位了structuredClone(Vue/Pinia proxy)失败后fallback丢task type/status/title的问题，现与nodeGraphReviewService共用utils/cloneWebDto.js的递归toRaw+structuredClone，保留嵌套类型及克隆隔离，无JSON通信回退。

三批红证据及修复见本地计划；最终769 JS、定向lint、Vite通过，版本/真实临时工作区18项通过（1条既有插件warning）。Conan76599完整exit0，frontend SHA256=93e36d5a3c06c4da49fe705b950eb015dff37ca3c306b2569b3754867d1e418e，exe仍db68ce73…。独立真实assistant78571完整exit0（web-opt-assistant-reactive-packaged.log，run-4jljrwag）：4文档初始hydrate、聊天Vue选择/取消双向同步、晚加入hydrate、MainPage真实路由重挂且3存活Dock tabId不变均通过；主storage写拒绝5次仍同步，peers安装guard后的活动阶段读写0。cleanup_ok=true、Optics failures=[]。

九套packaged all69843已完整exit0（web-opt-assistant-reactive-packaged-all.log）：focus/environment/graph/properties/panels全部11面板/creation/picker/calibration/assistant均通过，2 HWND实际最小化恢复、图保存关闭/失败重试、标定及助手主视图重挂执行；助手存活tabId30/31/32，storage写拒绝4次仍同步，peer活动读写0；cleanup_ok=true、Optics failures=[]。无存活构建/测试会话。上述助手证据不覆盖启动恢复、首await卸载/迟到回复及native generation变化后的存活Dock恢复；同generation替换owner消息层回归也不代表完整Vue/store接受较旧owner业务时间已验收。其余视图竞态与LANChat完整多实例仍开放。历史段落的“当前”仅对应当时批次，以本节和引擎本地计划页首为准。

日期：2026-11-06；状态核查：2026-11-08。状态：具名 Web 入口与四族渲染设置 owned 值链已迁移；完整最新运行验收仍待完成。

当前任务清单及逐项证据见引擎本地 `docs/superpowers/plans/2026-11-06-web-consolidation-plan.md`；
同目录 `2026-11-06-web-api-inventory.md/json` 保存原清单基线和当前权限。文档均仅本地。

## 最新：Windows资源发布及新配对验收（2026-11-08）

当前Engine961d65ca / Editor及pin b703fe9，未push。前两次真实WinError5失败保留；真实Windows文件句柄测试确认，staging资源被不允许删除共享的读取者打开时，父目录rename失败。旧实现红测试失败后，assets._install_bundle对Windows5/32仅重试原子rename，最多6次/总退避310ms，其他错误不重试；持续占用仍失败、manifest不变、临时目录被清理。9项定向与35项完整archive测试通过，版本/工作区18项通过。实际引擎故障中的占用进程身份尚未确认，不假称已识别防病毒软件。

Conan部署37711完整exit0（web-opt-asset-publication-editor-deploy.log），Vite/依赖配置完成，部署assets.py与源码SHA256均440bf557415e0dddf4ee1b844cd1bcba6076ded1543a5abc46337aee5d50ab9a；exe仍db68ce73…、frontend仍2140f286…。临时诊断sitecustomize及pyc已移除，无插桩packaged all22216完整exit0（web-opt-asset-publication-packaged-all.log；run-i7e59m3_），八套含11面板/2 HWND实际最小化恢复/图保存关闭与标定重挂全部通过，cleanup_ok=true、Optics failures=[]。新配对CEF74547完整exit0（web-opt-asset-publication-native-cef.log / web-opt-asset-publication-native-cef-result.json），全部业务断言通过，53699ms正常exit0，passed/cleanup_ok/graceful_exit均true；禁应用JSON的消息/具名V8、导入重绑定、并发GPU拾取、Python输入/截图/归档替换已复验。助手/其余生命周期/LANChat完整业务验收仍未完成，整体计划继续实施。

## 最新：原生退出资源生命周期（2026-11-08）

Engine本地HEAD 6d09941a（生产51a39d5c、探针6d09941a）/ Editor及pin8728482，未push。真实CEF54541的退出栈定位后，新增生产GpuSkinningPipeline双线程warmup/线程退出/丢弃未消费future回归，旧实现SegFault（web-opt-prepared-skinning-concurrent.log，18.15秒）。引擎make_compute_pipeline现让编译对象持有对应Slang global session，保证模块先于父session销毁；没有修改Horizon。修复后新探针及相邻两项IK最终3/3通过（web-opt-prepared-compute-related-green.log）；先前未构建IK导致Not Run的记录保留。Conan主引擎7312完整exit0（web-opt-prepared-compute-engine-build.log），exe=db68ce733d57aa92fcc3b4c24b80bad06a4137aabae5813f49ba861aea59aa08，frontend不变。CEF72658因重绑定后异步GPU上传尚未完成而在树loaded立即断言失败，引擎仍正常exit0；探针改为等待同Actor实际loaded，原有身份/字段断言保留。CEF65244已完整exit0（web-opt-prepared-compute-native-cef-ready.log / web-opt-prepared-compute-native-cef-ready-result.json），所有业务断言通过，57093ms正常exit0，passed/cleanup_ok/graceful_exit均true，hash对应新exe。

新exe packaged all87202与独立重跑均在fixture创建Actor时失败：_stage_bundle的临时目录rename到Assets/Models报WinError5，八套UI未执行；两次cleanup_ok=true、Optics failures=[]。证据web-opt-prepared-compute-packaged-all.log（run-05bucw21）、web-opt-prepared-compute-packaged-all-retry.log（run-xj10wis_）。同一源模型及生产_stage_bundle在独立Conda Python进程成功，嵌入式运行时/并发文件句柄差异仍待定位，不归咎于未经证明的防病毒软件。旧exe八套绿色不能代替新exe验收，当前完整计划仍未完成。

## 最新：标定文档生命周期与 owner 版本（2026-11-08）

当前本地 Engine c3e424ca / Editor 8728482，pin 对齐，未 push。webMessages 只读公开已有 ownerEpoch，并在 topic 上下文提供 envelope 的 ownerEpoch；标定只接收当前 main 事件，替换 owner 后重新接受其版本序列，主 owner 启动发布当前快照。同一文档 MainPage 重挂沿用领域 WeakMap 中的权威活动状态与 revision，storage 只作新文档 startup seed；dispose 仍释放订阅，不另建消息/状态框架。

762 项 JS、定向 lint/Vite、版本配置 16 项通过，owner 替换/来源/重挂回归均先红后绿。真实旧部署 69941 失败（web-opt-calibration-remount-packaged-red.log，run-8tktdj3b）：storage 不可用时主视图真实路由卸载/重挂，新 Dock 实际读默认值，丢失活动值。新 Editor Conan 部署 13630 完整 exit0，frontend SHA256=2140f286c3a66950336301608d2c7173d291d76b2b33f4f839852d37f92499fd；69372 真实 calibration 完整 exit0（web-opt-calibration-owner-packaged-green.log，run-kgqxxqku）：主视图真实路由重挂后新 Dock 保留活动值，旧 Dock 后续编辑同步，两个存活 tabId=4/5 保持，cleanup_ok=true、Optics 失败0。同 generation owner 替换已有真实 Node BroadcastChannel 回归，不冒充 native generation 变化后旧 Dock 自动重绑。

完整 all 46420 仍失败（web-opt-calibration-owner-packaged-all.log，run-9fy2qt0h）：前四套通过，FileManager 已挂载且 CEF 可读，但实际标题为“文件管理器”的 HWND 等待30秒仍 hidden；不能记完整绿色。原生首帧问题及助手跨 owner、其余生命周期/LANChat 未完成项继续开放，详见本地计划。

原生后续 c3e424ca 已定位 UIFrameCommandChannel 的整帧 LatestWins 覆盖会丢掉仅首帧携带的 first_present_ticket。真实缓冲+生命周期回归先红，修复同图像合并保留回执后 UiSurfaceLifecycle/CommandBuffer/PublishedImage 三项通过（web-opt-ui-first-present-green.log）；未改 ImGui/Horizon。Conan 主引擎97832 完整 exit0，新 exe SHA256=8d9321f470ed5533e8d46074641d19e818bd1aa046f3cf41ea525135249f3568；真实 all5182 完整 exit0（web-opt-ui-first-present-packaged-all.log，run-roe40zyn），八套含11面板/2 HWND最小化恢复/标定重挂通过，cleanup_ok=true、Optics失败0。修复前 all46420 的隐藏 HWND 失败保留；额外独立 panels80683 已完整 exit0（web-opt-ui-first-present-panels-recheck.log，run-p0lr1ew5），全部11面板/真实2 HWND最小化恢复通过，cleanup_ok=true、Optics失败0。

新的 CEF 正常退出复验仍失败：63576 并发 GPU pick 第二项超时，但引擎正常退出；原参数重跑54541全部业务断言通过（含并发拾取/Python输入/截图/归档替换），请求关闭后却以0xC0000005退出（web-opt-ui-first-present-native-cef-retry.log），没有成功result.json，不能记为完整通过。同构建PDB还原退出栈为 MechanicsSystem::shutdown 清理异步 GpuSkinningPipeline 结果，经 VulkanComputePipeline/ComputePipelineShaders 进入 EmbeddedShader::ShaderCodeCompiler 析构；runtime/logs/2026-11-08_02-32-45_corona.log 中 CEF 已完成关闭。具体根因和修复尚未闭环，不修改Horizon。助手跨owner/恢复、其他视图竞态及LANChat完整业务仍待验收，整体计划未完成。

## 最新：助手订阅退休及标定真实验收（2026-11-08）

本地 Engine 759d55a7 / Editor 2ca407b，pin 对齐，未 push。助手上下文初始读取在取消订阅后仍通知旧视图并写缓存的缺口已由公共 BroadcastChannel 屏障回归先红后绿修复；disposer 幂等，退休后 accept 不写状态、不通知。758 项 JS、定向 lint、Vite 及版本配置 16 项通过。消息层回归不等于助手真实 Vue/跨 owner 验收。

真实 packaged calibration 25495 完整 exit0（web-opt-calibration-packaged-stereo.log，run-raxet0r3）：主页面重载恢复标定 seed，真实 EditorSettings 切换 3D UI 打开标定，两个 Dock Vue 输入双向同步、第三个迟开 Dock hydrate 最新内存值；主存储写入 5 次被拒仍同步，三个 peer 存储读写均 0，cleanup_ok=true、Optics 失败 0。该次使用 Editor 4de414d 部署（标定代码未变）。2ca407b Conan 部署 61749 已完整 exit0（web-opt-assistant-retirement-editor-deploy.log），无锁不一致；frontend SHA256=4147e3a1b6b1b738aad25a9299e65e0f21f2b77f7082665b0aab170cbd8ef849；最新 all 64026 完整 exit0（web-opt-assistant-calibration-packaged-all.log，run-30kjuqff/result.json），八套含全部 11 面板和新增 calibration 通过、cleanup_ok=true、Optics 失败 0。新部署复验通过上述标定行为。主重载发生在 peers 创建前，不扩大为 owner 替换后存活 peers 的恢复。助手跨 owner、其余视图竞态、完整 LANChat 业务和原生首帧显示间歇失败仍开放。

## 当前实现边界

- Web间唯一消息owner是 `api/webMessages.js`，用BroadcastChannel和结构化克隆；现Dock设计保留。
- Web/C++仅用 `window.corona` 下具名绑定：app、window、project、files、projectSettings、projectFiles、scene、audio、viewport、input、scripts、network、lanChat。editorApi仅转发领域调用，场景观察由Web的sceneReader采样。
- `corona.editor`、Bridge、listMethods/listEvents、通用native on/off和manifest/schema/timeout层已删除；`editorApi.off`只清理Web场景观察token。窗口和LANChat事件返回原生同步disposer，由viewLifetime拥有。
- V8 入口传输对象、数组、标量及约定二进制。PT/ReSTIR/ReBLUR/ReLAX 的具名入口、命令队列、requested/effective 状态及渲染消费者已改为 owned 对象，独立旧 string API 仅在其边界适配。底层网络包、资源/存档格式和独立 Python 接口保留自己的格式。
- 此前批次Engine 9e11e072 / Editor a129ddf（当前配对与最新验收以下方2026-11-08节为准）。Conan examples75292完整exit0，exe SHA256=c4e2792276596549715b614bb09ff736581026c63a717bfaa73898510ce2dbe4。真实CEF59789完整exit0、graceful_exit=true：全部业务断言完成且引擎正常exit0，无强制终止（build/web-opt-ui-stop-graceful-native-cef.log）。Mechanics/Optics快照与UI停止顺序已按功能本地提交；音频owner消费/字段合并、原生identity及此前完整GPU回归通过。packaged七套all78194完整通过；双实例首轮CDP超时后原脚本19835通过（未改断言）；Blockly60355与Archive69652真实业务探针通过。Native-file曾在96066失败于Scripts.stop的Python runtime 2秒超时；09cb6e34修复Native派发锁交接，真实Registry/Coordinator双竞态回归2/2通过，最新静态宿主61241完整通过三次Native运行/输入/停止恢复及13项目文件不变。scene-pull95362完整通过，资源导入/取消、45骨骼IK、997Hz输出loopback74186和正式runner62980均通过。正式业务runner已提交9e11e072。上述主exe c4e279仍不含Native派发修复，最新Conan examples7060仍复制Python runtime，完整构建及部署后真实CEF复验尚待完成。图保存中关闭/失败重试、生命周期竞态、标定/助手跨owner恢复及LANChat完整重连多实例等仍待验收。全部文档仅本地，代码不推送。

## 生产NodeGraphPanel路径补正（2026-11-08，真实菜单与初始化卸载验收通过）

上一批a378d80和59108使用自建NodeGraph ID，未覆盖注册表真实NodeGraphPanel。生产ID红测试60062明确复现保存前关闭；nativePanelHosts关闭失败提前丢弃宿主、导致重开重复create的两种时序也先红。Editor 4de414d已修正ID并保留失败宿主；56项相关JS、定向lint/Vite通过。探针现走Pinia菜单，并补初始化读取/迟到订阅期间真实Vue卸载及三次重挂；Conan Editor部署16496完整exit0；当前配对Engine 13f097ea / Editor 4de414d。最终packaged all54857完整exit0（web-opt-graph-production-lifecycle-final.log，run-9k54_elr），七套含全部11面板通过、cleanup_ok=true、Optics失败0。真实菜单图保存失败后重试复用原文档、最新编辑重开；三轮初始化原生读取/迟到Web场景订阅期间Vue卸载，六个token各释放一次、九个ResizeObserver全部断开、过期恢复未触发图load/Actor树读取，最后正常重挂且tabId保持。

当前部署主exe SHA256=0951cdd026acc8df7a7a14c7b3938cf64e513f448776e37a56eca8a63a7b0f7a，frontend=cf802db6fea3857de00fa651d6397a1ae8f129ede7af8be66b32e90c9caf8a69。本批未改C++/SDL/ImGui。中间all76000、panels19231及17028曾因第二个可见HWND缺失失败，17028实际等待30秒仍未出现；64564与最终54857的真实2 HWND最小化/恢复通过。该原生首帧可见性间歇问题保持开放；新探针等待实际可见窗口并增加诊断，没有降低窗口数要求。生命周期证据限于同一Dock内真实Vue初始化卸载，不替代所有视图/快速切世界及其余网络验收。

## 2026-11-08 图关闭保存屏障验收

- Editor a378d80 / Engine 48833cba，pin对齐。普通NodeGraph关闭现在复用现有Web图保存协调器；保存失败保留窗口可显式重试，迟到保存结果不能再次关闭已退休窗口。相关44项JS、定向lint及Vite通过。
- 真实旧版23035红测试失败于保存前Dock关闭；新部署59108通过保存等待、排队编辑、注入失败后保留窗口/编辑且不自动重试、显式重试、V8保存后关闭并重开保持最新节点x=158。日志web-opt-graph-close-packaged-red.log / web-opt-graph-close-packaged-green.log，cleanup_ok=true，Optics失败0。失败注入是Web facade Promise，不等于真实磁盘故障。
- 主引擎Conan构建7060及Editor部署54119均完整exit0。主exe SHA256=0951cdd026acc8df7a7a14c7b3938cf64e513f448776e37a56eca8a63a7b0f7a，包含Native派发修复；frontend SHA256=2b4e939c8ba5dc5983fc5c4fba07ffede12100fcb804d7602c8ce1588cbe6609。完整CEF9870完整exit0（web-opt-graph-close-final-native-cef.log / web-opt-graph-close-final-native-cef-result.json），passed/cleanup_ok/graceful_exit均true，应用JSON编解码禁用下的消息/V8/原生生命周期与业务断言通过；整体计划仍实施中。

## 当前残留 JSON 的边界（2026-11-07 审计）

- `cef_v8_binding.cpp` 未发现 dump/parse 字符串适配。`editorApi.js` 不负责 JSON 编解码、manifest 查找或动态方法生成。
- `cef_editor_native_api_handlers.cpp` 中 LANChat 的 `metadata_json` 在网络/历史 owner 与具名 Web snapshot 之间投影为对象；Web 不解析该字符串。旧 Python/native 消费者的 metadata_json 字段继续保留。
- 同文件 `get_editor_scene_snapshot_from_python`、Actor/transform/camera 的 string API 和旧 manifest handlers 为独立非 Web 适配；CEF 权限关闭且通用 Web endpoint 删除，不可据函数名判断为当前 Web 通路。
- 联机 Actor 广播的 `actor_data.dump()` 属于网络协议。AI provider 的 JSON 编解码属于 HTTP/SSE、模型输出；上下文持久化属于存储，不作为 Web 消息回退。
- 场景归档载入的 `apply_native_scene_environment` 仍将 authored_lighting 对象编码给独立 legacy `Environment::set_authored_lighting`，后者解析后存为 shared owned 对象。这是已存在的归档载入内部转换，不在四族设置的具名 Web patch 通路内；本轮没有改动它，也不宣称整个引擎已无 JSON 字符串。
- 本节是源码边界审计，不能代替禁止 JSON.parse/stringify 的真实 CEF 通信运行证据；最新版该验收仍待部署结束。

## 目标规则

沿用当前 Dock 设计，不再按 SDL + CEF 与 ImGui 区分 Dock。
页面协作走 Web 消息模块；创建、分离、重新停靠、缩放、焦点、关闭等
原生操作走 V8 → C++，保留现有布局和窗口行为。

1. 页面间通信归 `src/api/webMessages.js`，底层只用 BroadcastChannel；
   业务不建私有频道，不经 C++ 广播，不复制 pending/retry/response 协议。
2. 主页面、停靠 Dock、独立 Dock、CameraView 共享启动 scope，拥有不同 documentId；
   主页面重建和世界切换废弃旧消息。请求定向，广播显式声明。
3. Web/C++ 只用原生注入的 window.corona V8 绑定；
   editorApi 仅引用原生函数及处理业务默认值，不拥有第二套 transport。
4. 通信数据为对象/数组/标量或约定二进制；不用 JSON 字符串 envelope、
   JSON 深复制、cefQuery、脚本拼接或字符串回调。
5. 引擎对象用不透明 ID 和快照访问；原生窗口仍由 C++ 管理，
   创建/关闭/停靠及真实生命周期事件走 V8。
6. 存储、配置和 HTTP 的 JSON 不在禁止范围；
   持久化不得充当页面活动消息的字符串回退通道。

## 唯一 owner

| 能力 | 最终 owner | 业务保留的职责 |
| --- | --- | --- |
| Web 消息/请求响应 | 已新增 api/webMessages.js | topic/method、领域快照和副作用 |
| 原生方法/事件 | C++ 唯一 V8 绑定，前端引用原生对象 | 编排和业务默认值，不复制协议 |
| 相机/视口 UI | 主页面领域服务 | 验证绑定、执行动作、发布快照 |
| AI runtime | 主页面 AI session | 模型请求、取消、设置，不拥有频道 |
| Dock UI 意图 | Web 窗口会话服务 | 面板记录、请求原生操作 |
| 原生窗口/引擎事实 | C++ | V8 报告实际结果，Web 不冒充完成 |

## 早期迁移记录（历史基线，当前状态以上节为准）

- api/editorApi.js：未迁移 manifest 仍保留其既有 adapter；已迁移的 viewport/pick/input 直接引用 V8，不再保留输入 JSON/alias。
- scene.readActive / scene.selectActor / scene.setActorTransform / scene.setActorProperties / scene.getEnvironment / scene.setEnvironment / scene.focusActor / scene.captureScreenshot / scene.setCameraProperties / scene.createCamera 已引用直接 corona.scene V8 方法，返回领域值；viewport.configure 合并边界、模式、光场标定和指针/系统光标，viewport.pick 是唯一拾取 Promise，input.dispatch 是唯一 Web 输入 Promise。旧对应 CEF/Fast 路由删除，无别名或回退。未迁移领域仍经显式 manifest adapter；当前处置状态以上述逐项清单为准。
- utils/eventBus.js：页面内事件适配及公共 Web 消息订阅；__coronaEmit/_fromCross 已删除。
- services/appService.js、editorWindowSession.js：页面广播走公共 Web 模块；窗口读写、面板创建、关闭、聚焦、detach/redock、相机窗口控制/关闭和 suspend 屏障、关闭请求和真实关闭事件已走直接 V8。相机窗口创建也已迁移，DockCommand 已删除；活动 storage 协调待迁移。
- creativePanelState.js、cabbageGuidanceService.js：使用公共 handle/request，已删除本地写旁路、自有请求匹配/接受通知和重试。nodeGraphRuntimeService 与无调用方协议已删除。世界切换 graph 保存已改为 nodeGraphSaves + 公共 requestAll，旧全局 flusher 已删除；原生图持久化仍待迁移。
- aiSessionService.js、cabbageAssistantContextService.js、cabbageTutorialSessionService.js、
  nodeGraphReviewService.js、blockly/node-editor/aiNodeGraphService.js：私有频道已移除，需补打包 Vue/世界切换/多窗口验收。
- api/sceneReader.js：取消一次性结果轮询，轻量场景采样保持独立语义。
- utils/viewport*.js 和页面 Fast 调用：迁入唯一 V8 契约。

现有 BOUNDARY 中的 cefQuery/manifest transport/Fast adapter 是迁移基线，
不是新增旧通道的许可。阶段内可保留未迁移功能，同一操作不允许新旧双发。

## 验收

- Web 单元测试覆盖 scope、定向、广播、超时、取消、重建和清理。
- 打包 CEF 验证四类文档互通和启动实例隔离，不只依靠 mock。
- 业务不再构造 BroadcastChannel，不经原生转发 Web 消息。
- V8 保留 caller 权限、版本、错误、输入和视口结果语义。
- context 关闭/刷新不调用旧回调，世界切换不执行旧请求。
- JS/Python 边界测试、前端构建和引擎多窗口回归有记录。

## 本轮实现与验证

- 已创建 webMessages.js，scope、documentId、owner epoch、world generation、定向/广播、请求、超时、取消等待与清理归该模块。页面刷新生成新 documentId。
- `appService.getCurrentWindow()`、`setDragRegions()`、`setCurrentTabDragRegions()` 直接调用原生 `corona.window`，项目兼容 facade 共享同一业务方法。
- 原生 `getCurrent()`、`setDragRegions(regions)` 已在真实 CEF 的主页面、停靠 Dock、独立 Dock 中验证。测试禁用页面 JSON 编解码后执行读写，并验证窗口隔离、错误和刷新后的绑定。
- 已删除 setDragRegions、broadcast、closeThisTab、closePanelTab、focusPanelTab 的旧 DockCommand 分支及窗口脚本广播、__coronaEmit/_fromCross。其余 manifest/Fast/Dock 路径仍待迁移。
- 修正 Web 离开通知失败中断清理，以及节点图状态/保存消息的本地双重投递。
- 2026-11-05：JS 462/462、Python 58/58；修改文件 ESLint 0 errors / 3 warnings；前端 production build 成功。全量 lint 仍有未修改文件中的 11 errors，未记为通过。
- 引擎侧 CEF 启动/关闭测试 3/3 与真实三窗口 smoke 1/1 通过。CameraView、最小化、双启动及完整打包 Vue 协作尚未验证。

本文件与引擎中的架构、实施文档均只保留本地，不提交或推送远端。

### 2026-11-06 整体优化首批状态

- Editor 本地提交 1c14640 / 11526b0 / 6a1ca67：移除动态缺省 Proxy、五个失效事件、重复 editor namespace、五个无生产调用门面及旧 coronaBridge 允许名单。未迁移 manifest 的领域实现继续保留，不宣称全部 typed 化。
- Editor 90c6728 与引擎 55f2eb26：相机属性 patch 不接受 view_open，保存设置不再开关窗口；窗口 owner 发布每相机状态。scene.createCamera 只创建场景对象，window.createCameraView 才创建表面；旧三个 CEF 方法关闭，独立 Python 契约保留。
- Editor 0856972 / 441152c：viewportCalibrationService 的主文档实例持有活动值和 revision；新 Dock 请求初始快照，所有视图直接应用消息载荷。存储只提供启动偏好；单个视图监听器异常不会拒绝已接受更新或阻断其他监听器。助手上下文 owner 迁移仍未实施。
- 验证：JS 580/580、Frontend Python 64/64、原生旧接口 source guard 12/12；标定定向 19/19；定向 lint 与生产前端构建成功。Conan tests 构建成功，CameraWindowIdentityTests 通过。
- Editor 5516f68：App 的项目和 LAN 订阅复用 viewLifetime，迟到注册立即释放，卸载后回调不再发起元信息读取。迟到的禁用策略不能关闭已退休 App 的窗口，保留 refresh/preparation revision。
- 最新验证：JS 582/582、Frontend Python 64/64；App 定向 12/12、定向 lint 和生产构建通过。NodeGraphWorkspace 的公共生命周期迁移尚未实施。
- 引擎 7d6ccdc4 将 Editor pin 对齐本地 5516f68。旧基线 Conan 构建已退出 0，但不含新相机原生改动；最新引擎正在构建，部署、实际 CEF smoke、packaged Vue 以及完整 OS/双实例验收尚未完成。
- 文档全部留本地，代码仅本地提交，无推送。Horizon 自动补丁沿用既有 Conan 流程，不作为阻塞，不主动修改 Horizon 业务代码或向其提交。


### 2026-11-05 续批验证

- Web 请求发现/执行使用独立期限；旧 owner 的迟到事件/能力宣告不能覆盖新主页面。异步订阅错误统一收集。
- 创作面板和引导共用公共请求生命周期；引导旧 relay 与孤立节点图 runtime 协议已删除。保留实际本地运行和在用的世界切换保存路径。
- 新原生 close()/closeTab()/focusTab() 返回 Promise boolean；onClosed/onCloseRequested 返回幂等 unsubscribe。主页面管理其他原生 tab，子页面只能关闭自己；close() 在 Promise 完成后才入队退休。
- UI 仅在原生 remove_tab 完成后接收真实 tabId/panelId；已删除提前发布的 Web panel-closed。原生订阅异常隔离，context 释放清理。
- JS 473/473、Python 60/60；修改文件 lint 0 errors / 4 warnings；Conan 引擎和运行目录前端构建成功；CEF 生命周期 3/3、真实窗口通信 smoke 1/1 通过。
- 全量 lint 的既存未修改文件错误未修复；CameraView 场景、最小化和双引擎实例及完整打包 Vue 协作仍待验收。
- 引擎本地 docs/architecture/web-communication-inventory.md 列出当前 176 项 manifest 方法、18 项事件及剩余旧入口，不将静态枚举当成运行等价证明。


### 2026-11-05 窗口续批

- 面板创建、detach/redock、相机窗口关闭与 suspend、相机窗口最大化/模式/无边框/尺寸以及主窗口无边框均已接入同一 corona.window 直接 V8 对象；createCameraView 是唯一剩余 DockCommand。未知窗口操作直接拒绝，已迁移方法无旧 Bridge 回退。
- 创建保留原有 Dock 几何和状态机。快照 dockState 取原生状态，detached 不再从 host_surface 推断。真实 CEF 验证 redock → detach → 拒绝重复 detach → redock，未修改 Dock 实现。
- suspend 保留两次主线程调度；并发读取与屏障响应顺序已验证为 before、after、barrier。窗口会话活动 storage、真实 archive-session graph 保存仍待迁移。
- JS 476/476、Python 60/60；修改文件 lint 0 errors / 4 既有 warnings；Conan 引擎和部署前端 production build 成功。空场景仅验证相机控制的参数和隔离，真实 CameraView 正向流程仍待补齐。
- 已更新引擎本地通信清单与迁移计划；本批所有文档仍只保留本地，未暂存、提交或推送。

最终 CEF 合并复核 4/4 passed（启动、两项关闭生命周期、真实多窗口通信）；最新引擎和 CEF 测试目标均已重新编译。真实场景相机、最小化和双启动等剩余项保持未验收状态。


### 2026-11-05 相机创建与旧 Dock 通道移除

- 所有原生窗口操作均已迁入直接 `corona.window`。`createCameraView` 使用 archiveSession/sceneId/cameraId，由 CEF UI 场景 owner 解析原生句柄并由主线程持租约创建；不接受 Web handle。存档切换/场景重载/相机删除使旧排队请求失效。
- 独立 SceneTools Dock 仍可创建相机窗口，沿用现有窗口状态机。返回真实 `{tab_id,existing}`，位置 0 得以保留。
- 已整体删除 DockCommand、dockCommand、Bridge.callDockCommand、__dockCallback 和旧超时/迟到回调通道。项目切换、App 会话清理改为检查新的 V8 接口；没有旧入口回退。
- JS 470/470、Python 60/60；修改文件 lint 0 errors / 4 既有 warnings。旧通道专属用例移除，活跃的并发退休/失败重试/跨世界清理回归保留。Conan 引擎与部署前端构建成功。
- 原生身份/租约测试通过。真实 CEF 已用测试专用场景验证相机创建/重复创建、窗口控制、关闭/重建/suspend、旧存档拒绝，以及主页面/相机文档双向 typed-array 消息；窗口调用禁用页面 JSON 编解码。场景准备仍走未迁移 manifest，打包 Vue CameraView UI 等验收仍未完成。
- 176 项 manifest、18 项事件、Fast、活动 storage 与 graph 保存仍在计划中；整体目标保持进行中。完整终态测试日志见引擎本地迁移计划。

本批未暂存、提交或推送任何文件，文档继续只留本地。

本批终态合并复核 5/5 passed：CEF 启动、两项关闭生命周期、相机身份/租约及真实多窗口/相机 smoke（20.38 秒）。测试从独立 SceneTools Dock 创建实际相机，保留原有创建调用方。10 份本地文档链接/围栏及两个工作区 diff 检查通过，暂存区为空。

### 2026-11-05 世界切换节点图保存（历史记录）

- 公共 requestAll 发现当前 generation/epoch 的 handler 后，每个文档各定向请求一次并等待全部结果；超时、取消、退出与远端错误归公共模块，没有广播副作用、首个响应完成或自动重试。
- nodeGraphSaves 按原生 archive session 保存各文档的 workspace。一个文档只有一个领域 handler，卸载与远程 flush 共享在途保存；失败保留图闭包，显式重试成功后删除，未加载图不留虚假 handler。
- editorWindowSession.beforeRetire 在图保存及 native scope 复核完成后才回收原生窗口。App watcher 与 launcher 共享退休/保存 Promise；UI 禁用保留旧消息 generation，重新启用才换代。
- 已删除旧全局 __coronaNodeGraphFlushers / __coronaNodeGraphFlushSave、launcher 捕获和 pendingWorldSaves。原生 readActive / saveBlocklyTarget 仍为未迁移 manifest，图存储未被宣称零 JSON。
- JS 483/483、Python 60/60；修改文件 lint 0 errors / 4 既有 warnings；Conan 引擎与部署前端 production build 成功。CEF 合并 5/5，通过禁用页面 JSON 的真实主页面/停靠 Dock/独立 Dock 图保存协调、失败重试及相机生命周期。
- 完整打包 Vue 节点图/CameraView UI、OS 关闭按钮、最小化和双实例仍待验收；活动 storage、176 项 manifest、18 项事件与 Fast 仍待迁移。完整证据见引擎本地迁移计划。

本批文档仍全部本地保存，未暂存、提交或推送任何文件。

### 2026-11-05 场景读取与 Actor 选择（历史记录）

- `editorApi.scene.readActive()` 和 `scene.selectActor(...)` 直接调用同一 `window.corona.scene` V8 绑定，不经 manifest、JSON、旧入口或 transport data 包装。场景 owner 与 renderer 间传 typed DTO，原生 selection 也改为 typed 状态。
- tree_revision 与 selection.source_camera_handle 为十进制字符串。CameraView 传递 native opaque_handle，选择归属不再用 Number 比较；Fast 拾取的 numeric handle 尚待迁移。
- selectActor 捕获该 context 最近 readActive 观察的 archive session，在原生 owner 校验后才修改；未读取或存档已替换时拒绝。刷新必须先读取，旧存档选择不重试；Actor GUID 由原生确定。
- 旧 read_active_scene/select_actor CEF 路由返回 403，JS wrapper 清空。原有非 Web caller adapter 保留，不提供 Web 兼容回退。图保存协调的 active scope 读取已走 V8；图存储仍为待迁移 manifest。
- 当前 176 项 manifest 中 173 项仍允许 CEF、3 项仅非 Web；本批迁移 2 项，Scripts.run_path 原本即 Native-only。历史“176 项剩余 Web 方法”是统计口径混用，现已纠正。18 项事件、Fast 和活动 storage 仍待迁移。
- JS 486/486、Python 61/61；修改/新增文件 lint 0 errors / 8 既有 warnings；Conan 引擎及部署前端构建成功。CTest 6/6，含真实 CEF 禁用页面 JSON 后的场景读取/选择、大 ID、旧存档拒绝与重新读取成功，以及既有图保存/窗口/相机回归。
- 4 个相关集成脚本已更新 V8 调用并通过语法检查，完整 UI 工作流本批未运行；打包 Vue、OS 关闭按钮、最小化、双引擎验收仍未完成。日志详见引擎本地迁移计划。

本批文档仅保留本地；整体迁移继续进行，不将本批测试作为全部旧实现已清理的证明。

### 2026-11-05 Actor 变换合并（续批前记录）

- `scene.setActorTransform` 引用直接 `corona.scene.setActorTransform`，patch 统一支持 position/rotation/scale 局部更新，必须携带 archive_session；返回原生实际变换、Actor 身份与版本。旧 Fast 数字 operation、coronaBridge.actorTransform、消息生产者/消费者删除，旧 CEF manifest 路由拒绝，无兼容回退。
- 原生写操作统一更新权威 Actor 与 geometry，每次成功 patch 只增加一次 Actor 版本；参数整体校验，混合无效字段不部分写入。非 Web adapter 共享同一原生操作，读取采样及通知行为保留。Object 面板移除无效 persist 参数。
- 当前仍有 152 项旧 Web manifest、20 项非 Web 保留契约、15 项事件及 2 种 Fast 消息；整体目标未完成。重复属性、聚焦、环境和输入接口继续按实际语义合并。
- JS 488/488、Python 62/62，修改/新增文件 lint 0 errors / 8 既有 warnings；Conan 引擎及部署前端构建成功；最终 CTest 6/6，真实 CEF 在禁用页面 JSON 后验证变换、版本、局部字段保留、无效/旧归档拒绝和旧入口移除，保留已有窗口/相机/节点图回归。
- 额外打包 Vue 双 Object 面板 + Python 读取工作流尚未通过：独立面板世界与策略 ready/enabled、DOM 为空，留待 App 初始化/活动会话协调核查，不能记为通过。OS 关闭按钮、最小化、双引擎、CameraView/图保存完整 UI 验收仍待完成。

本批文档仍只保留本地；完整日志及未通过项见引擎迁移计划。

### 2026-11-05 重复通道清理与独立面板初始化（历史记录）

- 删除无生产调用方的 `coronaBridge.setProperty`、PropertyFast 消息生产/消费和专用 handle 辅助函数。现有具名 physics/state 操作继续保留，尚未迁入 V8；不新增数字属性枚举入口或兼容别名。剩余 Fast 从 13 降为 12，旧 Web manifest 仍为 172，非 Web 契约 4、事件 18。
- App 初始项目采样不再无条件 force 读取。路由守卫和项目观察共享在途元数据读取；具名项目观察收紧同次读取的路径校验，任一项目不匹配都拒绝。显式同路径重新打开仍强制新读取，旧成功/失败不能覆盖新归档。
- 新增真实 App setup + Vue Router 回归，覆盖两种启动顺序；另测共享读取的路径不匹配和强制同路径重开。全量 JS 492/492、Python 边界及原生源检查合计 63/63。
- 打包 Vue 双 Object + Python 全流程已通过，替代上节的空白面板待查状态：隐藏时零采样/零旧事件；恢复后两窗及 Python 同读新位置；停止恢复、脚本全局隔离、跨窗口保存及重开读回均通过。测试使用 visibilitychange 模拟隐藏，不使用会永久退休消息模块的 pagehide；不将其当作 OS 最小化验收。
- Conan 引擎与部署前端构建成功；本批 CEF、lint 与本地证据详见引擎迁移计划。CameraView/节点图完整 UI、OS 关闭按钮/最小化/双引擎及剩余旧通信仍待完成。

所有文档继续仅本地保存，没有暂存、提交或推送。

### 2026-11-05 Actor 属性接口合并与多窗口完整保存（历史记录）

- 原 setActorState、setActorPhysics、setActorCameraLock 合并为唯一 `scene.setActorProperties(scene,actor,patch)`，sceneService、Object、SceneBar 全部改为具名局部 patch。三个旧 Web wrapper 与 CEF caller 移除，不保留 alias/回退。Web 与 C++ 间只传 typed DTO/V8 值；非 Web adapter 保留原 caller 范围并共享同一属性写操作。
- patch 必须包含 archive_session，支持 visible/follow_camera、mechanics、camera_lock、animation_sources。整体验证后写入，一次成功 patch 只更新一次 Actor/tree revision；省略字段保留，false 有效。动画源请求保持异步，返回 requested_animation_sources 不表示加载完成。详细字段见 api/BOUNDARY.md 与引擎架构文档。
- 删除 Python 停止恢复专用逐字段 operation 分发，使用快照中准确的 body_type 与一份 mechanics patch；不再发送原生一直忽略的 collision_type，也不通过 physics_enabled 丢失 kinematic/phantom。
- 公共 requestAll 记录已知参与文档的 generation/epoch，必须收到本次发现确认再发送各定向操作；慢响应不再被 50 毫秒收集窗口静默漏掉。已知参与者失联、退出或替换明确报错；发现失败不开始部分保存，无副作用重试。未知且未公告文档不在该保证内。
- 全量 JS 497/497；前端 Python 边界与脚本运行时专项 113/113（另 164 个未选中，8 个 subtests passed，1 条既有依赖 warning）；修改的消息模块及 CEF smoke lint 无错误/警告。Conan 引擎与部署前端构建成功，最终 CTest 6/6；真实 CEF 包括延迟发现与禁用 JSON 的属性写入。
- 实际部署 Vue 双 Object + Python 工作流通过：页面处理器写入 body_type/mass/follow_camera/linear_lock/camera_lock，暂停零读取/零旧事件，恢复同值、脚本停止恢复与再次运行隔离、跨窗口保存及重开读回均通过。DOM 事件驱动和 visibilitychange 不能代替 OS 关闭/最小化验收。
- 扩大运行历史 SceneTools 插件套件仍有 30 项失败，多为断言已删除的旧 wrapper/AI/图形接口；完整失败证据保留，未声称该套件通过，不恢复旧实现来满足过时断言。
- 当前 manifest 总数 176：旧 Web 169，非 Web 保留 7，事件 18，Fast 12。完整迁移未完成，剩余接口、活动 storage、图存储及完整 CameraView/节点图 UI、OS 关闭/最小化、双引擎隔离仍待实施与验收。

### 2026-11-05 环境接口合并（历史记录）

- 原 get_environment/set_environment/sun_direction/floor_grid/get_physics_params/set_physics_params 六种 Web 入口合并为 `scene.getEnvironment(scene,{archive_session})` / `scene.setEnvironment(scene,patch)`。sun/grid/physics 使用同一局部 patch；六个旧 CEF 路由和 sceneTools facade 移除，非 Web 契约保留原权限和结果形状，共享同一 typed 原生读写操作。
- V8 值直接解析为 owned DTO；执行前校验存档/场景，无 JSON 通信字符串。省略保持、false 有效，无效混合字段先拒绝再写。环境更新保持原 tree revision；authored_lighting 留在资源/存档边界。
- 主页面和独立场景控制/设置页面已迁移；原生光照失败向公共 Web 请求方传播，不再吞掉失败。真实打包 Vue 的三个文档通过生产 DOM 修改光照/网格/物理并保存重开读回，旧 scope 被拒绝，未调用旧环境入口。
- 全量 JS 502/502；Python 专项 155 passed、8 subtests；修改文件 lint 无错误/警告；Conan 引擎与前端部署成功；最终 CTest 6/6，真实 CEF smoke 在页面 JSON 禁用条件下验证 typed 读写与旧入口拒绝。打包 Vue 证据在引擎工作区 build/web-environment-deployed-ui-final.log。
- 当前 manifest 总数 176：旧 Web 163、非 Web 13；事件 18、Fast 12。剩余接口、活动 storage、原生图存储、完整 CameraView/节点图 UI、OS 关闭/最小化和双引擎隔离尚未完成。沿用当前 Dock 设计，文档仅本地保留，未提交或推送。

文档仅保留本地，无暂存、提交或推送；测试与失败日志详见引擎本地迁移计划。

### 2026-11-05 聚焦入口合并（历史记录）

- 唯一 Web 聚焦入口为 `scene.focusActor(scene,actor,cameraId,{archive_session})`，直接 V8/typed DTO 原生应用一次并返回实际姿态。SceneBar 用公共 Web 消息发布 camera-pose-applied；主视口和 CameraView 共享 readAppliedCameraPose 严格检查存档/场景/相机，只同步 UI 并取消旧输入，不再重发相机写。双击只选择一次。
- 删除旧 sceneTools/resourceSearch 聚焦 facade、无人调用的 computeActorFocusPose Fast 与 focusPoseResult 队列/事件/Python 包装。SceneTools 的 Python 契约在原权限内共享原生操作；Web 精确相机 ID，不接受名称或句柄替代。
- 实际部署 Vue 的 SceneBar、主视口、CameraView 已验证聚焦后输入从新姿态继续、无重复写和独立相机不重绑定主视口。全量 JS 509/509、Python 专项 125 passed，另插件专项 5 passed/25 subtests；Conan 引擎及打包成功。lint 无错误，CameraView 有 4 条既有换行 warnings。完整证据与中间失败见引擎本地迁移计划的本批记录。
- 当前 manifest 共 175：旧 Web 161、非 Web 14；事件 17、Fast 11。普通相机输入仍走 CameraMoveFast，截图和其余旧接口待继续核对合并。整体迁移未完成；文档仅本地保留，无暂存、提交或推送。

### 2026-11-06 截图合并与本地代码提交（当前状态）

- `scene.captureScreenshot(scene,cameraId,{archive_session,path?})` 是唯一 Web 截图入口；path 省略时原生选路径并保存，取消返回 canceled。SceneBar 与 CameraView 各只调用一次 V8，不再先查询路径再发保存请求。显式路径为空、含 NUL 或类型错误时拒绝，未知字段拒绝。
- 删除 sceneTools.selectScreenshotPath/saveScreenshot 及无生产调用方的 viewport.capture；三个旧 CEF 路由拒绝。Python 离屏配置捕获和现有相机截图保留不同语义及原权限，内部共享原生保存函数；Web 不通过 Python/JSON adapter。
- 原生执行前复核 archive/scene/camera，模态对话框返回后重新获取场景/相机并复核身份；不改姿态、输出模式或离屏状态。直接 V8 结果为 status/archive_session/scene/camera_id/path，无 transport 包装；失败保留 code，无旧路由重试。
- 全量 JS 511/511（增加 4 项新截图用例，删除 2 项旧 picker transport 用例），Python 专项 111 passed、1 条既有依赖 warning，Conan 引擎与前端打包成功，最终 CTest 6/6。真实 CEF 在页面 JSON 禁用条件下验证实际 PNG 及错误路径；实际打包 Vue 三文档经 Windows 对话框保存两份 PNG 并取消一次，旧截图请求为零，相机姿态和输出模式保持。
- 当前 manifest 共 175：旧 Web 158、非 Web 17；事件 17、Fast 11。其余旧通信、活动 storage、原生图存储和完整运行验收继续推进，整体未完成。
- 用户已要求代码按功能本地提交、不推送。通信基础提交为引擎 70cc3c82 / Editor 878966d；本次截图提交为引擎 e52c448e / Editor d0d048c。所有 Markdown 仍仅工作区保留，四次提交均不含文档，没有推送远端。固定远端工作区锁暂不指向尚未发布的本地提交。


### 2026-11-06 相机姿态与窗口配置收敛（本地交付）

- Web 相机写统一为 `corona.scene.setCameraProperties(scene,cameraId,patch)`，由 editorApi.scene 原样引用。patch 必须含 archive_session，支持 position/forward/world_up/fov、投影参数、width/height、view_open/view_x/view_y/view_width/view_height/move_speed；缺省字段不改，未知字段、非有限数、非法尺寸与投影在任何写入前拒绝。相机按精确 camera_id 匹配，不接受显示名、数值或 opaque_handle 替代身份。
- 该链路由 context → typed DTO → 原生场景操作 → context Promise 完成，不经 JSON 字符串、cefQuery、CefProcessMessage 或 registry 旧 handler。返回相机的 opaque_handle 是十进制字符串，不输出 numeric handle。
- 主视口移动、CameraView 移动、保存设置与窗口尺寸同步共用该操作。CameraView 合并局部回复以保留未返回的渲染元数据；主视口重绑定比较 archive/session、相机 ID、scene 和 handle，存档替换即使复用 handle 也会取消旧按键状态。
- 删除 CameraMoveFast、coronaBridge.cameraMove、SharedDataHub 专用移动命令/队列及 Optics 消费；两个旧 CEF wrapper/caller 已关闭，无 alias 或 fallback。非 Web 的 SceneTools.set_camera_pose 仅保留 ScriptRuntime，update_camera_view 仅保留 PythonScript，二者在各自值边界适配后共享原生操作。运行时持有输入时，Web 姿态写返回 EDITOR_INPUT_LOCKED；纯窗口设置仍可操作，脚本自身姿态权限不变。
- 本批仅完成相机姿态/基本配置子项。其余相机渲染参数、viewport/pick/input Fast、manifest 事件/方法、活动 storage、原生图存储及完整 OS/双实例验收仍待迁移，整体 M4/M5 未完成。沿用现有 Dock 设计。

| 验证 | 结果 | 本地证据 |
| --- | --- | --- |
| 原生 DTO/权限及旧队列先失败后通过 | 初始缺失 SetCameraProperties/camera_properties；旧 Fast 检查失败；最终原生专项 3/3 | build/web-camera-native-red-verified.log、build/web-camera-retired-red.log、build/web-camera-properties-native-build.log、build/web-camera-properties-native.log |
| 门面与存档重绑定先失败后通过 | 新 facade 初始 2 失败；复用 handle 保留旧按键的回归先失败，修复后通过 | build/web-camera-facade-red.log、build/web-camera-archive-red.log |
| 全量 JS 串行回归 | 517/517，无跳过 | build/web-camera-properties-unit-verified.log |
| 前端边界、原生源检查、脚本契约 Python | 70 passed；1 条既有 anyio/pytest warning | build/web-camera-properties-python.log |
| 修改 JS/Vue lint | 0 errors；CameraView 4 条既有模板换行 warnings | build/web-camera-properties-lint-verified.log |
| CEF smoke lint | 0 errors / 0 warnings | build/web-camera-properties-cef-lint.log |
| Conan 环境 RelWithDebInfo 引擎及生产前端 | cmake_build 使用已生成的 Conan build 环境，两种构建进程均退出成功 | build/web-camera-properties-engine-build.log、build/web-camera-properties-native-build.log |
| 最终 CTest | 6/6 passed；真实 CEF 33.00 秒 | build/web-camera-properties-cef-verified.log、build/web-messages-smoke/result.json |
| 实际打包 Vue 主页面/SceneBar/CameraView | 聚焦重复写 0，旧请求 0，主视口滚轮提交一次，独立相机键盘从新姿态继续移动且不动主相机 | build/web-camera-properties-deployed-ui.log、build/web-focus-ui-1793896850596017300/result.json |

真实 CEF 在页面 JSON.parse/stringify 禁用条件下验证两个文档共用 patch、opaque handle、缺省字段/其他相机保持、非法混合 patch 不部分写入、旧归档/显示名/handle 拒绝、旧 CEF/Fast 入口不可用，且截图与窗口生命周期仍通过。实际 Vue 回归由现有仓库 CDP 工具驱动生产 DOM handler，监控共享 facade，而非向退休的 Fast 对象重新挂钩。

中间失败如实保留：dev.py 和 CMake bootstrap 曾尝试把已本地提交的 Editor 切回远端 lock，被 Git 拒绝，本地改动保留；最终设置 CORONA_DEV_BOOTSTRAP_ACTIVE=1，直接调用 workflow.cmake_build，加载现有 Conan 环境，不更改 lock、不 stash/checkout。一次直接 cmake 缺 MSVC include 环境，随后通过 workflow 环境观察到真正缺失 DTO 的预期失败。系统 Node 20 不支持测试 glob，改用本地 Node 24。旧 Python 契约测试把引擎根错定位到 Editor，修正为真实引擎路径后通过。并行全量 JS 516/517，既有 nodeGraphSaves 的延时竞态失败；不修改无关实现，串行完整复跑 517/517。首次 CEF 在生产构建仍未退出时启动旧可执行文件，退休方法检查失败；确认构建进程最终退出后完整复跑 6/6。以上失败不记为通过，不通过恢复旧路由或放宽断言绕过。

当前 manifest 总数 175：旧 Web 156、非 Web 19；事件 17、Fast 10。本批本地功能提交：引擎 `3a883ea0`，Editor `115cb0e`，均仅代码/测试。所有 Markdown 保持本地未暂存/未提交，未推送；固定远端 Editor lock 不指向尚未发布的本地提交。

### 2026-11-06 视口配置收敛

viewport.configure(scene,cameraId,{archive_session,mode?,calibration?,bounds?}) 合并三个旧 Fast；MainPage/CameraView 共用直接 V8，原生精确身份与 lease 校验，全部字段有效后才更新，缺省保持。bounds 按调用窗口隔离，CameraView 跨相机绑定拒绝；无 JSON 通信、旧 JS 方法、alias 或 fallback。store 只负责既有 UI 持久化与新接口组合，活动 storage 仍待迁移。

本批 JS 521/521、Python 70、CTest 6/6（真实 CEF 35.24 秒）；Conan 环境引擎及生产前端构建成功，部署三文档聚焦/移动与 CameraView 实际 2D/3D 切换和标定通过。证据见引擎 docs/plans/web-communication-migration.md 的本地记录。引擎 f6c6d5ea、Editor c1689f7 仅本地提交代码与测试，文档未暂存/提交、没有推送。当前旧 Web 156、非 Web 19、事件 17、Fast 7，整体未完成。

### 2026-11-06 指针与系统光标合并

viewport.configure 的 pointer 字段显示时传 `{x,y,cursor}`，隐藏时 `{cursor:'hidden'}`；系统光标由原生同一次操作计算，返回 pointer/systemCursorHidden。两页面的 controller 使用 sceneId/cameraId/archiveSession，不转 Number(handle)，不再调用 coronaBridge。RAF 合并移动，并在 native pending 时仅保留最新未发送坐标；不重试失败请求。hide 使用最后提交的身份，刷新/关闭/归档退休的原生清理按 context owner 隔离。两个旧 Fast、SharedDataHub 专用队列和 Optics 重复缓存整体删除。

JS 529/529、Python 71、CTest 6/6（真实 CEF 36.91 秒）、Conan 引擎与最终前端部署通过；部署 CameraView 实际 pointermove/blur/pointercancel 验证 scoped 调用及系统光标恢复。日志出现实际 cursor=visible/warp=submitted。引擎 f0e8f941、Editor be94618 仅本地提交代码/测试；未推送，所有文档未暂存/提交。Fast 剩 5 条、manifest 175（旧 Web 156、非 Web 19）、事件 17，整体尚未完成，完整 OS/双实例验收仍待进行。


## 2026-11-06 无调用方网格移动通道清理

核查 Web/Python 业务及动态门面后，旧 moveActorMesh / meshMoveResult 无实际业务调用。删除原生 Fast 生产/消费、JSON 回调、manifest 事件、Web onMeshMoveResult 及结果轮询触发；Mechanics 原生碰撞移动能力保持，不混并为普通 transform 写入，不增加无人使用的新 V8 入口。拾取结果轮询保留并补作用域回归。

JS 533/533、Python 边界及聚合 115 passed、CTest 6/6（真实 CEF 37.89 秒）、Conan 引擎和前端生产部署通过。真实 CEF 验证所有测试窗口无旧绑定、原生清单无旧事件且订阅拒绝，pick 事件仍可用。引擎 cad80be4、Editor 5f0010e 仅本地提交代码/测试；无推送、文档未暂存/未提交。当前 manifest 175（旧 Web 156、非 Web 19）、事件 16、Fast 4，整体尚未完成，保持当前 Dock 设计。


## 2026-11-06 Web 生命周期与协作一致性收敛

窗口会话只由主文档写权威状态。子文档通过 windowSession.record 逐条 save/remove，主文档合并后广播递增 stateVersion；晚到快照不能覆盖新状态。策略通知统一为 windowSession.policyChanged，仅在 owner/revision/generation/enabled 改变时发布。保留已有 Dock 设计及原生退休屏障。

api/webDocument.js 缓存不可变启动身份，App、路由、窗口会话、AI 与消息模块共享 owner/role/generation/windowId；hash 参数覆盖 search。带 uiOwner 的文档也属于 peer，peer 缺 owner 时拒绝，不能另建孤立消息域。MainPage、CameraView、SceneBar、Object 使用 utils/viewLifetime.js 保护异步初始化和订阅；卸载后到达的场景树/相机列表结果不更新状态、不安排重试，迟到订阅立即注销。

变换采样统一使用 scene.readTransforms 直接 V8 接口，移除重复 manifest 读取路径。其他 manifest-backed 方法仍保留既有结果包装，本轮不宣称全部直接领域接口迁移完成。语言偏好同步改为公共 Web 消息 ui.localeChanged/ui.locale；localStorage 只用于偏好持久化，本页面 DOM 事件不承担跨文档传输。

项目刷新复核结论：同一就绪项目的普通 resolve 复用状态；force resolve 还用于同路径存档重新打开，必须退休旧窗口。没有按路径相同跳过原生租约更新。

验证：JS 563/563；Frontend Python 边界 27/27；引擎 source baseline 测试 16/16；本轮改动文件 ESLint 无错误，CameraView 原有 4 条模板格式警告保留。真实 CEF 主文档/停靠/分离文档 structured-clone 往返及图保存协调通过，应用通信测试禁用 JSON 编解码；测试使用生产 BrowserManager 加载 file-origin fixture，并非 packaged Vue 点击流程。完整 Vue Dock 点击、CameraView UI、最小化与双引擎隔离仍未在本轮验收。

失败及修正记录：两个新增 SceneBar 迟到响应测试先失败后修复；ESLint 首次从仓库根调用找不到配置，改在 Frontend 下运行。Python 旧断言仍要求 cameraHandle，核对基线代码已使用 cameraId，更新为精确 ID 断言。CEF fixture 首次遗漏新 import，随后又因旧测试直接访问已删除 coronaBridge 全局而失败，改为加载真实 identity 依赖并用可选访问验证旧入口不存在后通过。未将这些失败记为成功。

前端已生产构建并部署到 Conan RelWithDebInfo 运行目录。本轮无 C++ 修改，未重新链接引擎、未运行会修改 Horizon 的原生构建引导。Editor 最终提交 68c58ae；引擎测试适配 7422736b，Editor 本地 pin 更新 e5ccbc57。仅本地代码提交，无推送；所有 Markdown 未暂存/未提交，Horizon 未修改。

证据：引擎 build/web-unification-final-tests.log、build/web-unification-cef-smoke.log、build/web-messages-smoke/result.json、build/web-unification-deploy.log。


2026-11-06 后续生命周期子批：

- Editor ff12972：NodeGraphWorkspace 的 selection/tree 注册独立完成，不再以 Promise.allSettled 将已完成订阅滞留到其他注册结束；卸载后原生回调通过 viewLifetime 围栏。两项回归先失败后通过（web-opt-node-lifetime-red.log / green.log）；完整 JS 584/584、生产构建成功。Engine pin 6718218a。
- 后续微任务顺序回归发现更细竞态：subscribe 已确认 token，但组件 continuation 尚未赋值时发生卸载会漏清理。web-opt-subscription-owner-red.log 中新增两项断言失败。Editor d91b8de 将订阅所有权收进 viewLifetime：已完成订阅在 dispose 中逐个释放、未完成订阅返回后自行释放；重复 dispose 幂等，回调继续隔离；清理异常逐项报告而不阻断其余释放。
- App、MainPage、SceneBar、Object、CameraView、NodeGraphWorkspace 共六处删除组件 token 字段及重复 off 块；保留所有业务请求序列、挂载判断和图保存退休操作。Engine pin c1848654（d91b8de7558f63664c80d1bb47367bb0f9b69b7b）。
- 验证：定向 29/29（web-opt-subscription-owner-green.log，之后新增异常隔离/退休不注册两项由全量覆盖）；完整 JS 588/588（web-opt-subscription-owner-final-js.log）；Frontend Python 64/64（web-opt-subscription-owner-python.log）；改动文件 ESLint 无错误，既有五条 Vue 模板 warning；生产构建成功 6.38 秒（web-opt-subscription-owner-vite.log）。
- 打包 Vue 测试适配正在进行：web_focus_smoke.py 改为可选访问已删除 coronaBridge，全程从实际 SceneBar 相机行打开 CameraView；新增 web_packaged_ui_smoke.py 创建独立创造世界与 engine Job Object，运行 focus/environment 回归并记录二进制/前端 hash，尚未执行，不能记为通过。
- 当前最新 Conan 引擎构建仍在 Python runtime Lib 的 copy_directory_if_different 阶段，待最终退出码；上述新 Editor 源码尚待构建释放后通过 Conan 安装目标部署。WEB-OPT-12 的订阅子批有源码回归证据，但整体验收仍未完成。无 push，所有 Markdown 保留本地且未暂存；未主动修改或向 Horizon 提交。


23:50 更新：最新 Conan 引擎 build-fast corona_engine 已取得退出码 0（web-opt-camera-engine-build.log），包含相机原生变更与 Optics 消费端，Python runtime 打包完成。当前开始通过 Conan build-fast corona_editor_install_corona_engine 部署 Editor d91b8de，日志 web-opt-subscription-owner-deploy.log。CEF 与 packaged Vue 验收结果另记，不提前标为通过。


后续 CEF 验收与修正：

- Conan Editor 安装目标已退出 0；运行目录 viewLifetime.js、NodeGraphWorkspace.vue、dist/index.html 与源码/生产输出 SHA-256 一致（index.html D8FF7E397A78D384360D6E355E304F0BEAA4847865DA8A091D0E6D8FB1697B3D）。
- 首次真实 CEF（web-opt-subscription-owner-cef.log）在旧断言处失败：误把 sourceCameraId 含斜杠视为非法，但 test_camera_window_identity.cpp 明确保留 camera/max。测试改为验证 opaque 标识往返，不改变原生契约。
- 第二次（web-opt-subscription-owner-cef-final.log）通过窗口/消息/环境/变换/属性回归后，在 GPU 拾取与旧 manifest 读取的 Actor 句柄比较处失败，暴露真实缺陷：json_to_v8 先用 is_number_integer + get<int> 将 uint64 地址截为 32 位。
- 修正通用旧结果转换：unsigned 判断优先；32 位范围使用 Int/UInt，其余使用 V8 Double 保留 JS safe integer 范围。直接 typed V8 的 opaque 句柄依然以字符串传递，本修复不声称数值 Number 可无损代表所有 uint64。新增读取测试自有 integer-boundaries.json 的 CEF 回归，覆盖 signed/unsigned 32 位边界、正负 2^40 与正负 MAX_SAFE_INTEGER；原有真实 GPU 完整句柄一致性断言保留。
- 本修复 Conan 引擎重建中（web-opt-integer-engine-build.log），native binding 编译已通过；待完整退出及再次 CEF 通过后才本地提交。packaged Vue focus/environment 尚待运行；未据失败 smoke 记为成功。


2026-11-07 继续验收：

- 旧 manifest 整数截断修复已本地提交 Engine 0af80848。Conan 引擎重建退出 0（web-opt-integer-engine-build.log）；真实 CEF 全套通过（web-opt-integer-cef.log，web-messages-smoke/result.json）。包括 safe integer 边界、完整 GPU Actor 句柄、typed 相机对象创建/原生窗口 open-close 状态投影、关闭幂等和三个旧相机 CEF 路由拒绝。
- CEF 证据仍属于生产 BrowserManager 的 file-origin fixture；不能代替 packaged Vue。新增 packaged runner 首次仅因使用旧 success 布尔字段判断当前 status:success 包装而失败，实际测试世界已经打开。已迁移 runner/focus/environment 断言至当前包装并重新执行，结果待记录；不为测试恢复旧接口。
- 首次 runner 的 Job cleanup 超过首轮等待但之后精确 PID 已退出；结果如实保留 cleanup_ok=false。runner 增加对本次 Job 的第二次有界核对，不检查/终止其他实例。


2026-11-07 相机列表身份修复及 packaged Vue 验收：

- 真实 SceneBar 双击相机行遭 V8 参数拒绝的原因是 normalizeCameraPayload 丢失 archive_session。新增从实际列表映射、OpenCameraView 到真实 appService 的回归，先复现 undefined archive，再复现 view_x/view_y 为 0 被 ||120 覆盖。修复保留 observed archive 身份并用 ?? 保留零坐标。Editor bac668836aabd60fff8dc753a43946bea71007bb；Engine pin f185509f。
- 定向 14/14，全量 JS 589/589（build/web-opt-camera-payload-full-js.log），改动文件 ESLint 退出 0。Conan build-fast corona_editor_install_corona_engine 退出 0（build/web-opt-camera-payload-deploy.log），部署时生产 Vite 构建成功。
- packaged Vue 最终通过（build/web-opt-camera-payload-packaged-target.log；build/web-packaged-ui-smoke/run-up1fayrs/result.json，passed=true / cleanup_ok=true）。实际 SceneBar 双击打开 CameraView，主/次相机聚焦隔离、移动、模式及标定、blur/cancel 恢复系统光标、真实 DOM 单次拾取与脚本点击传递通过。环境面板太阳/网格/物理修改、保存重开、旧 archive 拒绝、旧 Dock 文档退休通过。
- 测试修正：明确选择无 uiOwner/standalone 的主文档，不能用 DevTools 返回的第一项；项目重开后不重复关闭已退休 tab ID；CameraView 点击瞄准完整 render 中心（input-layer 排除标题栏），先等待 GPU 首帧命中再验证单次生产 DOM 点击。先前原始 miss、GPU 首帧 timeout、错误调试目标及重复关闭导致的失败日志全部保留，不算通过。
- 本轮只使用 runner 自建的独立创造世界；未改用户存档。运行版本 engine SHA256 6bfbe3851000e423815031b70f7a8287d023a9c1ff931a4cf867905516a218f2，部署 dist/index.html SHA256 7ca9139dd5d9f0f39e21855cee791d8de882a9b118a265a4012b8d8a77b96026。
- 自动化 runner 和旧测试适配作为独立 Engine test(web) 本地提交；没有 Markdown/Horizon 暂存或提交，无 push。此次只覆盖 WEB-OPT-04、06 标定、12 订阅的这些场景，不宣称 WEB-OPT-05/07–11 或完整 WEB-OPT-13 已完成。下一批按计划推进场景读取投影。


2026-11-07 WEB-OPT-05 第一子批（尚未完整验收）：

- 新增具名 corona.scene.readActorIndex(scene,{archive_session})，请求/回复为 owned C++ 值，返回 archive_session/scene/tree_revision 及 actors 的 GUID、name、type。既不构建完整场景，也不读几何锁、渲染设置或存储适配，不懒创建默认场景。
- CameraView 的拾取索引由旧 listSceneTree 改为此投影；NodeGraphWorkspace 的 selectRunTarget 从完整 getSnapshot 改为此投影。项目图缺 scene 时先读 readActive，仅在 archive 与已加载图一致时继续。结果保护覆盖 archive、graphLoadSequence、卸载及 panelClosing。MainPage getSnapshot 和 NodeGraph 助手上下文的完整树仍待后续迁移，不将本子批记成全部读取迁移完成。
- Editor 本地提交 4bdc91d89de94bf524c987bcf8342c38f7a3cc8e，Engine 配对 pin 工作区已更新，原生功能提交等待最新构建/CEF/UI 通过。
- 回归先失败证据：web-opt-actor-index-red.log（未提供新 facade、旧完整树调用）；web-opt-actor-index-cef-red.log（真实 V8 无 readActorIndex）；web-opt-actor-index-close-red.log（panelClosing 后仍发送目标）。修复后 JS 601/601（web-opt-actor-index-final-js.log）；Frontend Python 64/64（web-opt-actor-index-python-final.log）；Vite 成功 5.50 秒；ESLint 无错误、既有5条模板 warning；retired source guard 12/12。
- Conan tests target 构建与原生测试初版通过（web-opt-actor-index-native-build-target.log、native-tests.log）；随后补充无扩展名音频 Actor 类型断言，发现不能仅返回空 extension，必须回退 actor_type。web-opt-actor-index-type-red.log 有明确断言失败，测试失败清理还出现 SegFault 分类；未算通过。已补 type fallback，重建和重测中，最终结果另记。
- 工具执行错误也如实保留：首次 Conan tests 目标误写为 test_camera_window_identity（ninja unknown target），改为实际 corona_camera_window_identity_tests；首次 Python 测试在 Frontend 内启动导致包导入失败，改在 CoronaEditor/editor 启动后64/64通过。这些是命令/工作目录修正，不修改业务以迎合测试。
- 引擎 Conan examples 完整构建仍在 Python runtime Lib copy_directory_if_different，未取得完整退出码。补充的音频 type fallback 发生在该轮 UI 库编译之后，因此需要后续再次增量构建再做最终 CEF/UI，不能使用旧二进制冒充覆盖。


2026-11-07 同一 Actor 索引子批追加：

- MainPage 查找 Actor 身份的 refreshActorPickIndex 也迁移到同一 readActorIndex；保留归档、scene 和卸载围栏。新增4项回归先失败（web-opt-main-actor-index-red.log），随后完整JS605/605（web-opt-main-actor-index-full-js.log），定向lint无错误，Vite构建6.71秒成功。Editor 6dbfac6c52fcbc7061edc20f4275b5982dfadfc1，Engine最终配对pin为此版本。
- 无扩展名音频Actor的type fallback修复后，Conan tests构建退出0，CameraWindowIdentityTests通过5.22秒（web-opt-actor-index-type-green-build.log / type-green.log）。
- 第一轮examples构建已退出0（web-opt-actor-index-engine-build.log），但其UI库编译早于type fallback，不代替最终版本。
- web-opt-actor-index-engine-final-build.log 已编译最新原生库、链接引擎并部署前端，但最终CEF Release目录复制失败；原因是测试提前启动，与post-build DLL复制重叠。这是执行顺序错误，不能记为构建成功。测试进程已退出，改为等待Conan完整退出后串行验收；重新构建日志为web-opt-actor-index-engine-delivery-build.log，结果待记。
- web-opt-actor-index-cef-final.log 的失败为新增测试提前引用未初始化的cameraClient（TDZ），发生在原生Actor索引结果/参数校验已执行之后。已将跨相机文档比较移动到该客户端初始化之后；需要重新跑完整回归，不能将此轮记为通过。
- 最终部署dist/index.html与本地最新构建SHA256一致：B19380900119728B4F1F473FC5EC7996C37051F8CF04EAA7054379333975B573。完整构建退出码、CEF、packaged Vue含新增graph目标切换仍待另记。


2026-11-07 Actor索引子批最终验收和本地交付：

- 最终Conan examples构建退出0：build/web-opt-actor-index-engine-delivery-build.log。该轮在所有测试进程退出后重新完整部署CEF及Python runtime；随后才串行运行验收。先前复制失败日志仍保留，未替换或记为成功。
- 最终真实CEF全套退出0：build/web-opt-actor-index-cef-delivery.log，build/web-messages-smoke/result.json passed=true。覆盖空世界读取不创建场景、scoped Actor索引字段、坏参数、旧归档/错场景拒绝、JSON禁用、主/相机文档一致性，以及既有窗口/消息/环境/变换/属性/拾取/脚本/截图/相机回归。
- 固定1 Actor / 2相机、各20次请求的本轮观测：完整树 resultBytes=1982，p50=17.9ms，p95=18.4ms；Actor索引 resultBytes=186，p50=18.0ms，p95=18.5ms。结果字节由测试宿主为可比体积计算，不是生产JSON传输。返回体积减少约90.6%；小场景耗时基本持平，不声称降低了时延，也不推广成大场景性能结论。
- 最终packaged Vue整套退出0：build/web-opt-actor-index-packaged.log；build/web-packaged-ui-smoke/run-zia5xtdx/result.json passed=true、cleanup_ok=true。focus/environment继续通过，新增graph在实际NodeGraph Dock中从项目切Probe再切回项目，scopedIndexReads=2，fullSnapshotReads=0。测试仅修改独立测试世界，进程树已清理，stdout未发现Vue ERROR/WARN。
- 运行版本engine SHA256=1f01b33fff74b0a46da62282a0e141ecab702e542b6a41045af399ebc8a705ff；dist/index.html SHA256=b19380900119728b4f1f473fc5ec7996c37051f8cf04eaa7054379333975b573，与源码本地生产构建一致。
- 配对版本：Editor HEAD 6dbfac6（前一同批提交4bdc91d），Engine 51de37cc feat(cef): expose scoped actor index reads（含Editor pin）；新增打包节点图验收单独提交50343b21 test(web): cover packaged node graph target selection。
- 验证汇总：JS605/605；Frontend Python64/64；ESLint无错误（既有模板warning未全局格式化）；Vite6.71秒成功；CameraWindowIdentityTests5.22秒通过；退休绑定source guard12/12；Conan完整退出0；真实CEF、打包Vue三套通过。
- 全部本地代码已按功能提交，无push，无Horizon修改/提交；所有Markdown仍只保留本地、未暂存或提交。WEB-OPT-05仅Actor索引子批达到上述验收，MainPage完整getSnapshot及其dump/parse、相机列表/丰富场景树等剩余读取未迁移；WEB-OPT-06助手owner、07–11领域及通用manifest退出、12最终清理、13完整验收继续开放。总体目标仍进行中。


2026-11-07 WEB-OPT-05 Actor属性读取子批最终验收：

- 新增具名 corona.scene.readActorProperties(scene,actor,{archive_session})，直接 owned C++ DTO/V8 对象返回。Object属性面板及MainPage变换基线共用；不读取AABB、材质、动画和模型节点，基础属性复用setActorProperties的同一snapshot函数。保留加载状态/错误、模型路径、变换、物理、camera_lock和字符串opaque handle。读请求不创建默认世界、不改变revision/selection。
- 删除getActor/readActor两个Web门面及SceneTools.read_actor的CEF权限，Python完整读取契约仍保留。删除缺失archive时readActive补默认世界的路径；请求必须携带已观察archive/scene/Actor。Object及MainPage检查归档、场景、重载和视图生命周期，迟到结果不写UI。Object等待新对象时清除旧GUID，避免采样套用上一对象变换。
- 先失败：web-opt-actor-properties-red.log记录缺失facade及两处旧读取链；web-opt-actor-properties-cef-red.log记录真实V8没有新方法。修复后最终JS616/616（web-opt-actor-properties-final-js.log）；Frontend Python64/64（web-opt-actor-properties-python.log，既有pytest插件deprecation warning）；定向ESLint无错误；Vite6.02秒成功（web-opt-actor-properties-final-vite.log，既有chunk警告）；retired source guard13/13（web-opt-actor-properties-retired.log）。
- Conan tests目标退出0（web-opt-actor-properties-native-build.log）；CameraWindowIdentityTests通过6.73秒（web-opt-actor-properties-native-tests.log）。覆盖只读作用域、不懒创建场景、GUID/名称解析、参数/旧归档拒绝及读写共享属性。
- Conan完整引擎构建退出0（web-opt-actor-properties-engine-build.log），之后才运行CEF/UI。前端源码本地生产构建与部署dist/index.html哈希一致。
- 第一次CEF在导入测试Actor时发生Windows stage.rename(destination) WinError 5拒绝访问，尚未进入属性读取断言。web-opt-actor-properties-cef.log保留为失败，不改业务或降低断言。新建测试世界重跑的web-opt-actor-properties-cef-final.log完整退出0；具体文件占用来源未定位，不声称已修复资产导入问题。
- 最终CEF全套通过，build/web-messages-smoke/result.json passed=true；覆盖禁用JSON、属性字段/opaque身份、坏参数/旧归档、旧manifest路由拒绝，及既有窗口/消息/属性/拾取等回归。固定1 Actor/2相机，各20请求：完整树1982字节，p50=17.8ms/p95=19.0ms；属性投影682字节，p50=18.0ms/p95=18.5ms。字节由测试宿主计算，不是生产JSON传输；相对完整树体积约减少65.6%，耗时基本持平，不推广大场景结论。
- 最终打包Vue四套focus/environment/graph/properties退出0（web-opt-actor-properties-packaged.log）；build/web-packaged-ui-smoke/run-decy6hnb/result.json passed=true、cleanup_ok=true。实际Object Dock两次scoped读取、旧read_actor调用0，DOM按钮切换运动学/动态，质量修改为3.5，清除后重新选择恢复3.5。测试仅修改自建世界，Job进程树已清理。
- 配对本地提交：Editor e3d2cd4153393a10b694d7097348489c3392c4ac；Engine 49799c46 feat(cef): expose scoped actor property reads（含Editor pin）、80f6256d test(web): cover packaged object property reads。无push，无Markdown暂存/提交，无主动Horizon修改/提交。
- 引擎SHA256=1f2d92556c05a1111294eae0b6ab2f4d8b72b32bfe0a603de2f1a581ef5b7afa；dist/index.html SHA256=a387db339d69a7eb69329c5c468ad08766f9d436cecba8c9e8ca25bdff2cb140。
- 本子批不代表整体读取迁移完成：MainPage初始化getSnapshot及dump/parse、相机列表/高级渲染元数据、丰富树、存档/AABB等仍开放；助手owner和其余领域/manifest退出继续按计划实施。总体目标仍进行中。


2026-11-07 WEB-OPT-05 相机读取及主视口投影子批最终验收：

- 新增具名 corona.scene.readCameras(scene,{archive_session})，请求/回复直接 owned C++ DTO/V8 对象。返回 active_camera_id、相机字符串 opaque_handle、姿态/投影/窗口状态及渲染开关；复用 setCameraProperties 的 camera_properties_snapshot。不读 Actor 几何，不读高级渲染设置 JSON 字符串，不创建默认世界、不修改选择/tree revision。缺失 archive/scene、错场景和退休归档均拒绝。
- MainPage 初始化退出完整 getSnapshot，组合 scoped readCameras/getEnvironment/readActorIndex，保留环境开关、拾取身份及活动相机语义；CameraView 初始化、相机窗口恢复和 SceneBar 悬停共用 readCameras。CameraView 路由携带创建时 archive，缺失或退休不绑定新世界；迟到结果按归档、请求序号、场景和视图生命周期丢弃。相机恢复时旧渲染 policy 写路径仍待 WEB-OPT-07，不宣称全部写入已具备相同 scope 围栏。
- 删除 scene.getSnapshot/sceneTools.listCameraViews 两个 Web 门面及 SceneTools.get_scene_snapshot/list_camera_views 的 CEF 权限；Python/ScriptRuntime 原契约保留。SceneBar 丰富树、助手上下文、存档/AABB和独立高级渲染设置仍待后续迁移，不把本子批记为完整 WEB-OPT-05。
- 红灯证据：web-opt-camera-reads-red.log、scope-red.log、cef-red.log；首轮 native 编译在测试 std::string 与 nlohmann::json 直接比较处报 MSVC C7692，修正测试显式 get<T>() 后重建成功，不改变业务实现。原失败 web-opt-camera-reads-native-build.log 保留；最终构建 web-opt-camera-reads-native-rebuild.log 退出0，CameraWindowIdentityTests 6.98秒通过（web-opt-camera-reads-native-tests.log）。
- 前端最终 JS631/631（web-opt-camera-reads-full-js.log）、Python64/64（web-opt-camera-reads-python-final.log）、退休source guard14/14（web-opt-camera-reads-retired-final.log）；定向ESLint无错误，CameraView既有4条模板warning；Vite构建5.54秒成功，最终退出0。
- Conan build-fast corona_engine --configuration RelWithDebInfo --target-family examples 完整退出0（web-opt-camera-reads-engine-build.log），部署及Python runtime拷贝完成后才启动测试。首次CEF命令误用系统Node20（web-opt-camera-reads-cef.log），改用Conan环境Node22。首轮实际CEF新增active_camera_id断言误写smoke-camera（cef-runtime.log），fixture明确默认main-camera，修正测试后最终cef-final.log全套退出0、build/web-messages-smoke/result.json passed=true。没有为测试恢复旧API或修改活动相机逻辑。
- 固定1 Actor / 2相机，各20请求：完整树1982字节 p50=18.1ms / p95=18.4ms；相机列表1322字节 p50=17.8ms / p95=18.7ms。字节为测试宿主统一计算，非生产JSON通信。相机列表投影相对完整树体积减少约33.3%，耗时基本持平；MainPage原一次完整快照改为三个领域投影，本采样不代表组合总请求数、总字节或总时延改善，不推广大场景性能结论。
- 打包Vue focus/environment/graph/properties四套全部通过（web-opt-camera-reads-packaged.log；build/web-packaged-ui-smoke/run-tm4y4r20/result.json，passed=true、cleanup_ok=true）。实际SceneBar相机行mouseenter产生scoped读取，CameraView实际URL带archive；旧完整快照/相机列表读取0；聚焦隔离、相机移动、标定/指针、GPU拾取、脚本点击、环境保存重开、节点图目标及Object属性回归继续通过。仅使用测试自建世界，Job进程树已清理。
- 不能将上述断言通过视为日志无异常：本轮stdout在同路径重开世界后 tick314出现Optics旧相机句柄unoccupied异常，下一tick恢复；历史run-zia5xtdx及run-decy6hnb也存在同类异常。另有SDL surface teardown timeout，最终surface已注销；CEF stderr有single-process proxy resolver及DEPRECATED_ENDPOINT。尚未定位/修复所有这些问题，保留日志。下一独立稳定性任务检查归档退休后残留camera viewport队列；不修改Horizon、不吞异常冒充修复。
- 本地配对提交：Editor 2cf9bb59a3723d19970ecc58bcd773c4d354c7cf；Engine 51f5af90 feat(cef): expose scoped camera read projections（含Editor pin）和683e3b24 test(web): validate scoped camera reads in packaged views。无push、无Markdown/inventory暂存提交，无主动Horizon修改/提交；自动补丁按既有构建流程沿用。
- engine SHA256=a0aceefeb36f61046b879d2938464800e31cdf86b14f28cdd67d6c40ac45c99d；dist/index.html SHA256=6f9047dbfdcff0d0aee30f4a819ff019135fc4938f76d4462632c8c2fa4bd62a，与Editor本地生产构建一致。
- 整体目标继续进行中：后续丰富树/存档/AABB、助手owner、领域typed接口及manifest退出、完整退休/多窗口验收仍未完成。先单独复现/修复上述已确认历史存在的旧viewport队列稳定性问题，再继续剩余读取投影。


2026-11-07 延迟viewport退休稳定性子批最终交付：

- 上一实施记录中的同一次Conan引擎构建已完整退出0（web-opt-viewport-retirement-engine-build.log），未因长时间Python runtime比较/复制而重启，测试均在部署结束后开始。先前session54726/PID42084现已终止，不能再作为活跃构建使用。
- 真实CEF全套退出0（web-opt-viewport-retirement-cef.log，build/web-messages-smoke/result.json passed=true）。打包Vue focus/environment/graph/properties四套退出0（web-opt-viewport-retirement-packaged-final.log；build/web-packaged-ui-smoke/run-73fgzxi7/result.json passed=true、cleanup_ok=true、optics_failures=[]）。本次需要第二次有界Job cleanup核对后确认清理成功；未终止用户实例，仅用自建测试世界。
- 新runner将Optics NodeFail纳入整体失败条件；旧引擎红灯实测两次失败，新引擎本轮0次，不能再仅凭DOM断言通过就忽略对应渲染异常。本轮stdout未发现[ERROR]，但SDL surface teardown timeout警告仍有，CEF stderr仍有single-process proxy resolver错误；这些没有被本修复解决，不宣称全日志无告警。
- 本地功能提交1fb2ffa1 fix(viewport): retire deferred camera updates with their owner；测试独立提交9a091730 test(web): reject Optics failures during packaged UI acceptance。Editor代码不变，配对2cf9bb5；无push，无Markdown/inventory暂存提交，无主动Horizon修改/提交。现有UI frame文件仅多传递一行authority，不改Dock布局或窗口策略。
- 引擎SHA256=c30ba3aede4e75b64829a274d24b3c263cf0c2611d4feb29d4722629f32bb667；dist/index.html SHA256=6f9047dbfdcff0d0aee30f4a819ff019135fc4938f76d4462632c8c2fa4bd62a。
- 后续继续WEB-OPT-05丰富树读取：SceneBar唯一listSceneTree调用仍用旧manifest；其Actor row已为轻量owned结构，可复用，不再经过JSON DTO，也不再由camera_to_json附带高级设置。NodeGraph助手listActorTree仍需变换/物理等不同投影，不能仅换成GUID/name索引丢失上下文；它与助手owner/其余领域后续处理。完整目标仍进行中。

2026-11-07 WEB-OPT-05 丰富场景树读取子批已完成本地验收：

- 新增 `corona.scene.readTree(scene,{archive_session})`，直接返回归档作用域、scene、tree_revision、轻量 Actor 行及复用的相机投影。Actor 行使用字符串 `opaque_handle`、可见性、加载/GPU状态、错误和模型节点计数，不携带完整几何、AABB、材质或高级设置 JSON。
- SceneBar 改为按当前 archive/scene/request 序号读取并原子更新，迟到响应、错归档、错场景和缺少 archive 均丢弃；旧 `sceneTools.listSceneTree` CEF wrapper/权限退出，Python/ScriptRuntime 原契约通过共享 row helper 保留。NodeGraph 的 `scene.listActorTree` 继续保留，因为它需要变换/物理上下文。
- Editor 本地提交 `b4759fb`（含测试通道清理），Engine 本地提交 `e6b69c37`、`2e1dbdc0`；无 push。642 项 JS、64 项 Python、ESLint、Vite、原生 CTest、15 项旧接口守卫、真实 CEF 和打包 Vue 全部通过。Conan 完整构建 `build/web-opt-rich-tree-engine-build.log` 退出 0；CEF `build/web-opt-rich-tree-cef.log` 通过；打包 `build/web-opt-rich-tree-packaged.log` `passed=true`、`optics_failures=[]`、`cleanup_ok=true`。
- 本轮仅使用测试自建世界。构建沿用 Horizon 现有补丁和 pin，Horizon 工作树未修改、未提交；本地 Markdown/inventory 仍不暂存、不提交。


2026-11-07 旧 Actor 上下文存储通道清理：

- 全仓调用核查确认 `useActorContext.js` 只有 MainPage 和 SceneBar 两个写入方，没有读取方；它通过 localStorage 双写 scene/actor/target 三个字段，不能影响当前 Blockly 或节点图目标状态。删除该 composable 和两处调用，不替换为另一套活动状态通道。
- 新增 source-boundary 回归先失败、删除后通过；完整 JS 650/650，Frontend Blockly/source-tree Python 边界 13/13，定向 ESLint 无错误，Vite production build 成功。构建仅有既存 Blockly 分包和大 chunk 警告。
- Editor `7145d7de` 本地提交清理，Engine `1de3ade0` 更新 Editor pin；没有推送。BOUNDARY 与本文件仅本地修改，Horizon 既有 11 处工作树修改保持原样。


2026-11-07 Actor创建契约（本批原生构建/运行验收尚待完成）：

- `editorApi.scene.createActor(scene, path, {archive_session, actor_type, actor_name?, audio_resource_id?})`直接调用同名V8。actor_type为model/ui_image/actor/audio，默认model；archive必填，audio资源ID为非零uint64十进制字符串，禁止JS number。返回已有ActorReadSnapshot（scene/archive/name/actor_guid/handle/geometry等），不是旧success/data envelope。
- SceneBar四种导入共用一个流程，捕获scope贯穿选择、创建、刷新；迟到结果不能写入新世界或已卸载视图。旧sceneTools namespace和旧createActor Web入口已删除，C++原Python/ScriptRuntime入口及memory_only保持。
- 本地Editor e9bdf9a、Engine8c563a27；Node705/705、guards31/31、lint已过。Conan/真实CEF及packaged属于本批独立验收，不引用上一批绿色结果。


2026-11-07 Python服务通路去JSON文本前置批：

- C++/Python服务请求和结果以owned immutable值经既有runtime队列传递，服务消费线程在GIL内转换list/dict/标量；不再构造或解析JSON DTO字符串。此处是内部执行通路，不是新增Web通用invoke。
- 现有Python业务/模块注册/权限和非Web字符串adapter继续保留；旧callback元组语义保持。脚本的具名Web绑定尚未迁移，当前Web仍有92个旧CEF manifest入口，不能称整体完成。
- Editor7bb345a / Engined0da5304，97runtime回归、32guard、native转换/队列单元已过。新Conan完整构建及真实CEF/packaged验证待本批独立记录。

本批最终验收：Conan6349、CEF24367、packaged8025均真实exit0；五套/全部11面板通过，cleanup_ok=true、optics_failures=[]。结果D:/project/CoronaEngine/build/web-packaged-ui-smoke/run-1jgngu4i/result.json。具名Scripts/ProjectFiles等迁移及整体计划仍开放。


2026-11-07 ProjectSettings：readProjectDocument/commitProjectDocument/getActiveProjectInfo/saveActiveProjectInfo直接调用corona.projectSettings具名V8；metadata为显式字段，document content为owned结构化值。Web版本凭据仅SHA256 revision，JSON序列化仅在Python文件owner落盘；独立非Web version原契约保留。旧CEF manifest入口关闭，Python原权限保持；Web调用不再解包data或接受多层metadata envelope。设置面板复用createViewLifetime并带项目revision/请求序号保护，保存携带加载时project_path与archive_session。最终Node717/Python133+56subtests通过；Conan完整构建、真实CEF JSON禁用及packaged五套/11面板通过，项目设置真实Vue保存/重置通过（run-ai8guyqu）。CEF剩82个旧入口；完整优化计划仍未完成。


2026-11-07 FileManager与无消费者入口收敛：corona.files仅getFileTree/createFolder/createActorTemplate/renameItem/deleteItem/openFile六个具名V8操作，显式archive_session/project_path与owned文件树；Web元信息统一projectSettings.getActiveProjectInfo。旧getFiles无消费者不迁移，createFile明确为Actor模板；8个FileManager旧CEF权限关闭，独立Python契约保留。FileManager.vue复用viewLifetime并保护metadata/tree/menu/dialog在途结果、释放window.click，文件双击/菜单打开共用一条路径。ResourceSearch七个Web包装无消费者，namespace删除、CEF关闭，Python schema/适配保持。projectLauncherService脚本清理直接读具名Scripts值，不再data fallback；旧/无效回执阻止切世界。最新Node727/Python108/Engine guard36通过；这些子批仍等待最新源码完整Conan构建与真实CEF/packaged运行验收，不能记为已交付。当前源码旧CEF67，整体计划active。


2026-11-07 ProjectLauncher无消费者清理：Editor740cb2d / Engine397b0a0f。本轮删除browseFolder/getDefaultProjectPath/createProject/validatePortableScene/importPortableAsset/cleanupPortableSceneAssets六个无生产Web消费者包装，旧manifest仅移除CEF/JS alias，独立非Web契约与handler保留。删除scopedAssetPayload/callProjectAssetOperation两个无剩余调用方的scope补全函数。projectLauncherService仅保留openProject的selection、串行队列、旧世界停止恢复与发布编排，删除十二个纯转发方法。实际七个project方法尚未具名迁移。最新源码旧CEF61（Network29/LANChat22/ProjectLauncher7/EditorApi2/CoronaEditor1）；Node727/Python111/guards37/版本16/lint/Vite通过，最新源码Conan与CEF/packaged验收仍待执行。所有文档仅本地，不暂存提交；无push。


2026-11-07 ProjectLauncher读取：Editor d552130 / Engine5bc7594b。版本、最近项目和加载状态直接调用corona.project三个具名V8，显式owned C++ DTO，零参数严格验证；旧三个CEF入口关闭，Python契约保留。RecentGames统一viewLifetime与状态read序号，阻止卸载后创建轮询、迟到写入和迟到导航。NewGame/MainPage直接读加载snapshot。Node732/Python111/guard38/lint/Vite通过；最新完整Conan与真实CEF/packaged尚待。源码旧CEF58，实际创建/打开/文件选择四个ProjectLauncher方法尚未迁移。上一批FileManager/ResourceSearch/Scripts已完整构建及CEF/packaged通过，全部11面板、真实FileManager菜单和真实最小化/恢复通过（run-fp7sp3ip），cleanup_ok=true、Optics失败0。


## 2026-11-07 项目打开收敛（源码已提交，原生验收待完成）

`corona.project.openProject(path, {load_policy: 'prompt' | 'degraded'})` 直接返回 `{ok, status, path}` 及按状态存在的 `message`、`degraded`、`unresolved_actor_count`、`scene`、`diagnostics`；不再返回通用 `data` envelope。具名参数由V8校验，诊断逐字段映射到owned DTO，不经过JSON字符串。原生归档解析保留自身执行边界，Web不套普通manifest 30秒超时。

`projectLauncherService.openProject` 仅负责选择串行化、旧世界清理、会话确认及项目消息发布。原生唯一 `open_launcher_project` 保留准备/停止脚本围栏/替换场景顺序，并由非Web adapter复用。RecentGames保留资源诊断确认、降级重试、取消与卸载保护。ProjectLauncher旧CEF路由已全部关闭；独立Python契约保留。

源码配对Engine93b82627 / Editor372c05f；Node738、Python111、guard41+版本16通过，原生构建/运行仍待验收。


## 2026-11-07 联机入口清理（源码已提交，原生验收待完成）

AST消费者清单确认Web仅使用Network 8个、LANChat 12个方法，无动态未知调用方；删除21个Network及10个LANChat的无消费者Web包装，并关闭对应CEF权限，保留原生/Python独立契约和引擎联机队列。当前仍使用manifest的20个实际联机方法及LANChat事件尚待具名V8迁移；不为已删除的31个方法新增V8门面。源码配对Enginefaabc5f5 / Editor3ecf235，Node740、Python115、guard42+版本16通过；本批尚未构建/运行验收。

### Network具名V8（2026-11-07）

八个实际Network操作已迁至corona.network，editorApi.network只做必要参数组织，networkService已删除；JoinGame与lanchat store直接调用editorApi。响应为直接owned值，peer.project_id十进制字符串保存完整uint64；非Web接口类型不变。旧Web Network manifest权限已全部关闭。LANChat方法与事件仍待后续迁移，本批不得视为完整联机验收。构建及运行状态见Engine本地实施计划。

## 最新 LANChat 方法迁移（2026-11-07）

Editor `2f5b3f6` 与 Engine `6efb719f`：12 个实际消费的方法直接引用 `corona.lanChat`；删除 `lanChatService` 纯转发，store 保留业务编排。返回直接领域值，历史 metadata 以对象投影。原生/Python 原契约及底层网络/历史格式保留。Web 事件仍使用原有 LANChat.event 订阅，metadata_json 的事件解析尚待具名事件批移除；不可视为最终无字符串通信已完成。742 JS / 115 Python / 61 guard+版本及独立 C++ UI 编译通过，当前方法批完整运行验收待构建。文档仅本地。

## LANChat 事件最新工作区状态（2026-11-07，未完成运行验收）

App 现通过 `editorApi.lanChat.onEvent` 获取原生 disposer，并由 viewLifetime 清理；C++ 与窗口事件共用上下文订阅表、归属围栏、task runner 和取消机制。LANChat.event 的旧 CEF 权限和 JS alias 退役；Python 别名/独立契约保留。消息/历史 metadata 都在原生边界投影为对象，Web 删除 metadata_json 和重复解析，store/disclosure 共用 messageMetadata。744 JS /115 Python /62 guard+版本、ESLint/Vite通过；独立 UI 编译通过后删去失效旧事件组包，最终重编译89329运行中。当前完整引擎构建10645仅含上一方法批，尚无事件批完整构建/运行证据。


事件批已本地提交：Engine f65f8957 / Editor1e6acba；独立 UI 最终89329 exit0，744JS/115Python/62边界与版本、ESLint/Vite通过。完整引擎仍在构建上一方法批，事件批真实运行待验收。原生集成探针四项已源迁移，不把py_compile当作验收。没有推送上述后续提交。
