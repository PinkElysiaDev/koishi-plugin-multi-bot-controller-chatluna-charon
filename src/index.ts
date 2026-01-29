// src/index.ts
import { Context, Schema } from 'koishi'
import {} from '@koishijs/plugin-server'
import { createConfig, Config, updateBotIdOptions } from './config'
import { BotManager } from './bot-manager'
import { RoomInterceptor } from './interceptors/room'
import { ChainInterceptor } from './interceptors/chain'
import { MemoryInterceptor } from './interceptors/memory'
import type { BotPersonaConfig } from './types'

export const name = 'multi-bot-controller-chatluna-charon'

// 声明服务依赖
export const inject = {
    required: ['chatluna', 'multi-bot-controller', 'database'],
    optional: ['chatluna_character', 'server'],
}

export { Config }
export * from './types'

// 导出动态 Schema 创建函数
export { createConfig }

export const usage = `

## 工作原理

本插件为每个 Bot 配置独立的 ChatLuna 人设（预设和模型），实现多 Bot 不同人设的隔离。

### 前置要求

**重要：使用本插件前，请确保在 ChatLuna 配置中开启「自动为用户创建新 room」选项。**

本插件依赖独立的 Room 来实现多 Bot 人设隔离，如果未开启该选项，插件无法正常工作。

### Room 命名规则

- 每个 Bot 自动创建独立的 Template Room
- Room 名称格式: 模板房间_{platform}:{selfId}
- ConversationId 格式: bot_{platform}:{selfId}_{timestamp}_{random}

### 配置说明

1. Bot ID 格式: platform:selfId（如 onebot:123456）
2. 预设选择:
   - 自动从 ChatLuna 和 character（已启用时）加载预设
   - 预设名称标注来源，如 \`预设名 (ChatLuna)\` 或 \`预设名 (character)\`
3. 模型选择: 从 ChatLuna 已配置的模型中选择
4. 模式选择:
   - chat: 聊天模式
   - agent: 插件模式

---

`

