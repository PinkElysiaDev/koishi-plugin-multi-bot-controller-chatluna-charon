<!-- src/client/config.vue -->
<template>
  <div class="charon-config">
    <h2>多 Bot 人设配置</h2>

    <!-- 说明 -->
    <div class="info-section">
      <p>在此为每个 Bot 配置独立的预设和模型。Bot 列表会自动从 multi-bot-controller 同步。</p>
    </div>

    <!-- Bot 列表 -->
    <div class="bot-list">
      <div v-for="bot in bots" :key="bot.botId" class="bot-card">
        <div class="bot-header">
          <span class="bot-name">{{ bot.botId }}</span>
          <el-switch v-model="bot.enabled" @change="onBotToggle(bot)" />
        </div>

        <div class="bot-config">
          <!-- 预设选择 -->
          <el-form-item label="预设">
            <el-select
              v-model="bot.preset"
              placeholder="选择预设"
              filterable
              @change="onBotConfigChange(bot)"
            >
              <el-option
                v-for="preset in presets"
                :key="preset.name"
                :label="preset.label || preset.name"
                :value="preset.name"
              />
            </el-select>
          </el-form-item>

          <!-- 模型选择 -->
          <el-form-item label="模型">
            <el-select
              v-model="bot.model"
              placeholder="选择模型"
              filterable
              @change="onBotConfigChange(bot)"
            >
              <el-option
                v-for="model in models"
                :key="model.name"
                :label="model.label || model.name"
                :value="model.name"
              />
            </el-select>
          </el-form-item>

          <!-- 聊天模式 -->
          <el-form-item label="聊天模式">
            <el-select v-model="bot.chatMode" @change="onBotConfigChange(bot)">
              <el-option label="聊天模式" value="chat" />
              <el-option label="Agent 模式" value="plugin" />
            </el-select>
          </el-form-item>
        </div>
      </div>
    </div>

    <!-- 空状态 -->
    <div v-if="bots.length === 0" class="empty-state">
      <p>暂无 Bot 配置</p>
      <p>请先在 multi-bot-controller 中配置 Bot，然后在此添加人设配置</p>
      <el-button @click="refreshData">刷新</el-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import type { BotPersonaConfig, PresetInfo, ModelInfo } from '../types'

const bots = ref<BotPersonaConfig[]>([])
const presets = ref<PresetInfo[]>([])
const models = ref<ModelInfo[]>([])

// API 基础路径
const API_BASE = '/multi-bot-controller-chatluna-charon'

// 刷新数据
async function refreshData() {
  try {
    const res = await fetch(`${API_BASE}/data`)
    const data = await res.json()
    bots.value = data.bots || []
    presets.value = data.presets || []
    models.value = data.models || []
  } catch (error) {
    console.error('Failed to refresh data:', error)
  }
}

// Bot 配置变更
async function onBotToggle(bot: BotPersonaConfig) {
  await fetch(`${API_BASE}/bot-update`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(bot),
  })
}

async function onBotConfigChange(bot: BotPersonaConfig) {
  await fetch(`${API_BASE}/bot-update`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(bot),
  })
}

// 初始化数据
refreshData()
</script>

<style scoped>
.charon-config {
  padding: 16px;
}

.info-section {
  padding: 12px;
  background: var(--color-bg-1);
  border-radius: 4px;
  margin-bottom: 16px;
  color: var(--fg2);
}

.bot-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.bot-card {
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 12px;
}

.bot-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.bot-name {
  font-weight: bold;
}

.bot-config {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.empty-state {
  text-align: center;
  padding: 32px 16px;
  color: var(--fg3);
}
</style>
