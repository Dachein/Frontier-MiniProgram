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
    
    // 从 URL 中解析出基础 URL 和 pieceId
    const urlObj = url.split('?')[0]
    const pieceId = urlObj.split('/').pop()
    
    this.setData({ 
      url, 
      baseUrl: urlObj,
      pieceId 
    })
  },

  switchStyle(e) {
    const style = e.currentTarget.dataset.style
    const newUrl = `${this.data.baseUrl}?mode=share-image&style=${style}`
    this.setData({ 
      currentStyle: style,
      url: newUrl 
    })
  },

  async handleSave() {
    if (this.data.isGenerating) return
    
    this.setData({ isGenerating: true })
    wx.showLoading({ title: 'Generating...', mask: true })
    
    try {
      const resp = await request('GET', `/pieces/${this.data.pieceId}/share-image?style=${this.data.currentStyle}`)
      if (resp && resp.success && resp.image_url) {
        // 下载并保存图片
        wx.downloadFile({
          url: resp.image_url,
          success: (res) => {
            if (res.statusCode === 200) {
              wx.saveImageToPhotosAlbum({
                filePath: res.tempFilePath,
                success: () => {
                  wx.showToast({ title: 'Saved!', icon: 'success' })
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
    // 转发通常需要返回上一页或者通过 onShareAppMessage
    wx.showToast({ title: 'Forwarding...', icon: 'none' })
  },

  handleMessage(e) {
    console.log('Message from H5:', e.detail.data)
  }
})

