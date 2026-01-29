// src/interceptors/room.ts
import { randomUUID } from 'crypto'
import { Context } from 'koishi'
import { BotManager } from '../bot-manager'
import { BotPersonaConfig } from '../types'

/**
 * Room 隔离拦截器
 * 负责为 Bot 创建独立的 template room
 * 注意：ChatLuna 的 chain 对象不直接暴露 room 管理方法
 * 我们使用数据库操作直接管理 room
 */
export class RoomInterceptor {
  private readonly logger: ReturnType<Context['logger']>
  private hooks: Array<() => void> = []

  constructor(
    private ctx: Context,
    private botManager: BotManager,
    private config: {
      autoCreateTemplateRooms: boolean
      debug: boolean
    }
  ) {
    this.logger = ctx.logger('charon:room')
  }

  /**
   * 启动拦截器
   */
  async start(): Promise<void> {
    this.debug('启动 Room 隔离拦截器...')

    // 等待 ChatLuna 加载完成后再设置所有钩子
    const readyDispose = this.ctx.on('chatluna/ready', () => {
      // 监听 bot 状态变化，为新的 bot 创建 template room
      // 在 chatluna/ready 后设置，确保 database 服务已就绪
      const botStatusDispose = this.ctx.on('bot-status-updated', async (bot) => {
        await this.handleBotStatusUpdate(bot)
      })
      this.hooks.push(botStatusDispose)

      this.debug('Room 钩子已安装，bot-status-updated 监听已启用')
    })
    this.hooks.push(readyDispose)
  }

  /**
   * 创建 bot 特定的 conversationId
   */
  private createBotConversationId(botId: string): string {
    // 使用 botId 和时间戳创建唯一的 conversationId
    const timestamp = Date.now()
    const random = Math.random().toString(36).substring(2, 8)
    return `bot_${botId}_${timestamp}_${random}`
  }

  /**
   * 处理 bot 状态更新
   */
  private async handleBotStatusUpdate(bot: any): Promise<void> {
    const selfId = bot.selfId
    const platform = bot.platform
    const botId = this.botManager.getBotId(platform, selfId)

    const botConfig = this.botManager.getBotConfig(botId)

    if (!botConfig || !botConfig.enabled) {
      return
    }

    // 检查是否已初始化
    const status = this.botManager.getBotStatus(botId)
    if (status?.initialized) {
      return
    }

    // 为 bot 创建 template room
    if (this.config.autoCreateTemplateRooms) {
      await this.createTemplateRoomForBot(botConfig)
    }

    // 标记为已初始化
    this.botManager.setBotStatus(botId, { initialized: true })
  }

  /**
   * 为 bot 创建独立的 template room
   * 直接使用数据库操作，不依赖 chain
   */
  private async createTemplateRoomForBot(botConfig: BotPersonaConfig): Promise<void> {
    const botId = botConfig.botId
    const { platform, selfId } = this.botManager.parseBotId(botId)

    this.debug(`正在为 Bot ${botId} 创建模板房间`)

    try {
      // 检查是否已存在 template room
      const existingRooms = await this.ctx.database.get('chathub_room', {
        roomName: `模板房间_${botId}`,
      })

      if (existingRooms.length > 0) {
        this.debug(`Bot ${botId} 的模板房间已存在，跳过创建`)
        this.botManager.setBotStatus(botId, {
          templateRoomId: existingRooms[0].roomId,
        })
        return
      }

      // 获取当前最大的 roomId
      const rooms = await this.ctx.database.get('chathub_room', {})
      const maxRoomId = rooms.reduce((max, room) => Math.max(max, room.roomId), 0)

      // 创建 bot 特定的 template room
      const roomName = `模板房间_${botId}`

      // 注意：ChatLuna 的 chathub_room 表没有 botId 字段
      // 我们通过 roomName 来标识 bot 特定的 room（格式: 模板房间_${botId}）

      // 生成 bot 特定的 conversationId（与 chain.ts 保持一致）
      // 格式: bot_{platform}:{selfId}_{uuid}，确保每个 bot 有独立的上下文
      const conversationId = `bot_${botId}_${randomUUID()}`

      // 解析预设名称（不带前缀）
      // 注意：对于 character 预设，这里不会创建 template room
      // 因为 character 预设会在 chain 中被拦截，不会执行到这里
      const { name: presetName, source } = this.botManager.parsePresetName(botConfig.preset)

      // 对于 character 预设，跳过 template room 创建
      // character 插件有自己的消息处理系统，不需要 ChatLuna 的 room
      if (source === 'character') {
        this.logger.info(`[CharonRoom] Bot ${botId} 使用 character 预设，跳过 template room 创建`)
        this.botManager.setBotStatus(botId, { initialized: true })
        return
      }

      const newRoom: any = {
        roomId: maxRoomId + 1,
        roomName,
        roomMasterId: selfId,
        conversationId, // 使用带 botId 前缀的 conversationId
        preset: presetName,  // 使用不带前缀的预设名
        model: botConfig.model,
        chatMode: botConfig.chatMode || 'chat',
        visibility: 'template_clone',
        password: '',
        updatedTime: new Date(),
        // 关键：设置 autoUpdate: false，防止 ChatLuna 覆盖我们的配置
        autoUpdate: false,
      }

      // 直接创建 room 记录
      await this.ctx.database.create('chathub_room', newRoom)

      // 创建 room 成员记录（房主）
      await this.ctx.database.create('chathub_room_member', {
        userId: selfId,
        roomId: newRoom.roomId,
        roomPermission: 'owner',
      })

      this.botManager.setBotStatus(botId, {
        templateRoomId: newRoom.roomId,
      })

      this.logger.info(`已为 Bot ${botId} 创建模板房间: ${roomName} (roomId: ${newRoom.roomId})`)
    } catch (error) {
      this.logger.error(`为 Bot ${botId} 创建模板房间失败:`, error)
      this.botManager.setBotStatus(botId, {
        error: String(error),
      })
    }
  }

  /**
   * 停止拦截器
   */
  stop(): void {
    for (const dispose of this.hooks) {
      dispose()
    }
    this.hooks = []
  }

  /**
   * 输出调试日志
   */
  private debug(...args: unknown[]): void {
    if (this.config.debug) {
      this.logger.debug(args as any)
    }
  }
}
