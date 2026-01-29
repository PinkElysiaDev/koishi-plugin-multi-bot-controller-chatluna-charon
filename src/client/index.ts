import {} from '@koishijs/console'

export default {
  id: 'multi-bot-controller-chatluna-charon',
  name: '多 Bot 人设配置',
  authority: 4,
  component: () => import('./config.vue'),
}

// 类型声明
declare module '@koishijs/console' {
  interface Interfaces {
    'multi-bot-controller-chatluna-charon': {
      bots: BotPersonaConfig[]
      presets: PresetInfo[]
      models: ModelInfo[]
    }
  }
}

import type { BotPersonaConfig, PresetInfo, ModelInfo } from '../types'