export function apply(ctx: Context, config: Config): void {
  // 创建 logger
  const logger = ctx.logger('charon')

  logger.info('多 Bot 人设控制器插件正在启动...')

  // 用于存储需要手动清理的 dispose 函数（如 clearTimeout）
  const manualDisposes: Array<() => void> = []

  // ========================================
  // 动态 Schema 更新服务
  // 从 multi-bot-controller 获取已配置的 bot 列表
  // ========================================
  class BotSchemaService {
    private knownBots: Set<string> = new Set()
    private debounceTimer: NodeJS.Timeout | null = null

    constructor(private ctx: Context, private logger: ReturnType<Context['logger']>) {
      // 立即扫描一次
      const scanTimer = setTimeout(() => this.scanFromMBC(), 500)
      manualDisposes.push(() => clearTimeout(scanTimer))

      // 监听 MBC 的 bot 配置更新事件
      // Koishi 会自动清理这些事件监听器
      this.ctx.on('multi-bot-controller/bots-updated', () => this.scheduleScan())

      // 作为备选，监听 bot 变化
      this.ctx.on('bot-added', () => this.scheduleScan())
      this.ctx.on('bot-removed', () => this.scheduleScan())
      this.ctx.on('ready', () => this.scheduleScan())
    }

    private scheduleScan() {
      if (this.debounceTimer) clearTimeout(this.debounceTimer)
      this.debounceTimer = setTimeout(() => this.scanFromMBC(), 200)
    }

    private scanFromMBC() {
      try {
        // 从 MBC 服务获取 bot 列表
        const bots = this.ctx['multi-bot-controller'].getBots()
        // 过滤出已启用的 bot
        const enabledBots = bots.filter(b => b.enabled)
        const botIds = enabledBots.map(b => `${b.platform}:${b.selfId}`).sort()

        // 检查是否有变化
        const currentSet = new Set(botIds)
        if (this.setsEqual(this.knownBots, currentSet)) {
          return
        }

        this.knownBots = currentSet
        this.updateBotSchema(botIds)

        this.logger.info(`Bot 列表已更新，共 ${botIds.length} 个可用`)
      } catch (error) {
        this.logger.warn('从 multi-bot-controller 获取 Bot 列表失败:', error)
      }
    }

    private setsEqual(a: Set<string>, b: Set<string>): boolean {
      if (a.size !== b.size) return false
      for (const item of a) {
        if (!b.has(item)) return false
      }
      return true
    }

    private updateBotSchema(botIds: string[]) {
      // 使用 ctx.schema.set 动态更新 Schema
      updateBotIdOptions(this.ctx, botIds)
      this.logger.info(`Bot 选择列表已更新，共 ${botIds.length} 个选项`)
    }
  }

  // 启动 Schema 服务
  const botSchemaService = new BotSchemaService(ctx, logger)

  // 初始化 BotManager，使用配置中的 bots 列表
  const botManager = new BotManager(
    ctx,
    config.bots,
    {
      debug: config.debug,
      verboseLogging: config.verboseLogging,
    }
  )

  // 预设加载防抖：避免短时间内重复加载
  let presetLoadTimer: NodeJS.Timeout | null = null

  const schedulePresetLoad = () => {
    if (presetLoadTimer) clearTimeout(presetLoadTimer)
    presetLoadTimer = setTimeout(async () => {
      await botManager.loadPresets()
      presetLoadTimer = null
    }, 1000)
  }

  // ========================================
  // Bot 配置注册（必须尽早执行，在 character 开始处理消息之前）
  // ========================================

  /**
   * 尝试注册 Bot 配置到 character 插件
   * @returns 是否成功注册
   */
  function tryRegisterBotConfigs(): boolean {
    if (!ctx.chatluna_character) {
      return false
    }

    for (const botConfig of botManager.getConfig()) {
      const botId = botConfig.botId
      const preset = botConfig.preset
      const model = botConfig.model

      if (preset || model) {
        // 统一使用 BotManager.parsePresetName() 解析预设名称
        const { name: cleanPreset } = botManager.parsePresetName(preset || '')

        ctx.chatluna_character.botConfig.setBotConfig(botId, {
          preset: cleanPreset || undefined,
          model
        })
        logger.info(
          `[Charon] 注册 Bot ${botId} 配置: preset="${cleanPreset}", model="${model}"`
        )
      }
    }
    return true
  }

  /**
   * 设置 character 插件就绪监听器
   * 使用事件驱动替代轮询，支持各种加载顺序和重载场景：
   * - charon 在 character 之前加载：监听 ready 事件后注册
   * - charon 在 character 之后加载：立即尝试注册
   * - charon 重载：监听器重新注册，等待下次 ready 事件
   * - character 重载：触发 ready 事件，重新注册配置
   */
  function setupCharacterPluginListener() {
    // 立即尝试一次（处理 character 已就绪的情况）
    if (tryRegisterBotConfigs()) {
      logger.info('[Charon] Bot 配置已注册到 character 插件')
    }

    // 监听 character 插件就绪事件（处理 character 尚未就绪或重载的情况）
    // Koishi 会在插件 unload 时自动清理通过 ctx.on 注册的监听器
    ctx.on('chatluna_character/ready', () => {
      if (tryRegisterBotConfigs()) {
        logger.info('[Charon] Bot 配置已注册到 character 插件')
      }
    })
  }

  // 立即开始尝试注册配置（在 character 插件初始化时）
  setupCharacterPluginListener()

  // 加载预设和模型列表
  // Koishi 会自动清理这些事件监听器
  ctx.on('chatluna/ready', async () => {
    await botManager.loadModels()
    schedulePresetLoad()
  })

  // character 可能在 chatluna 之后才就绪，监听其就绪事件
  ctx.on('chatluna_character/ready', async () => {
    schedulePresetLoad()
  })

  // 监听 ChatLuna 预设配置变更（通过 service 配置更新事件）
  ctx.on('config-updated', async (plugin: string) => {
    if (plugin === 'chatluna' || plugin === 'chatluna-character') {
      schedulePresetLoad()
    }
  })

  // 注意：不能监听 preset_updated 事件，否则会造成循环：
  // schedulePresetLoad -> loadPresets -> getAllPreset -> preset_updated -> schedulePresetLoad ...

  // 插件完全就绪后最后尝试加载一次预设
  ctx.on('ready', () => {
    const timer = setTimeout(() => {
      schedulePresetLoad()
    }, 1500)
    manualDisposes.push(() => clearTimeout(timer))
  })

  // 启动各个拦截器（始终启用多 Bot 隔离和自动创建 Room）
  // ChainInterceptor: 在 ChatLuna 的 resolve_room 之前运行，确保使用 Bot 特定的 room
  const chainInterceptor = new ChainInterceptor(ctx, botManager, {
    debug: config.debug,
    verboseLogging: config.verboseLogging,
  })

  // RoomInterceptor: 为每个 Bot 创建独立的 template room
  const roomInterceptor = new RoomInterceptor(ctx, botManager, {
    autoCreateTemplateRooms: true,
    debug: config.debug,
  })

  const memoryInterceptor = new MemoryInterceptor(ctx, botManager, {
    isolateLongMemory: true,
    debug: config.debug,
  })

  // 启动拦截器
  chainInterceptor.start()
  roomInterceptor.start()
  memoryInterceptor.start()
  logger.info('拦截器初始化完成')

  // 注册控制台扩展
  ctx.on('ready', async () => {
    const consoleService = ctx.get('console') as any
    if (consoleService) {
      registerConsoleExtensions(ctx, botManager, logger, consoleService)
    }
  })

  // 注册调试指令
  registerDebugCommands(ctx, botManager, logger, tryRegisterBotConfigs)

  // ========================================
  // 插件停用时清理
  // ========================================
  ctx.on('dispose', async () => {
    logger.info('Charon 插件正在停止...')

    // 停止所有拦截器
    chainInterceptor.stop()
    roomInterceptor.stop()
    memoryInterceptor.stop()
    logger.info('所有拦截器已停止')

    // 清理手动管理的资源
    for (const dispose of manualDisposes) {
      try {
        dispose()
      } catch (error) {
        logger.warn('清理手动资源时出错:', error)
      }
    }
    manualDisposes.length = 0
    logger.info('手动资源已清理')

    logger.info('Charon 插件已完全停止')
  })
}

