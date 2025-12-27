const { request } = require('../../utils/api')

Page({
  data: {
    url: '',
    baseUrl: '',
    pieceId: '',
    currentStyle: 'terminal',
    isGenerating: false,
    styles: [
      { id: 'terminal', abbr: 'T', color: '#141414' },
      { id: 'parchment', abbr: 'P', color: '#F5F1E8' },
      { id: 'neon', abbr: 'N', color: '#FFFFFF' },
      { id: 'pearl', abbr: 'L', color: '#F8F9FA' }
    ]
  },

  onLoad(options) {
    const { url, title } = options
    if (title) wx.setNavigationBarTitle({ title })
    
    try {
      // 1. 彻底解码传进来的原始 URL
      const decodedUrl = decodeURIComponent(url)
      // 2. 提取 PieceId 供后续 API 调用
      const pieceId = decodedUrl.split('/piece/')[1]?.split('?')[0]
      
      this.setData({ 
        url: decodedUrl, 
        baseUrl: decodedUrl.split('?')[0],
        pieceId,
        currentStyle: decodedUrl.indexOf('style=') > -1 ? decodedUrl.split('style=')[1].split('&')[0] : 'terminal'
      })
      
      console.log('Final Webview URL:', decodedUrl)
    } catch (e) {
      console.error('Webview Load Error:', e)
    }
  },

  switchStyle(e) {
    const style = e.currentTarget.dataset.style
    // 🚀 简化拼接，去掉多余时间戳，降低 Webview 负担
    const newUrl = `${this.data.baseUrl}?mode=share-image&style=${style}`
    
    if (this.data.currentStyle === style) return

    this.setData({ 
      currentStyle: style,
      url: newUrl 
    })
    
    // ⚡️ 切换时顺便再触发一次该风格的预热请求，双重保险
    request('GET', `/pieces/${this.data.pieceId}/share-image?style=${style}&prewarm=1`).catch(() => {})
  },

  async handleSave() {
    if (this.data.isGenerating) return
    
    this.setData({ isGenerating: true })
    wx.showLoading({ title: 'Generating PNG...', mask: true })
    
    try {
      // 1. 请求高清截图 API (不带 prewarm，确保拿到 R2 URL)
      const resp = await request('GET', `/pieces/${this.data.pieceId}/share-image?style=${this.data.currentStyle}`)
      if (resp && resp.success && resp.image_url) {
        
        // 2. 下载文件到本地临时路径
        wx.downloadFile({
          url: resp.image_url,
          success: (res) => {
            if (res.statusCode === 200) {
              // 3. 保存到系统相册
              wx.saveImageToPhotosAlbum({
                filePath: res.tempFilePath,
                success: () => {
                  wx.showToast({ title: 'Saved to Album', icon: 'success' })
                },
                fail: (err) => {
                  if (err.errMsg.indexOf('auth deny') > -1) {
                    wx.showModal({
                      title: 'Permission Required',
                      content: 'Please allow saving to photos in settings.',
                      success: (res) => {
                        if (res.confirm) wx.openSetting()
                      }
                    })
                  }
                }
              })
            }
          }
        })
      } else {
        throw new Error('Screenshot failed')
      }
    } catch (e) {
      wx.showToast({ title: e.message || 'Error', icon: 'none' })
    } finally {
      this.setData({ isGenerating: false })
      wx.hideLoading()
    }
  },

  handleForward() {
    // 转发图片：由于无法直接通过按钮触发系统转发图片，通常是先生成并保存，或者通过 onShareAppMessage 配合图片 URL
    wx.showActionSheet({
      itemList: ['Save & Share to Moments', 'Save & Send to Chat'],
      success: (res) => {
        this.handleSave() // 引导用户先保存，然后由用户手动分享（或者后续结合云端图片 URL 优化）
      }
    })
  },

  handleMessage(e) {
    console.log('Message from H5:', e.detail.data)
  }
})

