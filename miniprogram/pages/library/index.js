// Library page is superseded by Home (Explore) with Public/My tabs.
// Keep this page for compatibility, but redirect to Home->My.
const { ensureLogin } = require('../../utils/api')

Page({
  data: {
    loading: true,
    items: [],
  },

  async onShow() {
    const token = wx.getStorageSync('token')
    if (!token) {
      wx.setStorageSync('redirectAfterLogin', '/pages/explore/index?tab=my')
      wx.reLaunch({ url: '/pages/login/index' })
      return
    }
    try {
      await ensureLogin()
    } catch (_) {
      // ignore; Home will handle login state
    }
    wx.reLaunch({ url: '/pages/explore/index?tab=my' })
  },
})
