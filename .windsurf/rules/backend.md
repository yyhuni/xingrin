---
trigger: always_on
---

1.后端网页应该是 8888 端口
3.前端所有路由加上末尾斜杠，以匹配 django 的 DRF 规则
4.网页测试可以用 curl
8.所有前端 api 接口都应该写在@services 中，所有 type 类型都应该写在@types 中
10.前端的加载等逻辑用 React Query来实现，自动管理
17.所有业务操作的 toast 都放在 hook 中
23.前端非必要不要采用window.location.href去跳转，而是用Next.js 客户端路由
24.ui相关的都去调用mcp来看看有没有通用组件，美观的组件来实现