const PieceService = require('../../services/piece')
const { request } = require('../../utils/api')
const md = require('../../utils/md.js')

// Markdown 标签样式配置 - 全量 Token 化
const MARKDOWN_STYLE = {
  p: 'font-size: var(--fs-card); line-height: var(--lh-std); color: var(--content-text); margin-bottom: var(--space-md);',
  strong: 'font-weight: var(--fw-bold); color: var(--content-bold);',
  li: 'margin-bottom: 0.4em; color: var(--content-text); font-size: var(--fs-card);',
  ul: 'margin: 0; padding: 0;'
}

Page({
  data: {
    id: '',
    piece: null,
    title: 'Piece',
    badge: '—',
    badgeType: 'DEFAULT',
    source: 'SOURCE',
    author: '',
    timeText: '—',
    tags: [],
    
    // Data List
    takeaways: [],
    
    // States
    hasTakeaways: false,
    streaming: false,
    error: '',
    
    // Styles
    markdownStyle: MARKDOWN_STYLE
  },

  // 💓 掌控节奏的内部状态
  _internal: {
    fullTakeaways: [],   // 服务器推送回来的全量最新快照
    pacingTimer: null,   // 掌控节奏的定时器
    isStreamComplete: false
  },

  async onLoad(query) {
    const id = query.id
    this.setData({ id })
    await this.load()
  },

  async onPullDownRefresh() {
    try {
      await this.load()
    } finally {
      wx.stopPullDownRefresh()
    }
  },

  async load() {
    try {
      const piece = await PieceService.getPieceDetail(this.data.id)
      
      const meta = piece.metadata || {}
      const title = meta.title_zh || meta.title || piece.filename || 'Untitled'
      let takeaways = Array.isArray(piece.key_takeaways) ? piece.key_takeaways : []
      
      takeaways = takeaways.map(item => ({
        ...item,
        answerHtml: md.parse(item.answer)
      }))
      
      this.setData({
        piece,
        title,
        badge: PieceService._toBadge(piece),
        badgeType: PieceService._toBadgeType(piece),
        source: PieceService._toSource(piece),
        author: meta.author || '',
        timeText: PieceService._formatFullTime(piece.created_at || piece.extracted_at),
        tags: piece.ai_extracted_tags || [],
        takeaways,
        hasTakeaways: takeaways.length > 0,
        error: '',
      })

      wx.setNavigationBarTitle({ title })
      
      if (takeaways.length === 0) {
        this.startStream()
      }
    } catch (e) {
      this.setData({ error: e.message || 'Piece load failed' })
    }
  },

  startStream() {
    if (this.data.streaming) return
    
    const token = wx.getStorageSync('token')
    if (!token) {
      wx.setStorageSync('redirectAfterLogin', `/pages/piece/index?id=${encodeURIComponent(this.data.id)}`)
      wx.navigateTo({ url: '/pages/login/index' })
      return
    }

    // 重置内部节奏器状态
    this._internal.fullTakeaways = []
    this._internal.isStreamComplete = false
    this.setData({ takeaways: [], hasTakeaways: false, streaming: true, error: '' })

    const socketTask = PieceService.startExtractStream(this.data.id)

    socketTask.onMessage((msg) => {
      try {
        const payload = JSON.parse(msg.data)
        const { event, data } = payload

        if (event === 'partial') {
          const acc = data.accumulated || {}
          
          // 标题可以快一点，立刻同步
          if ((acc.title_zh || acc.title) && this.data.title !== (acc.title_zh || acc.title)) {
            const t = acc.title_zh || acc.title
            this.setData({ title: t })
            wx.setNavigationBarTitle({ title: t })
          }

          if (Array.isArray(acc.key_takeaways)) {
            // 🤫 悄悄更新全量快照，不打扰当前的播放节奏
            this._internal.fullTakeaways = acc.key_takeaways
            this._startPacing()
          }
        } else if (event === 'complete') {
          this._internal.isStreamComplete = true
          // 注意：不要在这里直接 setData({ streaming: false })
          // 让定时器播完最后一滴数据后再停止
        } else if (event === 'error') {
          this.setData({ error: data?.message || 'stream error', streaming: false })
          this._stopPacing()
        }
      } catch (e) {
        this.setData({ error: 'bad stream message' })
      }
    })

    socketTask.onError(() => {
      this.setData({ error: 'socket error', streaming: false })
      this._stopPacing()
    })

    socketTask.onClose(() => {
      this._internal.isStreamComplete = true
    })
  },

  /**
   * 💓 节奏控制器：像呼吸一样有节奏地把数据释放出来
   */
  _startPacing() {
    if (this._internal.pacingTimer) return

    // 设定 600ms 的更新频率，营造一种“生长感”
    this._internal.pacingTimer = setInterval(() => {
      const full = this._internal.fullTakeaways
      const current = this.data.takeaways
      
      let hasUpdate = false
      const updates = {}

      full.forEach((newItem, index) => {
        const currentItem = current[index]
        const html = md.parse(newItem.answer)

        if (!currentItem) {
          // 只有当卡片已经有实质性内容时（哪怕只是一句话），才让它“砰”地出来
          if (newItem.answer && newItem.answer.length > 2) {
            updates[`takeaways[${index}]`] = { ...newItem, answerHtml: html }
            hasUpdate = true
          }
        } else if (newItem.answer !== currentItem.answer) {
          // 如果卡片已经在屏幕上，且内容在生长，实时同步
          updates[`takeaways[${index}]`] = { ...newItem, answerHtml: html }
          hasUpdate = true
        }
      })

      if (hasUpdate) {
        this.setData({ ...updates, hasTakeaways: true })
        // 移除震动感，保持静默优雅
      }

      // 如果流结束了且数据已经全部同步完，就停下来
      if (this._internal.isStreamComplete && this._allCaughtUp()) {
        this._stopPacing()
      }
    }, 600)
  },

  _allCaughtUp() {
    const full = this._internal.fullTakeaways
    const current = this.data.takeaways
    if (full.length !== current.length) return false
    return full.every((item, idx) => item.answer === current[idx].answer)
  },

  _stopPacing() {
    if (this._internal.pacingTimer) {
      clearInterval(this._internal.pacingTimer)
      this._internal.pacingTimer = null
      this.setData({ streaming: false })
      // 最终的一致性同步，确保数据库状态一致
      this.load()
    }
  },

  handleRegenerate() {
    this.setData({ takeaways: [], hasTakeaways: false })
    this.startStream()
  },

  async handleSaveImage() {
    if (!this.data.id) return
    
    wx.showLoading({ title: 'Generating...', mask: true })
    try {
      const resp = await request('GET', `/pieces/${this.data.id}/share-image`)
      if (!resp || !resp.success || !resp.image_url) {
        throw new Error(resp?.error || 'Failed to generate image')
      }

      // 预览图片
      wx.previewImage({
        urls: [resp.image_url],
        current: resp.image_url
      })
    } catch (e) {
      wx.showToast({ title: e.message || 'Error', icon: 'none' })
    } finally {
      wx.hideLoading()
    }
  },

  onUnload() {
    this._stopPacing()
  },

  /**
   * 转发给朋友/群聊
   */
  onShareAppMessage() {
    const { piece, title } = this.data
    return {
      title: title || 'metaAlpha Signal',
      path: `/pages/piece/index?id=${encodeURIComponent(this.data.id)}`,
      imageUrl: '' // 可以留空，默认截取当前页面，或者后续放我们的 Logo
    }
  }
})
