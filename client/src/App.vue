<script setup>
import { computed, onMounted, ref } from 'vue'

const dashboard = ref({ items: [], movements: [], approvals: [], snapshotAt: null })
const loading = ref(true)
const loadError = ref('')
const actionError = ref('')
const actionMessage = ref('')
const saving = ref(false)
const aiBusy = ref(false)
const aiError = ref('')
const aiAnswer = ref('')
const aiSnapshot = ref('')
const aiConfigured = ref(false)
const question = ref('请根据当前库存，按紧急程度给出补货建议，并说明依据。')
const search = ref('')
const zone = ref('全部库区')
const status = ref('全部状态')
const activeSection = ref('overview')
const adminToken = ref('')
const form = ref({ itemId: '', direction: 'OUT', quantity: 1, note: '' })

async function request(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) }
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(data.error || `请求失败 (${response.status})`)
  return data
}

async function refresh() {
  loading.value = true
  loadError.value = ''
  try {
    dashboard.value = await request('/api/dashboard')
    if (!form.value.itemId && dashboard.value.items.length) form.value.itemId = String(dashboard.value.items[0].id)
    const health = await request('/api/health')
    aiConfigured.value = health.aiConfigured
  } catch (error) {
    loadError.value = error.message
  } finally {
    loading.value = false
  }
}

const items = computed(() => dashboard.value.items)
const lowItems = computed(() => items.value.filter(item => item.quantity <= item.minQuantity))
const totalUnits = computed(() => items.value.reduce((sum, item) => sum + item.quantity, 0))
const zones = computed(() => ['全部库区', ...new Set(items.value.map(item => item.zone))])
const filteredItems = computed(() => items.value.filter(item => {
  const term = search.value.trim().toLowerCase()
  const matchesTerm = !term || `${item.name} ${item.sku} ${item.category}`.toLowerCase().includes(term)
  const matchesZone = zone.value === '全部库区' || item.zone === zone.value
  const low = item.quantity <= item.minQuantity
  const matchesStatus = status.value === '全部状态' || (status.value === '需关注' ? low : !low)
  return matchesTerm && matchesZone && matchesStatus
}))
const zoneTotals = computed(() => {
  const totals = new Map()
  items.value.forEach(item => totals.set(item.zone, (totals.get(item.zone) || 0) + item.quantity))
  const max = Math.max(1, ...totals.values())
  return [...totals].sort(([a], [b]) => a.localeCompare(b, 'zh-CN')).map(([name, count]) => ({ name, count, percent: Math.max(6, Math.round(count / max * 100)) }))
})

