/**
 * API服务 - 通过抖音云函数HTTP触发器与后端交互
 * 所有业务逻辑统一部署在 blgb 云函数服务中，通过 module + action 路由
 */
import axios from "axios";
import { message } from "antd";

const CLOUD_ENV_ID = import.meta.env.VITE_CLOUD_ENV_ID || "env-JXqPdUfI6j";
const SERVICE_ID = "1m11ax5741bfv";
const API_BASE = `https://${CLOUD_ENV_ID}.api.toutiao.com/api/function/${SERVICE_ID}`;

interface ApiResult {
  code: number;
  message: string;
  data: any;
}

const request = axios.create({
  baseURL: API_BASE,
  timeout: 10000,
  headers: {
    "Content-Type": "application/json",
  },
});

request.interceptors.request.use((config) => {
  const token = localStorage.getItem("admin_token");
  if (token) {
    config.headers["X-Admin-Token"] = token;
    config.headers["adminToken"] = token;
  }
  return config;
});

request.interceptors.response.use(
  (response) => {
    const result = response.data as ApiResult;
    if (result.code === -403) {
      localStorage.removeItem("admin_token");
      window.location.href = "/login";
      message.error("登录已过期，请重新登录");
      return Promise.reject(new Error("权限验证失败"));
    }
    return response.data;
  },
  (error) => {
    console.error("API请求失败:", error);
    if (error.response?.status === 401 || error.response?.status === 403) {
      localStorage.removeItem("admin_token");
      window.location.href = "/login";
      message.error("登录已过期，请重新登录");
    } else if (error.code === "ECONNABORTED") {
      message.error("请求超时，请检查网络连接");
    } else {
      message.error(error.message || "网络请求失败");
    }
    return Promise.reject(error);
  },
);

/**
 * 调用云函数
 * @param moduleName - 业务模块名称
 * @param action - 操作名称
 * @param data - 参数
 */
function callFunction(
  moduleName: string,
  action: string,
  data: Record<string, any> = {},
) {
  const token = localStorage.getItem('admin_token');
  return request.post('/', {
    module: moduleName,
    action,
    adminToken: token || '',
    ...data,
  });
}

/**
 * 认证API
 */
export const authApi = {
  /** 验证管理员Token */
  verify: () => callFunction("admin", "verifyToken"),
};

/**
 * 用户管理API
 */
export const userApi = {
  /** 获取用户列表 */
  getList: (params: {
    page: number;
    pageSize: number;
    userType?: string;
    keyword?: string;
  }) => callFunction("admin", "getUserList", params),

  /** 更新用户类型 */
  updateType: (userId: string, userType: "A" | "B") =>
    callFunction("admin", "updateUserType", { userId, userType }),
};

/**
 * 提现管理API
 */
export const withdrawApi = {
  /** 获取待审核列表 */
  getPendingList: (limit = 100) =>
    callFunction("withdraw", "getPendingList", { limit }),

  /** 获取提现统计 */
  getStatistics: (status?: string) =>
    callFunction("admin", "getWithdrawStatistics", { status }),

  /** 处理提现 */
  process: (recordId: string, status: "approved" | "rejected", reason = "") =>
    callFunction("withdraw", "process", { recordId, status, reason }),
};

/**
 * 数据统计API
 */
export const statsApi = {
  /** 获取综合统计 */
  getStatistics: (startDate: string, endDate: string) =>
    callFunction("admin", "getStatistics", { startDate, endDate }),
};

/**
 * 广告管理API
 */
export const adApi = {
  /** 获取广告统计 */
  getStatistics: (startDate: string, endDate: string) =>
    callFunction("ad", "getStatistics", { startDate, endDate }),

  /** 获取广告配置 */
  getConfig: () => callFunction("ad", "getConfig"),
};

/**
 * 游戏管理API
 */
export const gameApi = {
  /** 获取排行榜 */
  getRank: (type: string = "score", limit: number = 100) =>
    callFunction("game", "getRank", { type, limit }),
};

/**
 * 管理后台API
 */
export const adminApi = {
  /** 获取用户详情 */
  getUserDetail: (userId: string) =>
    callFunction("admin", "getUserDetail", { userId }),
};

/**
 * 系统配置API
 */
export const configApi = {
  /** 获取游戏配置 */
  getGameConfig: () => callFunction("game", "getLevelConfig", { level: 1 }),
  /** 获取广告配置 */
  getAdConfig: () => callFunction("ad", "getConfig"),
};
