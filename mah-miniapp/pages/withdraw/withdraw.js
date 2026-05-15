/**
 * 提现页面
 * 仅A类用户可提现，最低1元，最高100元，每日最多3次
 */

const { withdrawApi, userApi } = require("../../services/api");

Page({
  data: {
    commission: 0,
    amount: "",
    records: [],
    loading: true,
    submitting: false,
    userType: "B",
    dailyCount: 0,
  },

  /**
   * 页面显示时加载数据
   */
  onShow() {
    this.loadData();
  },

  /**
   * 加载用户信息和提现记录
   * 并行请求用户信息与提现记录，统计今日提现次数
   */
  async loadData() {
    const app = getApp();
    const userId = app.globalData.userId;
    if (!userId) {
      tt.showToast({ title: "请先登录", icon: "none" });
      this.setData({ loading: false });
      return;
    }

    try {
      const [userResult, recordResult] = await Promise.all([
        userApi.getInfo(userId),
        withdrawApi.getRecords(userId, 50),
      ]);

      const userData = userResult.data || {};
      const rawRecords = recordResult.data || [];

      const today = new Date();
      const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
      const dailyCount = rawRecords.filter((r) => {
        return (
          (r.status === "pending" || r.status === "approved") &&
          r.applyTime &&
          r.applyTime.startsWith(todayStr)
        );
      }).length;

      const statusMap = {
        pending: "审核中",
        approved: "已通过",
        rejected: "已拒绝",
      };
      const records = rawRecords.map((r) => {
        let formatTime = "";
        if (r.applyTime) {
          const date = new Date(r.applyTime);
          const month = String(date.getMonth() + 1).padStart(2, "0");
          const day = String(date.getDate()).padStart(2, "0");
          const hour = String(date.getHours()).padStart(2, "0");
          const minute = String(date.getMinutes()).padStart(2, "0");
          formatTime = `${month}-${day} ${hour}:${minute}`;
        }
        return { ...r, formatTime, statusText: statusMap[r.status] || "未知" };
      });

      this.setData({
        commission: userData.commission || 0,
        userType: userData.userType || "B",
        records,
        dailyCount,
        loading: false,
      });
    } catch (error) {
      console.warn("加载提现数据失败:", error.message);
      this.setData({ loading: false });
      tt.showToast({ title: "加载失败，请重试", icon: "none" });
    }
  },

  /**
   * 输入提现金额
   * @param {Object} e - 输入事件对象
   */
  onAmountInput(e) {
    this.setData({ amount: e.detail.value });
  },

  /**
   * 快捷金额按钮点击
   * @param {Object} e - 点击事件对象，dataset中含amount
   */
  onAmountQuick(e) {
    const amount = e.currentTarget.dataset.amount;
    this.setData({ amount: String(amount) });
  },

  /**
   * 全部提现按钮点击
   * 将可提现佣金全部填入金额输入框
   */
  onAmountAll() {
    this.setData({ amount: String(this.data.commission) });
  },

  /**
   * 提交提现申请
   * 校验用户类型、金额范围、每日次数限制后调用提现API
   */
  async onSubmit() {
    if (this.data.submitting) return;

    const { userType, amount, commission, dailyCount } = this.data;

    if (userType === "B") {
      tt.showToast({ title: "当前用户类型不可提现", icon: "none" });
      return;
    }

    if (!amount || amount === "") {
      tt.showToast({ title: "请输入提现金额", icon: "none" });
      return;
    }

    const numAmount = parseFloat(amount);

    if (isNaN(numAmount) || numAmount < 1) {
      tt.showToast({ title: "最低提现1元", icon: "none" });
      return;
    }

    if (numAmount > commission) {
      tt.showToast({ title: "余额不足", icon: "none" });
      return;
    }

    if (numAmount > 100) {
      tt.showToast({ title: "单次最高100元", icon: "none" });
      return;
    }

    if (dailyCount >= 3) {
      tt.showToast({ title: "今日提现次数已达上限", icon: "none" });
      return;
    }

    const app = getApp();
    const userId = app.globalData.userId;
    if (!userId) {
      tt.showToast({ title: "请先登录", icon: "none" });
      return;
    }

    this.setData({ submitting: true });

    try {
      await withdrawApi.apply(userId, numAmount);
      tt.showToast({ title: "提现申请已提交", icon: "success" });
      this.setData({ amount: "" });
      this.loadData();
    } catch (error) {
      console.warn("提现申请失败:", error.message);
      tt.showToast({ title: error.message || "提现失败", icon: "none" });
    } finally {
      this.setData({ submitting: false });
    }
  },
});