function formatTime(value) {
  if (!value) return '—'
  return new Intl.DateTimeFormat('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).format(new Date(value))
}

function navigate(id) {
  activeSection.value = id
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

async function submitMovement() {
  actionError.value = ''
  actionMessage.value = ''
  if (!adminToken.value.trim()) { actionError.value = '请先输入管理员口令'; return }
  saving.value = true
  try {
    const result = await request('/api/movements', {
      method: 'POST',
      headers: { 'x-admin-token': adminToken.value.trim() },
      body: JSON.stringify({ ...form.value, itemId: Number(form.value.itemId), quantity: Number(form.value.quantity) })
    })
    actionMessage.value = result.message
    form.value.quantity = 1
    form.value.note = ''
    await refresh()
  } catch (error) { actionError.value = error.message }
  finally { saving.value = false }
}

async function reviewApproval(id, decision) {
  actionError.value = ''
  actionMessage.value = ''
  if (!adminToken.value.trim()) { actionError.value = '请先输入管理员口令'; navigate('operations'); return }
  saving.value = true
  try {
    const result = await request(`/api/approvals/${id}`, {
      method: 'POST',
      headers: { 'x-admin-token': adminToken.value.trim() },
      body: JSON.stringify({ decision })
    })
    actionMessage.value = result.message
    await refresh()
  } catch (error) { actionError.value = error.message }
  finally { saving.value = false }
}

async function askAI() {
  aiError.value = ''
  aiAnswer.value = ''
  if (!adminToken.value.trim()) { aiError.value = '请先输入管理员口令'; return }
  if (!question.value.trim()) { aiError.value = '请输入要分析的问题'; return }
  aiBusy.value = true
  try {
    const result = await request('/api/ai/advice', { method: 'POST', headers: { 'x-admin-token': adminToken.value.trim() }, body: JSON.stringify({ question: question.value.trim() }) })
    aiAnswer.value = result.answer
    aiSnapshot.value = result.snapshotAt
  } catch (error) { aiError.value = error.message }
  finally { aiBusy.value = false }
}

function setQuestion(text) {
  question.value = text
  navigate('ai')
}

onMounted(refresh)
</script>

<template>
  <div class="app-shell">
    <aside class="sidebar" aria-label="主导航">
      <div class="brand"><span class="brand-mark">序</span><div><strong>仓序</strong><small>WAREHOUSE INTELLIGENCE</small></div></div>
      <div class="workspace-label">工作空间 <span>01 / 总仓</span></div>
      <nav class="side-nav">
        <button type="button" :class="{ selected: activeSection === 'overview' }" @click="navigate('overview')"><span class="nav-symbol">▦</span>运营总览</button>
        <button type="button" :class="{ selected: activeSection === 'inventory' }" @click="navigate('inventory')"><span class="nav-symbol">▤</span>实时库存</button>
        <button type="button" :class="{ selected: activeSection === 'operations' }" @click="navigate('operations')"><span class="nav-symbol">⇄</span>出入库操作</button>
        <button type="button" :class="{ selected: activeSection === 'ai' }" @click="navigate('ai')"><span class="nav-symbol">✳</span>AI 决策台</button>
      </nav>
      <div class="sidebar-bottom"><span class="live-dot"></span> 本地工作台 <small>数据来自 MySQL · 模型经服务端接入</small></div>
    </aside>

    <main>
      <header class="topbar"><div class="breadcrumb">工作空间 <span>/</span> 运营总览</div><div class="topbar-actions"><span class="date-label">{{ new Date().toLocaleDateString('zh-CN', { year:'numeric', month:'long', day:'numeric' }) }}</span><button class="icon-button" type="button" aria-label="刷新数据" :disabled="loading" @click="refresh">↻</button></div></header>
      <div class="page-content">
        <section id="overview" class="page-heading"><div><div class="eyebrow">OPERATIONS / LIVE VIEW</div><h1>仓库运营总览</h1><p>把库存状态、操作流程和 AI 建议放在同一条工作线上。</p></div><span class="snapshot" v-if="dashboard.snapshotAt">快照更新于 {{ formatTime(dashboard.snapshotAt) }}</span></section>

        <div v-if="loadError" class="alert alert-error" role="alert"><div><strong>暂时无法读取 MySQL 数据</strong><span>{{ loadError }}。请检查服务端、数据库与环境变量。</span></div><button type="button" @click="refresh">重试</button></div>
        <div v-else-if="loading" class="alert alert-loading" role="status">正在读取仓库实时数据…</div>

        <section class="metric-grid" aria-label="关键指标">
          <article class="metric-card"><div class="metric-top"><span>物资种类</span><span class="metric-icon">▦</span></div><strong>{{ items.length }}</strong><small>个 SKU 正在管理</small></article>
          <article class="metric-card"><div class="metric-top"><span>库存总量</span><span class="metric-icon">◫</span></div><strong>{{ totalUnits.toLocaleString() }}</strong><small>跨 {{ zoneTotals.length }} 个库区</small></article>
          <article class="metric-card alert-metric"><div class="metric-top"><span>低库存预警</span><span class="metric-icon">!</span></div><strong>{{ lowItems.length }}</strong><small>达到或低于安全阈值</small></article>
          <article class="metric-card"><div class="metric-top"><span>待审批</span><span class="metric-icon">◇</span></div><strong>{{ dashboard.approvals.length }}</strong><small>大额出库需人工确认</small></article>
        </section>

        <section class="overview-grid">
          <article class="panel zone-panel"><div class="panel-head"><div><span class="eyebrow">DISTRIBUTION</span><h2>库区分布</h2></div><span class="panel-caption">按库存件数比较</span></div><div class="zone-list" v-if="zoneTotals.length"><div class="zone-row" v-for="item in zoneTotals" :key="item.name"><span class="zone-name">{{ item.name }}</span><div class="bar-track"><div class="bar-fill" :style="{ width: item.percent + '%' }"></div></div><strong>{{ item.count }}</strong></div></div><p v-else class="empty">连接数据库后显示库区数据</p></article>
          <article class="panel attention-panel"><div class="panel-head"><div><span class="eyebrow">ATTENTION</span><h2>需要关注</h2></div><span class="count-pill">{{ lowItems.length }} 项</span></div><div v-if="lowItems.length" class="attention-list"><button type="button" v-for="item in lowItems.slice(0,4)" :key="item.id" @click="setQuestion(`请分析 ${item.name} 的库存风险及补货优先级。`)"><span class="attention-mark">!</span><span><strong>{{ item.name }}</strong><small>{{ item.zone }} · 安全阈值 {{ item.minQuantity }} {{ item.unit }}</small></span><b>{{ item.quantity }} {{ item.unit }}</b></button></div><p v-else class="empty">暂无低库存物资</p></article>
        </section>

        <section id="inventory" class="panel inventory-panel"><div class="panel-head inventory-head"><div><span class="eyebrow">INVENTORY</span><h2>实时库存</h2><p>依据 MySQL 当前数据展示。低于阈值的物资会自动标记。</p></div><div class="filter-row"><input v-model="search" type="search" placeholder="搜索物资、SKU 或分类" aria-label="搜索物资" /><select v-model="zone" aria-label="筛选库区"><option v-for="value in zones" :key="value">{{ value }}</option></select><select v-model="status" aria-label="筛选状态"><option>全部状态</option><option>需关注</option><option>正常</option></select></div></div><div class="table-wrap"><table><thead><tr><th>物资 / SKU</th><th>分类</th><th>库区</th><th>当前库存</th><th>安全阈值</th><th>状态</th></tr></thead><tbody><tr v-for="item in filteredItems" :key="item.id"><td><strong>{{ item.name }}</strong><small>{{ item.sku }}</small></td><td>{{ item.category }}</td><td>{{ item.zone }}</td><td class="quantity">{{ item.quantity }} <small>{{ item.unit }}</small></td><td>{{ item.minQuantity }} {{ item.unit }}</td><td><span class="status-badge" :class="item.quantity <= item.minQuantity ? 'warn' : 'healthy'">{{ item.quantity <= item.minQuantity ? '需关注' : '正常' }}</span></td></tr><tr v-if="!filteredItems.length"><td colspan="6" class="empty-table">{{ items.length ? '没有匹配的物资' : '暂无库存数据' }}</td></tr></tbody></table></div></section>

        <section id="operations" class="operations-grid"><article class="panel operation-panel"><div class="panel-head"><div><span class="eyebrow">WORKFLOW</span><h2>出入库操作</h2><p>单次出库超过 50 件进入审批队列。</p></div></div><form @submit.prevent="submitMovement"><label>管理员口令<input v-model="adminToken" type="password" autocomplete="off" placeholder="只用于本次页面操作，不保存" /></label><div class="form-grid"><label>物资<select v-model="form.itemId" required><option value="" disabled>选择物资</option><option v-for="item in items" :key="item.id" :value="String(item.id)">{{ item.name }} · {{ item.zone }}</option></select></label><label>操作类型<select v-model="form.direction"><option value="OUT">出库</option><option value="IN">入库</option></select></label></div><div class="form-grid"><label>数量<input v-model.number="form.quantity" type="number" min="1" max="1000000" required /></label><label>备注<input v-model="form.note" type="text" maxlength="200" placeholder="例如：生产线领用" /></label></div><button class="primary-button" type="submit" :disabled="saving || !items.length">{{ saving ? '正在提交…' : '提交操作' }} <span>→</span></button></form><p v-if="actionError" class="form-message error" role="alert">{{ actionError }}</p><p v-if="actionMessage" class="form-message success" role="status">{{ actionMessage }}</p></article>
          <article class="panel approval-panel"><div class="panel-head"><div><span class="eyebrow">APPROVALS</span><h2>待审批队列</h2></div><span class="count-pill">{{ dashboard.approvals.length }} 待办</span></div><div v-if="dashboard.approvals.length" class="approval-list"><div class="approval-item" v-for="entry in dashboard.approvals" :key="entry.id"><div><strong>{{ entry.itemName }} <span>出库 {{ entry.quantity }} {{ entry.unit }}</span></strong><small>{{ entry.note || '未填写备注' }} · {{ formatTime(entry.createdAt) }}</small></div><div class="approval-actions"><button type="button" :disabled="saving" @click="reviewApproval(entry.id,'REJECTED')">拒绝</button><button type="button" class="approve" :disabled="saving" @click="reviewApproval(entry.id,'APPROVED')">批准</button></div></div></div><p v-else class="empty">当前没有待审批事项</p></article></section>

        <section id="ai" class="ai-grid"><article class="ai-panel"><div class="ai-title-row"><span class="ai-spark">✳</span><div><span class="eyebrow">AI DECISION DESK</span><h2>让库存数据变成行动建议</h2><p>模型读取当前库存快照并解释风险；不会直接修改库存。</p></div></div><div class="prompt-samples"><button type="button" @click="question='请根据当前库存，按紧急程度给出补货建议，并说明依据。'">补货优先级</button><button type="button" @click="question='哪些物资已低于安全阈值？请列出具体数字。'">风险清单</button><button type="button" @click="question='请总结各库区库存分布，并指出数据不足的地方。'">库区分析</button></div><label class="ai-token">管理员口令<input v-model="adminToken" type="password" autocomplete="off" placeholder="与出入库操作共用，仅保留在当前页面" /></label><label class="sr-only" for="ai-question">向 AI 提问</label><textarea id="ai-question" v-model="question" maxlength="500" rows="3" placeholder="输入需要分析的仓库问题…"></textarea><div class="ai-footer"><span>{{ aiConfigured ? '密钥已填写 · 请用管理员口令分析' : '模型尚未配置 · 请设置服务端环境变量' }}</span><button type="button" :disabled="aiBusy || !aiConfigured || !items.length" @click="askAI">{{ aiBusy ? '分析中…' : '生成建议' }} <span>↗</span></button></div><div v-if="aiError" class="ai-result ai-error" role="alert">{{ aiError }}</div><div v-if="aiAnswer" class="ai-result"><div class="result-meta"><strong>AI 分析建议</strong><span>依据 {{ formatTime(aiSnapshot) }} 的库存快照</span></div><div class="answer-text">{{ aiAnswer }}</div><small>建议仅供决策参考；出入库与审批仍需人工执行。</small></div></article>
          <article class="panel activity-panel"><div class="panel-head"><div><span class="eyebrow">ACTIVITY</span><h2>最近操作</h2></div></div><ol v-if="dashboard.movements.length" class="activity-list"><li v-for="entry in dashboard.movements" :key="entry.id"><span class="activity-icon" :class="entry.direction === 'IN' ? 'in' : 'out'">{{ entry.direction === 'IN' ? '↙' : '↗' }}</span><div><strong>{{ entry.itemName }} {{ entry.direction === 'IN' ? '入库' : '出库' }} {{ entry.quantity }} {{ entry.unit }}</strong><small>{{ entry.note || '无备注' }}</small></div><time>{{ formatTime(entry.createdAt) }}</time></li></ol><p v-else class="empty">操作记录将在这里显示</p></article></section>
        <footer>仓序 · 基于数据结构实验二重构的 AI Web 作品原型 <span>Vue + Node API + MySQL</span></footer>
      </div>
    </main>
  </div>
</template>
