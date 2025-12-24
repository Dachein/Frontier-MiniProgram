// Mini Program API base.
// - local:  http://127.0.0.1:8790   (wrangler dev)
// - online: https://mini-api-worker.dachein-x.workers.dev
const BASE_URL = 'https://mini-api-worker.dachein-x.workers.dev'

function getBaseUrl() {
  return BASE_URL
}

function getToken() {
  return wx.getStorageSync('token') || ''
}

function request(method, path, data) {
  return new Promise((resolve, reject) => {
    wx.request({
      url: BASE_URL + path,
      method,
      data,
      header: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${getToken()}`,
      },
      success(res) {
        resolve(res.data)
      },
      fail(err) {
        reject(err)
      },
    })
  })
}

async function emailLogin(email, password) {
  const resp = await request('POST', '/auth/email/login', { email, password })
  if (!resp || !resp.success) throw new Error(resp?.error || 'email login failed')
  wx.setStorageSync('token', resp.token)
  wx.setStorageSync('user_id', resp.user_id)
  return resp.token
}

async function emailSignup(email, password) {
  const resp = await request('POST', '/auth/email/signup', { email, password })
  if (!resp || !resp.success) throw new Error(resp?.error || 'email signup failed')
  wx.setStorageSync('token', resp.token)
  wx.setStorageSync('user_id', resp.user_id)
  return resp.token
}

async function ensureLogin() {
  const existing = getToken()
  if (existing) return existing

  const code = await new Promise((resolve, reject) => {
    wx.login({
      success: (r) => resolve(r.code),
      fail: reject,
    })
  })

  const resp = await request('POST', '/auth/wechat/login', { code })
  if (!resp || !resp.success) throw new Error(resp?.error || 'login failed')

  wx.setStorageSync('token', resp.token)
  wx.setStorageSync('user_id', resp.user_id)
  return resp.token
}

// Dev helper (local only): use /auth/dev/login with a fake openid.
// Not used by default; keep it for quick local smoke tests.
async function devLogin(openid) {
  const resp = await request('POST', '/auth/dev/login', { openid })
  if (!resp || !resp.success) throw new Error(resp?.error || 'dev login failed')
  wx.setStorageSync('token', resp.token)
  wx.setStorageSync('user_id', resp.user_id)
  return resp.token
}

function wsExtract(pieceId) {
  const token = encodeURIComponent(getToken())
  const url = `${BASE_URL.replace('http', 'ws')}/ws/extract?piece_id=${encodeURIComponent(pieceId)}&token=${token}`
  return wx.connectSocket({ url })
}

module.exports = {
  getBaseUrl,
  request,
  emailLogin,
  emailSignup,
  ensureLogin,
  devLogin,
  wsExtract,
}
