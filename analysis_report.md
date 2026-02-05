# GitMCP 项目访问 Token 配置支持分析报告

## 项目概述
GitMCP 是一个开源的远程 MCP (Model Context Protocol) 服务器，它能够将任何 GitHub 项目转换为文档中心，使 AI 工具（如 Cursor、Claude Desktop 等）能够访问最新的文档和代码。该项目部署在 Cloudflare Workers 上。

## 分析问题
本次分析的核心问题是：**GitMCP 项目是否支持在参数中配置 git 仓库的访问 token？**

## 分析结果

### 1. 当前 Token 支持情况

#### 1.1 服务端 Token 配置
**支持方式：** 环境变量

项目**已经支持** GitHub Token 配置，但**仅限于服务端环境变量**配置：

- **配置位置：** `GITHUB_TOKEN` 环境变量
- **配置文件：** 
  - `worker-configuration.d.ts` (第7行) 定义了 `GITHUB_TOKEN: string`
  - `.env.example` 文件中未明确列出，但系统支持此环境变量
- **使用位置：** 
  - `src/api/utils/githubClient.ts` (第156-157行)
  - 在 GitHub API 请求时，如果环境变量 `env.GITHUB_TOKEN` 存在且 `useAuth` 参数为 `true`，会自动添加 `Authorization: token ${env.GITHUB_TOKEN}` 请求头

#### 1.2 Token 的作用
根据代码分析，配置的 GitHub Token 主要用于：
1. **突破 GitHub API 速率限制：** 无 token 的请求限制为每小时 60 次，有 token 的请求限制提升到每小时 5000 次
2. **访问 GitHub API：** 用于搜索代码、搜索文件名、获取仓库信息等
3. **请求头认证：** 在 API 请求时添加 Authorization header

### 2. 不支持的配置方式

#### 2.1 URL 参数传递 Token
**当前不支持**

项目**不支持**通过 URL 查询参数传递 Token。分析发现：
- 在 `src/index.ts` 的 MCP 初始化代码中（第81-85行），URL 搜索参数会被清理，只保留 `sessionId`
- MCP 工具的参数模式（`paramsSchema`）中没有定义 token 相关参数
- 所有工具调用都直接使用服务端环境变量 `env.GITHUB_TOKEN`

```typescript
// 代码片段：src/index.ts (81-85行)
url.searchParams.forEach((_, key) => {
  if (key !== "sessionId") {
    url.searchParams.delete(key);
  }
});
```

#### 2.2 MCP 工具参数传递 Token
**当前不支持**

项目定义的 MCP 工具（如 `fetch_documentation`、`search_documentation`、`search_code`）的参数模式中**没有** token 参数选项：
- `fetch_documentation` 工具：无参数或 null
- `search_documentation` 工具：只有 `query` 参数
- `search_code` 工具：只有 `query` 和 `page` 参数

#### 2.3 客户端配置文件传递 Token
**当前不支持**

在项目的 README.md 文档中列举的各种客户端配置示例（Cursor、Claude Desktop、Windsurf、VSCode、Cline 等）中，**均未提供** token 配置选项。配置格式示例：

```json
// Cursor 配置示例
{
  "mcpServers": {
    "gitmcp": {
      "url": "https://gitmcp.io/{owner}/{repo}"
    }
  }
}
```

### 3. 访问私有仓库的情况

#### 3.1 官方立场
根据 README.md 文档第348行：
> GitMCP is deeply committed to its users' privacy. The service doesn't have access to or store any personally identifiable information **as it doesn't require authentication**.

项目明确声明**不需要认证**，这表明：
- 官方托管的服务 `gitmcp.io` 主要面向**公开仓库**
- 没有设计用户级别的认证机制

#### 3.2 私有仓库访问方案
如果需要访问私有仓库，目前的可行方案是：
1. **自托管部署：** 部署自己的 GitMCP 实例
2. **配置服务端 Token：** 在 Cloudflare Workers 环境变量中配置 `GITHUB_TOKEN`
3. **Token 权限要求：** Token 需要有访问目标私有仓库的权限

### 4. 技术实现细节

#### 4.1 当前认证流程
```
客户端 (Cursor/Claude) 
  → MCP 协议请求 
  → GitMCP Server (Cloudflare Workers)
  → 使用 env.GITHUB_TOKEN (如果配置)
  → GitHub API
```

#### 4.2 Token 使用控制
- `githubClient.ts` 中的 `githubApiRequest` 函数有 `useAuth` 参数（默认为 `true`）
- `fetchRawFile` 函数中 `useAuth` 默认为 `false`（原始文件内容不需要认证）
- 但这个参数是代码级别控制，不对外暴露

### 5. 代码层面的技术准备

项目在代码层面已经为 Token 认证做好了准备：
- ✅ 定义了 `GITHUB_TOKEN` 环境变量接口
- ✅ 实现了 Token 注入到请求头的逻辑
- ✅ 实现了速率限制检测和处理
- ✅ 支持有条件的认证控制（`useAuth` 参数）

但**缺少**的是：
- ❌ 用户级别的 Token 传递机制
- ❌ 多租户 Token 管理
- ❌ 工具参数中的 Token 选项
- ❌ URL 参数 Token 支持

## 总结

### 主要发现
1. **服务端支持：** GitMCP **已支持** 通过环境变量 `GITHUB_TOKEN` 配置 GitHub 访问 token
2. **参数配置：** GitMCP **不支持** 通过客户端参数（URL 参数、工具参数、配置文件参数）传递 token
3. **设计定位：** 项目主要面向公开仓库，不涉及用户级别的认证
4. **私有仓库：** 需要自托管并配置服务端环境变量

### 推荐使用场景

| 使用场景 | 是否支持 | 配置方式 |
|---------|---------|---------|
| 访问公开仓库 | ✅ 支持 | 无需配置，直接使用 `gitmcp.io` |
| 提升公开仓库的 API 速率限制 | ✅ 支持 | 自托管，配置服务端 `GITHUB_TOKEN` |
| 访问私有仓库 | ⚠️ 需自托管 | 自托管，配置服务端 `GITHUB_TOKEN` |
| 用户各自使用自己的 Token | ❌ 不支持 | 当前架构不支持 |

### 结论

**GitMCP 支持 git 仓库访问 token 配置，但仅限于服务端环境变量配置，不支持通过客户端参数传递。** 

这种设计符合项目作为云服务的定位（零配置、无需注册），但也意味着：
- 官方服务主要服务于公开仓库
- 私有仓库访问需要用户自行部署
- 不支持多用户使用各自的 GitHub Token

---

**分析日期：** 2026-02-05  
**项目版本：** 1.0.0  
**分析者：** AI Agent
