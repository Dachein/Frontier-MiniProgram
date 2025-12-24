const PieceService = require('../../services/piece')
const { request, ensureLogin, getBaseUrl } = require('../../utils/api')

Page({
  data: {
    tab: 'today', // 'today' or 'my'
    tabIndex: 0,
    isAuthed: false,
    todayLoading: false,
    todayRefreshing: false,
    myLoading: false,
    myRefreshing: false,
    todayItems: [],
    myItems: [],

    // Add Drawer State
    showAddDrawer: false,
    url: '',
    submittingUrl: false,
    pdfPath: '',
    pdfName: '',
    uploadingPdf: false,
  },

  onLoad(query) {
    const token = wx.getStorageSync('token')
    const tab = query?.tab === 'my' ? 'my' : 'today'
    const tabIndex = tab === 'my' ? 1 : 0
    this.setData({ tab, tabIndex, isAuthed: !!token })
  },

  async onShow() {
    const token = wx.getStorageSync('token')
    this.setData({ isAuthed: !!token })

    // 只要进入页面，就刷新当前激活的 Tab
    if (this.data.tab === 'today') {
      await this.loadToday()
    } else if (token) {
      await this.loadMy()
    }
  },

  // Swiper 切换
  onSwiperChange(e) {
    const index = e.detail.current
    const tab = index === 1 ? 'my' : 'today'
    this.setData({ tab, tabIndex: index })

    // 切换到新 Tab 时，如果没数据就加载
    if (tab === 'today' && this.data.todayItems.length === 0) {
      this.loadToday()
    } else if (tab === 'my' && this.data.isAuthed && this.data.myItems.length === 0) {
      this.loadMy()
    }
  },

  // Tab 点击
  onTabTap(e) {
    const tab = e.currentTarget.dataset.tab
    const index = tab === 'my' ? 1 : 0
    this.setData({ tab, tabIndex: index })
  },

  // Today 下拉刷新
  async onTodayRefresh() {
    this.setData({ todayRefreshing: true })
    await this.loadToday()
    this.setData({ todayRefreshing: false })
  },

  // 我的 下拉刷新
  async onMyRefresh() {
    if (!this.data.isAuthed) {
      this.setData({ myRefreshing: false })
      return
    }
    this.setData({ myRefreshing: true })
    await this.loadMy()
    this.setData({ myRefreshing: false })
  },

  /**
   * 加载 Today 信号 (使用 Service)
   */
  async loadToday() {
    this.setData({ todayLoading: true })
    try {
      const items = await PieceService.getTodaySignals()
      this.setData({ todayItems: items })
    } catch (e) {
      wx.showToast({ title: e.message || 'Today load failed', icon: 'none' })
    } finally {
      this.setData({ todayLoading: false })
    }
  },

  /**
   * 加载我的 Library (使用 Service)
   */
  async loadMy() {
    this.setData({ myLoading: true })
    try {
      const items = await PieceService.getMyLibrary()
      this.setData({ myItems: items })
    } catch (e) {
      wx.showToast({ title: e.message || 'Library load failed', icon: 'none' })
    } finally {
      this.setData({ myLoading: false })
    }
  },

  onSelectPiece(e) {
    const id = e?.detail?.id
    if (!id) return
    wx.navigateTo({ url: `/pages/piece/index?id=${encodeURIComponent(id)}` })
  },

  goLogin() {
    wx.setStorageSync('redirectAfterLogin', '/pages/explore/index?tab=my')
    wx.navigateTo({ url: '/pages/login/index' })
  },

  onFabAdd() {
    const token = wx.getStorageSync('token')
    if (!token) {
      wx.setStorageSync('redirectAfterLogin', '/pages/explore/index')
      wx.navigateTo({ url: '/pages/login/index' })
      return
    }
    this.setData({ showAddDrawer: true })
  },

  onCloseDrawer() {
    this.setData({ showAddDrawer: false })
  },

  onDrawerEnter() {
    // Optional: animation or state reset
  },

  onDrawerLeave() {
    this.setData({
      url: '',
      pdfPath: '',
      pdfName: '',
      submittingUrl: false,
      uploadingPdf: false
    })
  },

  // --- Add Logic (Copied from add/index.js) ---

  onUrlInput(e) {
    this.setData({ url: e.detail.value })
  },

  async submitUrl() {
    const url = (this.data.url || '').trim()
    if (!url) {
      wx.showToast({ title: 'Paste link first', icon: 'none' })
      return
    }

    this.setData({ submittingUrl: true })
    try {
      await ensureLogin()
      const resp = await request('POST', '/pieces/from-url', { url })
      if (!resp || !resp.success) throw new Error(resp?.error || 'create failed')
      
      this.setData({ showAddDrawer: false })
      wx.navigateTo({ url: `/pages/piece/index?id=${encodeURIComponent(resp.piece_id)}` })
    } catch (e) {
      wx.showToast({ title: e.message || 'Error', icon: 'none' })
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
        // wx.showToast({ title: 'Cancelled', icon: 'none' })
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
      
      this.setData({ showAddDrawer: false })
      wx.navigateTo({ url: `/pages/piece/index?id=${encodeURIComponent(resp.piece_id)}` })
    } catch (e) {
      wx.showToast({ title: e.message || 'Upload failed', icon: 'none' })
    } finally {
      this.setData({ uploadingPdf: false })
    }
  },
})
