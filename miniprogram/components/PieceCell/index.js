Component({
  properties: {
    item: {
      type: Object,
      value: null,
    },
  },

  methods: {
    onTap() {
      const it = this.data.item || {}
      const id = it.id || it.piece_id
      if (!id) return
      this.triggerEvent('select', { id })
    },

    onLongPress() {
      const it = this.data.item || {}
      // 触发震动反馈
      wx.vibrateShort({ type: 'medium' })
      this.triggerEvent('contextmenu', { item: it })
    }
  },
})



