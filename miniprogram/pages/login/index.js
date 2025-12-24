const { emailLogin, emailSignup, ensureLogin } = require('../../utils/api')

function goAfterLogin() {
  const redirect = wx.getStorageSync('redirectAfterLogin')
  if (redirect) {
    wx.removeStorageSync('redirectAfterLogin')
    wx.reLaunch({ url: redirect })
    return
  }
  // Home defaults to Public; after login we prefer landing in My.
  wx.reLaunch({ url: '/pages/explore/index?tab=my' })
}

Page({
  data: {
    email: '',
    password: '',
    loadingEmail: false,
    loadingSignup: false,
    loadingWeChat: false,
    error: '',
  },

  onShow() {
    const token = wx.getStorageSync('token')
    if (token) {
      goAfterLogin()
    }
  },

  onEmail(e) {
    this.setData({ email: e.detail.value })
  },

  onPassword(e) {
    this.setData({ password: e.detail.value })
  },

  async loginEmail() {
    const email = (this.data.email || '').trim()
    const password = this.data.password || ''

    if (!email || !password) {
      this.setData({ error: 'Please enter email and password' })
      return
    }

    this.setData({ loadingEmail: true, error: '' })
    try {
      await emailLogin(email, password)
      goAfterLogin()
    } catch (e) {
      this.setData({ error: e.message || 'Email login failed' })
    } finally {
      this.setData({ loadingEmail: false })
    }
  },

  async signupEmail() {
    const email = (this.data.email || '').trim()
    const password = this.data.password || ''

    if (!email || !password) {
      this.setData({ error: 'Please enter email and password' })
      return
    }

    this.setData({ loadingSignup: true, error: '' })
    try {
      await emailSignup(email, password)
      goAfterLogin()
    } catch (e) {
      this.setData({ error: e.message || 'Email signup failed' })
    } finally {
      this.setData({ loadingSignup: false })
    }
  },

  async loginWeChat() {
    this.setData({ loadingWeChat: true, error: '' })
    try {
      await ensureLogin()
      goAfterLogin()
    } catch (e) {
      this.setData({ error: e.message || 'WeChat login failed' })
    } finally {
      this.setData({ loadingWeChat: false })
    }
  },
})
