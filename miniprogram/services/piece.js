const { request } = require('../utils/api')

/**
 * Piece Service - Handles all data fetching and piece-related logic
 */
const PieceService = {
  /**
   * Fetch Today's signals (Public)
   */
  async getTodaySignals() {
    const resp = await request('GET', '/pieces/today')
    if (!resp || !resp.success) throw new Error(resp?.error || 'failed to load today signals')
    return (resp.items || []).map((it) => this._mapPieceItem(it))
  },

  /**
   * Fetch My Library (Private)
   */
  async getMyLibrary() {
    const resp = await request('GET', '/library')
    if (!resp || !resp.success) throw new Error(resp?.error || 'failed to load library')
    return (resp.items || []).map((it) => this._mapPieceItem(it))
  },

  /**
   * Fetch Single Piece Detail
   */
  async getPieceDetail(id) {
    const resp = await request('GET', `/pieces/${id}`)
    if (!resp || !resp.success) throw new Error(resp?.error || 'failed to load piece')
    return resp.piece
  },

  /**
   * Pin piece to library
   */
  async pin(id) {
    const resp = await request('POST', `/pieces/${id}/pin`)
    if (!resp || !resp.success) throw new Error(resp?.error || 'pin failed')
    return true
  },

  /**
   * Unpin piece from library
   */
  async unpin(id) {
    const resp = await request('DELETE', `/pieces/${id}/pin`)
    if (!resp || !resp.success) throw new Error(resp?.error || 'unpin failed')
    return true
  },

  /**
   * Start extraction stream (WebSocket)
   */
  startExtractStream(pieceId) {
    const { wsExtract } = require('../utils/api')
    return wsExtract(pieceId)
  },

  /**
   * Helper: Map API response to UI model
   * Handles structure: { piece_id, added_at, last_opened_at, pieces: { ... } }
   */
  _mapPieceItem(it) {
    const p = it.pieces || {}
    const meta = p.metadata || {}
    const takeaways = Array.isArray(p.key_takeaways) ? p.key_takeaways : []

    // Calculate dynamic properties for UI
    const addedAt = it.added_at || p.created_at
    // 移除时间感知的高亮逻辑，保持列表视觉高度一致
    const isActive = false

    return {
      id: p.id,
      title: meta.title_zh || meta.title || p.filename || 'Untitled',
      badge: this._toBadge(p),
      badgeType: this._toBadgeType(p),
      source: this._toSource(p),
      timeText: this._formatTickerTime(addedAt),
      takeawayCount: p.takeaway_count || takeaways.length,
      isActive,
      isPinned: !!it.is_pinned,
    }
  },

  _formatTickerTime(dateLike) {
    if (!dateLike) return '—'
    const d = new Date(dateLike)
    const interval = Math.abs(Date.now() - d.getTime()) / 1000

    if (interval < 60) return 'NOW'
    if (interval < 3600) return `${Math.floor(interval / 60)}M`
    if (interval < 86400) return `${Math.floor(interval / 3600)}H`
    if (interval < 2592000) return `${Math.floor(interval / 86400)}D`
    if (interval < 31536000) return `${Math.floor(interval / 2592000)}MO`
    return `${Math.floor(interval / 31536000)}YR`
  },

  _formatFullTime(dateLike) {
    if (!dateLike) return '—'
    const d = new Date(dateLike)
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    const hh = String(d.getHours()).padStart(2, '0')
    const mm = String(d.getMinutes()).padStart(2, '0')
    const ss = String(d.getSeconds()).padStart(2, '0')
    return `${y}/${m}/${day} ${hh}:${mm}:${ss}`
  },

  _toBadge(p) {
    const t = (p.source_type || p.media_type || '').toUpperCase()
    // 映射到简短代码 (2-3 chars)
    if (t.includes('PDF')) return 'PDF'
    if (t.includes('WECHAT') || t.includes('WX')) return 'WX'
    if (t.includes('LINK') || t.includes('URL')) return 'LNK'
    if (t.includes('YOUTUBE') || t.includes('YTB')) return 'YTB'
    if (!t) return '—'
    return t.slice(0, 3)
  },

  _toBadgeType(p) {
    // 用于 CSS 类名: pc-avatar-PDF, pc-avatar-YTB
    const t = (p.source_type || p.media_type || '').toUpperCase()
    if (t.includes('PDF')) return 'PDF'
    if (t.includes('YOUTUBE') || t.includes('YTB')) return 'YTB'
    if (t.includes('WECHAT') || t.includes('WX')) return 'WX'
    return 'DEFAULT'
  },

  _toSource(p) {
    const raw = (p.publisher || p.author || 'SOURCE').toString()
    return raw.toUpperCase()
  },
}

module.exports = PieceService
