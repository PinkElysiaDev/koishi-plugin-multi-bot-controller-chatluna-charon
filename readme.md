# koishi-plugin-multi-bot-controller-chatluna-charon

[![npm](https://img.shields.io/npm/v/koishi-plugin-multi-bot-controller-chatluna-charon?style=flat-square)](https://www.npmjs.com/package/koishi-plugin-multi-bot-controller-chatluna-charon)

> 为 Koishi ChatLuna 提供多 Bot 人设管理功能，让不同的 Bot 可以使用不同的预设和模型，并隔离对话历史。

## 功能特性

- **多 Bot 人设管理**：每个 Bot 可以独立配置预设和模型
- **Room 隔离**：通过注入 `botId` 实现 room 和消息历史的隔离
- **预设动态注入**：支持直接模式或通过 chatluna-character 注入
- **长期记忆隔离**：可选的长期记忆隔离（需要 chatluna-long-memory）
- **指令兼容**：确保 ChatLuna 指令在多 Bot 环境下正常工作
- **从 multi-bot-controller 同步**：自动从 multi-bot-controller 同步 Bot 配置

## 安装

```bash
# 在 Koishi 根目录下执行
npm install koishi-plugin-multi-bot-controller-chatluna-charon
```

## 配置

### 基础配置

```yaml
plugins:
  multi-bot-controller-chatluna-charon:
    # 是否使用 chatluna-character 插件
    useCharacter: false

    # 是否启用多 bot 隔离
    multiBotIsolation: true

    # 是否从 multi-bot-controller 自动同步 bot 配置
    syncFromMBC: true

    # 是否为每个 bot 自动创建独立的 template room
    autoCreateTemplateRooms: true

    # 是否隔离长期记忆
    isolateLongMemory: true

    # 默认预设 (当 bot 未配置时使用)
    defaultPreset: "assistant"

    # 默认模型 (当 bot 未配置时使用)
    defaultModel: "openai/gpt-3.5-turbo"

    # 是否输出调试日志
    debug: false

    # Bot 人设配置列表
    bots:
      - platform: "onebot"
        selfId: "123456789"
        enabled: true
        preset: "cute-girl"
        model: "openai/gpt-4o"
        chatMode: "chat"
        useCharacter: false
        roomNamePrefix: ""
```

### Bot 配置说明

| 字段 | 类型 | 说明 |
|------|------|------|
| `platform` | string | 平台类型 (如 "onebot", "telegram") |
| `selfId` | string | Bot 的自我 ID |
| `enabled` | boolean | 是否启用此 bot 的人设 |
| `preset` | string | ChatLuna 预设名称 |
| `model` | string | 使用的模型 (如 "openai/gpt-4o") |
| `chatMode` | string | 聊天模式 ("chat" / "plugin" / "browsing") |
| `useCharacter` | boolean | 是否使用 chatluna-character 插件 |
| `roomNamePrefix` | string | 专属的 room 名称前缀 |

## 工作原理

### Room 隔离机制

1. **Room 创建拦截**：在创建 room 时注入 `botId` 字段
2. **Room 查询拦截**：查询 room 时按 `botId` 过滤
3. **独立 conversationId**：每个 bot 使用独立的 conversationId

### 预设注入机制

#### 直接模式 (useCharacter: false)

- 监听 `chatluna/before-chat` 事件
- 动态注入预设和模型到 `promptVariables`

#### Character 模式 (useCharacter: true)

- 将配置注入到 `chatluna_character.config.configs`
- 使用 `guildId_botId` 作为组合键

### 指令兼容

- 包装 `queryConversationRoom` 函数
- 确保 `-r <room>` 参数能查询到正确的 bot 特定 room

### 长期记忆隔离

- 监听 `chatluna-long-memory/init-layer` 事件
- 修改记忆键，加入 `botId` 前缀

## 指令

| 指令 | 说明 | 权限 |
|------|------|------|
| `charon.status` | 查看所有 bot 的人设配置状态 | 4 |
| `charon.presets` | 查看可用的预设列表 | 4 |
| `charon.models` | 查看可用的模型列表 | 4 |
| `charon.sync` | 从 multi-bot-controller 同步 bot 配置 | 4 |
| `charon.reload` | 重新加载预设和模型列表 | 4 |

## 依赖关系

### 必需依赖

- `koishi` ^4.18.7
- `koishi-plugin-chatluna` ^4.0.0
- `koishi-plugin-multi-bot-controller` 1.0.3

### 可选依赖

- `koishi-plugin-chatluna-character`
- `koishi-plugin-chatluna-long-memory`

## 架构说明

```
multi-bot-controller-chatluna-charon
├── src/
│   ├── index.ts              # 主入口
│   ├── config.ts             # 配置定义
│   ├── types.ts              # 类型定义
│   ├── bot-manager.ts        # Bot 管理器
│   └── interceptors/
│       ├── room.ts           # Room 隔离拦截器
│       ├── preset.ts         # 预设注入拦截器
│       ├── command.ts        # 指令兼容拦截器
│       └── memory.ts         # 长期记忆拦截器
└── client/                   # 控制台前端
    ├── index.ts
    └── config.vue
```

## 注意事项

1. 确保 `multiBotIsolation` 配置与 ChatLuna 的配置一致
2. 使用 `chatluna-character` 模式时，需要确保 chatluna-character 插件已安装
3. 长期记忆隔离功能需要 chatluna-long-memory 插件支持
4. 首次使用时建议先同步 multi-bot-controller 的配置

## License

MIT
