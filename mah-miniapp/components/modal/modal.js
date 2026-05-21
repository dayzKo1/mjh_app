/**
 * 通用弹窗组件
 * 统一所有弹窗的样式和行为
 */

Component({
  properties: {
    // 弹窗标题
    title: {
      type: String,
      value: '',
    },
    // 是否显示弹窗
    show: {
      type: Boolean,
      value: false,
    },
    // 弹窗类型：default / success / error / warning / item-select
    type: {
      type: String,
      value: 'default',
    },
    // 是否显示关闭按钮
    showClose: {
      type: Boolean,
      value: true,
    },
    // 是否显示底部按钮
    showFooter: {
      type: Boolean,
      value: true,
    },
    // 确认按钮文字
    confirmText: {
      type: String,
      value: '确定',
    },
    // 取消按钮文字
    cancelText: {
      type: String,
      value: '',
    },
    // 内容高度（用于滚动）
    contentHeight: {
      type: String,
      value: 'auto',
    },
  },

  data: {
    // 动画状态
    animating: false,
  },

  methods: {
    /** 关闭弹窗 */
    onClose() {
      this.triggerEvent('close');
    },

    /** 点击确认 */
    onConfirm() {
      this.triggerEvent('confirm');
    },

    /** 点击取消 */
    onCancel() {
      this.triggerEvent('cancel');
    },

    /** 点击背景（可选关闭） */
    onBackgroundTap() {
      // 默认不关闭，可以通过事件让父组件决定
      this.triggerEvent('backgroundtap');
    },

    /** 阻止冒泡 */
    stopPropagation() {
      // 空方法，用于阻止冒泡
    },
  },

  lifetimes: {
    attached() {
      // 弹窗打开动画
      if (this.data.show) {
        this.setData({ animating: true });
      }
    },
  },
});