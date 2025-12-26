Component({
  properties: {
    show: {
      type: Boolean,
      value: false
    },
    title: {
      type: String,
      value: ''
    },
    items: {
      type: Array,
      value: [] // { id, label, icon, danger, openType }
    }
  },

  methods: {
    onClose() {
      this.triggerEvent('close')
    },

    onSelect(e) {
      const { id } = e.currentTarget.dataset
      this.triggerEvent('select', { id })
    }
  }
})