/**
 * 注册控制台扩展
 */
function registerConsoleExtensions(ctx: Context, botManager: BotManager, logger: any, consoleService: any): void {
  const { assets } = consoleService

  // 添加脚本和样式
  assets?.forEach((asset: any) => {
    if (asset.type === 'style') {
      asset.children.push({
        type: 'style',
        children: '.charon-status { padding: 8px 12px; background: var(--color-bg-2); border-radius: 4px; margin: 8px 0; }',
      })
    }
  })

  // 添加状态监控扩展
  consoleService.addEntry({
    dev: __dirname + '/src/client/index.ts',
    prod: __dirname + '/dist',
  })

  // 注册 HTTP 处理器供前端调用（需要 server 插件）
  if (ctx.server) {
    ctx.server.get('/multi-bot-controller-chatluna-charon/data', async () => {
      return {
        bots: botManager.getBotsConfig(),
        presets: botManager.getPresets(),
        models: botManager.getModels(),
      }
    })

    ctx.server.post('/multi-bot-controller-chatluna-charon/bot-update', async ({ data }) => {
      const botConfig: BotPersonaConfig = data
      botManager.updateBotConfig(botConfig)
      return { success: true }
    })
  } else {
    logger.warn('server 插件未安装，控制台 UI 将无法使用')
  }
}

/**
 * 注册调试指令
 */
function registerDebugCommands(
  ctx: Context,
  botManager: BotManager,
  logger: any,
  registerBotConfigsToCharacter: () => void
): void {
  // 查看所有 bot 状态
  ctx.command('charon.status', '查看所有 bot 的人设配置状态', { authority: 4 })
    .action(() => {
      const bots = botManager.getAllBotStatus()

      if (bots.length === 0) {
        return '当前没有配置任何 bot'
      }

      let output = `Bot 人设配置状态（共 ${bots.length} 个）：\n\n`

      for (const bot of bots) {
        output += `## ${bot.botId}\n`
        output += `- 状态: ${bot.initialized ? '已初始化' : '未初始化'}\n`
        output += `- 当前预设: ${bot.currentPreset || '未设置'}\n`
        output += `- 当前模型: ${bot.currentModel || '未设置'}\n`
        output += `- Template Room: ${bot.templateRoomId || '未创建'}\n`
        output += '\n'
      }

      return output.trim()
    })

  // 手动重新加载预设和模型
  ctx.command('charon.reload', '重新加载预设和模型列表', { authority: 4 })
    .action(async () => {
      await botManager.loadPresets()
      await botManager.loadModels()
      // 重新注册到 character 插件
      registerBotConfigsToCharacter()
      return '预设和模型列表已重新加载'
    })

  // 测试 Bot 配置是否正确注册到 character
  ctx.command('charon.test', '测试 character 插件的 Bot 配置', { authority: 4 })
    .action(() => {
      if (!ctx.chatluna_character) {
        return 'character 插件未加载'
      }

      const allConfigs = ctx.chatluna_character.botConfig.getAllConfigs()
      const configCount = Object.keys(allConfigs).length

      if (configCount === 0) {
        return '没有注册任何 Bot 配置到 character 插件'
      }

      let output = `已注册的 Bot 配置（共 ${configCount} 个）：\n\n`
      for (const [botId, config] of Object.entries(allConfigs)) {
        output += `- ${botId}: preset="${config.preset}", model="${config.model}"\n`
      }

      return output.trim()
    })
}
