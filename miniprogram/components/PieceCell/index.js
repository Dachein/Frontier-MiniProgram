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
  },
})



