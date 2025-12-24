const { request, ensureLogin, getBaseUrl } = require('../../utils/api')

Page({
  data: {
    url: '',
    submittingUrl: false,
    pdfPath: '',
    pdfName: '',
    uploadingPdf: false,
  },

  onShow() {
    const token = wx.getStorageSync('token')
    if (!token) {
      wx.setStorageSync('redirectAfterLogin', '/pages/add/index')
      wx.reLaunch({ url: '/pages/login/index' })
    }
  },

  onUrlInput(e) {
    this.setData({ url: e.detail.value })
  },

  async submitUrl() {
    const url = (this.data.url || '').trim()
    if (!url) {
      wx.showToast({ title: '请输入 URL', icon: 'none' })
      return
    }

    this.setData({ submittingUrl: true })
    try {
      await ensureLogin()
      const resp = await request('POST', '/pieces/from-url', { url })
      if (!resp || !resp.success) throw new Error(resp?.error || 'create failed')
      wx.navigateTo({ url: `/pages/piece/index?id=${encodeURIComponent(resp.piece_id)}` })
    } catch (e) {
      wx.showToast({ title: e.message || '失败', icon: 'none' })
    } finally {
      this.setData({ submittingUrl: false })
    }
  },

  choosePdf() {
    wx.chooseMessageFile({
      count: 1,
      type: 'file',
      extension: ['pdf'],
      success: (res) => {
        const f = res.tempFiles && res.tempFiles[0]
        if (!f) return
        this.setData({ pdfPath: f.path, pdfName: f.name })
      },
      fail: () => {
        wx.showToast({ title: '未选择文件', icon: 'none' })
      },
    })
  },

  async uploadPdf() {
    if (!this.data.pdfPath) return

    this.setData({ uploadingPdf: true })
    try {
      await ensureLogin()
      const token = wx.getStorageSync('token')

      const resp = await new Promise((resolve, reject) => {
        wx.uploadFile({
          url: getBaseUrl() + '/pieces/from-pdf',
          filePath: this.data.pdfPath,
          name: 'file',
          formData: {
            filename: this.data.pdfName || 'upload.pdf',
            content_type: 'application/pdf',
          },
          header: {
            Authorization: `Bearer ${token}`,
          },
          success: (r) => {
            try {
              resolve(JSON.parse(r.data))
            } catch (e) {
              reject(e)
            }
          },
          fail: reject,
        })
      })

      if (!resp || !resp.success) throw new Error(resp?.error || 'upload failed')
      wx.navigateTo({ url: `/pages/piece/index?id=${encodeURIComponent(resp.piece_id)}` })
    } catch (e) {
      wx.showToast({ title: e.message || '上传失败', icon: 'none' })
    } finally {
      this.setData({ uploadingPdf: false })
    }
  },
})
