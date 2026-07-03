# 项目Memory - 订单服务

## 重要参考文档

本项目的API文档和设计文档位于父级目录的 PROJECT_SUMMARY.md 中：
路径: /Users/meng/Desktop/CODE/Tymoe/PROJECT_SUMMARY.md

## 前端 UI 规范（仅本 Portal 仓库）

新增或重写任何页面前，先读 `src/components/UI_GUIDELINES.md`（**本 Portal 前端**唯一权威规范，不适用于 POS/member 等其他项目）：
基础组件只从 `@/components/ui-kit` import，配色用 slate + 少量语义色，**严禁紫色**，不再新增 antd。
组件源码：`src/components/ui-kit.tsx`（与文档冲突时以源码为准）。

## API 文档维护规则

重要: 任何 API 接口的修改、新增、删除都必须更新以下两个文件：

### 1. 项目内部文档
- API.md - 本服务的API详细文档
- DESIGN.md - 设计文档
- ORDER-ARCHITECTURE.md - 订单服务架构设计文档

### 2. 父级项目文档
- ../PROJECT_SUMMARY.md - 所有微服务的API汇总表

## 修改流程

当对API进行修改时：
1. 更新本项目的 API 文档文件 (API.md)
2. 更新上级 PROJECT_SUMMARY.md 中对应的服务信息
3. 更新 API 版本号（在相关文档中）
4. 更新最后修改时间戳

不要修改其他目录下的项目，如果需要修改其他目录项目，给出修改请求，不要擅自修改。不要创建过多文档。尽量更新已有的文档。

## 当前服务信息



服务: Order Service
版本: v1
端口: 3002
路由前缀: /api/order/v1

最后更新: 2025-10-23
