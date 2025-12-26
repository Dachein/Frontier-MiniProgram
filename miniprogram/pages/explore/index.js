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

    // Context Menu State
    showMenu: false,
    menuTitle: '',
    menuItems: [],
    selectedItem: null,
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

  /**
   * 长按唤起菜单
   */
  onShowMenu(e) {
    const { item } = e.detail
    const isPinned = !!item.isPinned
    
    let menuItems = []
    if (!isPinned) {
      menuItems = [
        { id: 'pin', label: 'Pin to Arsenal', icon: 'bookmark' },
        { id: 'copy', label: 'Copy Link', icon: 'link' },
        { id: 'share', label: 'Forward to Group', icon: 'share', openType: 'share' },
        { id: 'save-image', label: 'Save Share Image', icon: 'image' }
      ]
    } else {
      menuItems = [
        { id: 'unpin', label: 'Unpin from Arsenal', icon: 'trash', danger: true },
        { id: 'copy', label: 'Copy Link', icon: 'link' },
        { id: 'share', label: 'Forward to Group', icon: 'share', openType: 'share' },
        { id: 'save-image', label: 'Save Share Image', icon: 'image' }
      ]
    }

    this.setData({
      showMenu: true,
      menuTitle: item.title,
      menuItems,
      selectedItem: item
    })
  },

  onCloseMenu() {
    this.setData({ showMenu: false })
  },

  async onMenuAction(e) {
    const { id } = e.detail
    const item = this.data.selectedItem
    this.setData({ showMenu: false })

    if (!item) return

    switch (id) {
      case 'pin':
        try {
          wx.showLoading({ title: 'Pinning...', mask: true })
          await PieceService.pin(item.id)
          
          // 本地状态更新
          const updateItem = (list) => list.map(i => i.id === item.id ? { ...i, isPinned: true } : i)
          this.setData({
            todayItems: updateItem(this.data.todayItems),
            myItems: this.data.tab === 'my' ? updateItem(this.data.myItems) : this.data.myItems
          })
          
          wx.showToast({ title: 'Pinned!', icon: 'success' })
        } catch (err) {
          wx.showToast({ title: err.message || 'Pin failed', icon: 'none' })
        } finally {
          wx.hideLoading()
        }
        break
      case 'unpin':
        try {
          wx.showLoading({ title: 'Removing...', mask: true })
          await PieceService.unpin(item.id)
          
          // 本地状态更新
          const updateItem = (list) => list.map(i => i.id === item.id ? { ...i, isPinned: false } : i)
          this.setData({
            todayItems: updateItem(this.data.todayItems),
            myItems: this.data.myItems.filter(i => i.id !== item.id)
          })
          
          wx.showToast({ title: 'Unpinned', icon: 'none' })
        } catch (err) {
          wx.showToast({ title: err.message || 'Unpin failed', icon: 'none' })
        } finally {
          wx.hideLoading()
        }
        break
      case 'copy':
        wx.setClipboardData({
          data: item.sourceUrl || item.title,
          success: () => wx.showToast({ title: 'Link Copied' })
        })
        break
      case 'share':
        // logic moved to onShareAppMessage for 'share' button
        break
      case 'save-image':
        if (!item) return
        wx.showLoading({ title: 'Generating...', mask: true })
        try {
          const resp = await request('GET', `/pieces/${item.id}/share-image`)
          if (!resp || !resp.success || !resp.image_url) {
            throw new Error(resp?.error || 'Failed to generate image')
          }
          wx.previewImage({
            urls: [resp.image_url],
            current: resp.image_url
          })
        } catch (e) {
          wx.showToast({ title: e.message || 'Error', icon: 'none' })
        } finally {
          wx.hideLoading()
        }
        break
    }
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

  /**
   * 转发给朋友/群聊
   */
  onShareAppMessage(res) {
    const item = this.data.selectedItem
    if (res.from === 'button' && item) {
      // 从上下文菜单点击分享
      this.setData({ showMenu: false })
      return {
        title: item.title || 'metaAlpha Signal',
        path: `/pages/piece/index?id=${encodeURIComponent(item.id)}`
      }
    }
    // 默认分享当前 Explore 页面
    return {
      title: 'metaAlpha - Discover Hardcore Signals',
      path: '/pages/explore/index'
    }
  }
})
