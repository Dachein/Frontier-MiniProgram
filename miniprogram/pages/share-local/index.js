const PieceService = require('../../services/piece')

const SHARE_SCHEMA = {
  styles: {
    terminal: { bg: '#141414', text: '#F19928', accent: '#F19928', muted: '#9CA3AF', border: 'rgba(241, 153, 40, 0.2)', brand: '#F19928', font: 'monospace' },
    parchment: { bg: '#F5F1E8', text: '#2C2C2C', accent: '#8B0000', muted: '#8B8B8B', border: 'rgba(139, 0, 0, 0.1)', brand: '#8B0000', font: 'serif' },
    neon: { bg: '#FFFFFF', text: '#000000', accent: '#000000', muted: '#6E6E80', border: 'rgba(0, 0, 0, 0.05)', brand: '#000000', font: 'monospace' },
    pearl: { bg: '#F8F9FA', text: '#212121', accent: '#C2410C', muted: '#9CA3AF', border: 'rgba(194, 65, 12, 0.1)', brand: '#C2410C', font: 'monospace' }
  },
  layout: {
    padding: 32,
    lineHeight: 1.6,
    titleSize: 28,
    questionSize: 18,
    answerSize: 16,
    footerHeight: 200
  }
}

Page({
  data: {
    id: '',
    piece: null,
    currentStyle: 'terminal',
    currentIndex: 0,
    styles: [
      { id: 'terminal', name: 'TERMINAL' },
      { id: 'parchment', name: 'PARCHMENT' },
      { id: 'neon', name: 'NEON' },
      { id: 'pearl', name: 'PEARL' }
    ],
    canvasWidth: 375,
    styleImages: {},
    isRendering: {}
  },

  onLoad(options) {
    const id = decodeURIComponent(options.id || '')
    this.setData({ id })
    this.loadPiece(id)
  },

  onReady() {
    // 🚀 这里是视图层就绪的标志
    this._viewReady = true
    if (this.data.piece) {
      this.renderAllStyles()
    }
  },

  async loadPiece(id) {
    try {
      const piece = await PieceService.getPieceDetail(id)
      this.setData({ piece }, () => {
        // 如果 onLoad 比 onReady 晚，则在这里触发
        if (this._viewReady) {
          this.renderAllStyles()
        }
      })
    } catch (e) {
      wx.showToast({ title: '加载失败', icon: 'none' })
    }
  },

  // 💎 纯净版环境参数获取（彻底告别 deprecated 警告）
  getEnvInfo() {
    try {
      const windowInfo = wx.getWindowInfo ? wx.getWindowInfo() : {}
      const deviceInfo = wx.getDeviceInfo ? wx.getDeviceInfo() : {}
      
      // 🚀 只使用现代分拆接口，不触发 getSystemInfoSync
      return {
        windowWidth: windowInfo.windowWidth || 375,
        pixelRatio: deviceInfo.pixelRatio || windowInfo.pixelRatio || 2
      }
    } catch (e) {
      console.warn('[Render] Environment info fallback used')
      return { windowWidth: 375, pixelRatio: 2 }
    }
  },

  renderAllStyles() {
    // 使用 wx.nextTick 确保在下一个渲染周期触发，给 wx:for 充分的执行时间
    wx.nextTick(() => {
      this.renderStyle(this.data.currentStyle)
      this.data.styles.forEach((style, index) => {
        if (style.id !== this.data.currentStyle) {
          setTimeout(() => this.renderStyle(style.id), (index + 1) * 600)
        }
      })
    })
  },

  renderStyle(styleId, retryCount = 0) {
    if (this.data.styleImages[styleId] || (this.data.isRendering[styleId] && retryCount === 0)) return

    this.setData({ [`isRendering.${styleId}`]: true })
    const { windowWidth, pixelRatio: dpr } = this.getEnvInfo()
    const canvasWidth = windowWidth

    const query = this.createSelectorQuery()
    query.select(`#canvas-${styleId}`).fields({ node: true, size: true }).exec((res) => {
      // 🚀 核心修复：如果找不到节点，进行有限次数的自动重试
      if (!res || !res[0] || !res[0].node) {
        if (retryCount < 3) {
          console.warn(`[Render] Canvas ${styleId} not found, retrying... (${retryCount + 1}/3)`)
          setTimeout(() => this.renderStyle(styleId, retryCount + 1), 200)
        } else {
          this.setData({ [`isRendering.${styleId}`]: false })
          console.error(`[Render] Failed to find canvas node after retries: ${styleId}`)
        }
        return
      }

      const canvas = res[0].node
      const ctx = canvas.getContext('2d')
      const totalHeight = this.calculateHeight(ctx, canvasWidth)
      
      canvas.width = canvasWidth * dpr
      canvas.height = totalHeight * dpr
      ctx.scale(dpr, dpr)
      
      this.doDraw(ctx, styleId, canvasWidth, totalHeight)
      
      setTimeout(() => {
        wx.canvasToTempFilePath({
          canvas,
          destWidth: canvasWidth * 2,
          destHeight: totalHeight * 2,
          success: (res) => {
            this.setData({
              [`styleImages.${styleId}`]: res.tempFilePath,
              [`isRendering.${styleId}`]: false
            })
          },
          fail: () => {
            this.setData({ [`isRendering.${styleId}`]: false })
          }
        })
      }, 150)
    })
  },

  calculateHeight(ctx, width) {
    const { layout } = SHARE_SCHEMA
    const { piece } = this.data
    const contentWidth = width - layout.padding * 2
    const title = piece.metadata?.title_zh || piece.metadata?.title || piece.filename || 'Untitled'
    
    let y = 80
    ctx.font = `bold ${layout.titleSize}px sans-serif`
    y += this.measureWrapHeight(ctx, title, contentWidth, layout.titleSize * layout.lineHeight)
    y += 60
    piece.key_takeaways?.forEach(item => {
      y += 40
      ctx.font = `bold ${layout.questionSize}px sans-serif`
      y += this.measureWrapHeight(ctx, item.question, contentWidth - 50, layout.questionSize * layout.lineHeight)
      y += 12
      ctx.font = `${layout.answerSize}px sans-serif`
      y += this.measureWrapHeight(ctx, item.answer, contentWidth - 50, layout.answerSize * layout.lineHeight)
      y += 40
    })
    return y + layout.footerHeight
  },

  measureWrapHeight(ctx, text, maxWidth, lineHeight) {
    if (!text) return 0
    let lines = 1, line = ''
    for (let char of text) {
      let test = line + char
      if (ctx.measureText(test).width > maxWidth) {
        line = char; lines++
      } else {
        line = test
      }
    }
    return lines * lineHeight
  },

  doDraw(ctx, styleId, width, height) {
    const { piece } = this.data
    const config = SHARE_SCHEMA.styles[styleId]
    const layout = SHARE_SCHEMA.layout
    const padding = layout.padding
    const contentWidth = width - padding * 2
    const title = piece.metadata?.title_zh || piece.metadata?.title || piece.filename || 'Untitled'

    ctx.fillStyle = config.bg
    ctx.fillRect(0, 0, width, height)

    let currentY = 80
    ctx.fillStyle = config.text
    ctx.font = `bold ${layout.titleSize}px sans-serif`
    ctx.textBaseline = 'top'
    currentY = this.drawWrapText(ctx, title, padding, currentY, contentWidth, layout.titleSize * layout.lineHeight)

    currentY += 60
    piece.key_takeaways?.forEach((item, index) => {
      ctx.strokeStyle = config.border
      ctx.setLineDash([4, 4])
      ctx.beginPath()
      ctx.moveTo(padding, currentY - 20)
      ctx.lineTo(width - padding, currentY - 20)
      ctx.stroke()
      ctx.setLineDash([])

      ctx.fillStyle = config.accent
      ctx.font = `bold ${layout.questionSize}px ${config.font}`
      ctx.fillText((index + 1).toString().padStart(2, '0'), padding, currentY)
      
      ctx.font = `bold ${layout.questionSize}px sans-serif`
      currentY = this.drawWrapText(ctx, item.question, padding + 50, currentY, contentWidth - 50, layout.questionSize * layout.lineHeight)
      
      currentY += 12
      ctx.fillStyle = config.text
      ctx.font = `${layout.answerSize}px sans-serif`
      currentY = this.drawWrapText(ctx, item.answer, padding + 50, currentY, contentWidth - 50, layout.answerSize * layout.lineHeight)
      currentY += 40
    })

    ctx.textAlign = 'center'
    currentY += 40
    ctx.fillStyle = config.brand
    ctx.font = `bold 24px ${config.font}`
    ctx.fillText(styleId === 'terminal' ? '> metaAlpha' : 'metaAlpha', width / 2, currentY)
    currentY += 40
    ctx.fillStyle = config.muted
    ctx.font = `11px ${config.font}`
    ctx.fillText('ESTABLISHING IMAGES TO EXPRESS MEANING', width / 2, currentY)
    ctx.textAlign = 'left'
  },

  drawWrapText(ctx, text, x, y, maxWidth, lineHeight) {
    if (!text) return y
    let line = '', curY = y
    for (let char of text) {
      let test = line + char
      if (ctx.measureText(test).width > maxWidth) {
        ctx.fillText(line, x, curY)
        line = char; curY += lineHeight
      } else {
        line = test
      }
    }
    ctx.fillText(line, x, curY)
    return curY + lineHeight
  },

  onSwiperChange(e) {
    const index = e.detail.current
    const styleId = this.data.styles[index].id
    this.setData({ currentIndex: index, currentStyle: styleId })
    wx.vibrateShort()
  },

  scrollToStyle(e) {
    const index = e.currentTarget.dataset.index
    this.setData({ currentIndex: index })
  },

  handleSave() {
    const path = this.data.styleImages[this.data.currentStyle]
    if (!path) return
    wx.showLoading({ title: '保存中...', mask: true })
    wx.saveImageToPhotosAlbum({
      filePath: path,
      success: () => {
        wx.hideLoading()
        wx.showToast({ title: '已保存至相册', icon: 'success' })
      },
      fail: (err) => {
        wx.hideLoading()
        if (err.errMsg.indexOf('auth') > -1) wx.openSetting()
      }
    })
  },

  handleMoments() { this.handleSave() },
  
  onShareAppMessage() {
    return {
      title: this.data.piece?.metadata?.title || 'metaAlpha Share',
      path: `/pages/piece/index?id=${this.data.id}`,
      imageUrl: this.data.styleImages[this.data.currentStyle] || ''
    }
  }
})
