/**
 * 日志工具模块
 * 提供统一的日志记录功能，支持不同日志级别和业务模块标识
 */

const LOG_LEVELS = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
};

const CURRENT_LOG_LEVEL = process.env.LOG_LEVEL ? LOG_LEVELS[process.env.LOG_LEVEL] : LOG_LEVELS.INFO;

/**
 * 格式化时间戳
 */
function formatTimestamp() {
  const now = new Date();
  return now.toISOString();
}

/**
 * 格式化日志输出
 * @param {string} level - 日志级别
 * @param {string} module - 业务模块
 * @param {string} action - 操作名称
 * @param {string} message - 日志消息
 * @param {Object} data - 附加数据
 */
function formatLog(level, module, action, message, data = null) {
  const logObj = {
    timestamp: formatTimestamp(),
    level,
    module,
    action,
    message,
  };

  if (data) {
    logObj.data = data;
  }

  return JSON.stringify(logObj);
}

/**
 * 创建模块日志器
 * @param {string} module - 业务模块名称
 */
function createLogger(module) {
  return {
    /**
     * 调试日志 - 用于开发调试
     */
    debug(action, message, data = null) {
      if (CURRENT_LOG_LEVEL <= LOG_LEVELS.DEBUG) {
        console.log(formatLog('DEBUG', module, action, message, data));
      }
    },

    /**
     * 信息日志 - 用于记录正常业务流程
     */
    info(action, message, data = null) {
      if (CURRENT_LOG_LEVEL <= LOG_LEVELS.INFO) {
        console.log(formatLog('INFO', module, action, message, data));
      }
    },

    /**
     * 警告日志 - 用于记录潜在问题
     */
    warn(action, message, data = null) {
      if (CURRENT_LOG_LEVEL <= LOG_LEVELS.WARN) {
        console.warn(formatLog('WARN', module, action, message, data));
      }
    },

    /**
     * 错误日志 - 用于记录错误和异常
     */
    error(action, message, data = null) {
      if (CURRENT_LOG_LEVEL <= LOG_LEVELS.ERROR) {
        console.error(formatLog('ERROR', module, action, message, data));
      }
    },

    /**
     * 业务开始日志
     */
    start(action, message, data = null) {
      console.log(formatLog('INFO', module, action, `[START] ${message}`, data));
    },

    /**
     * 业务结束日志
     */
    end(action, message, data = null) {
      console.log(formatLog('INFO', module, action, `[END] ${message}`, data));
    },

    /**
     * 业务成功日志
     */
    success(action, message, data = null) {
      console.log(formatLog('INFO', module, action, `[SUCCESS] ${message}`, data));
    },

    /**
     * 业务失败日志
     */
    fail(action, message, data = null) {
      console.error(formatLog('ERROR', module, action, `[FAIL] ${message}`, data));
    },
  };
}

module.exports = {
  createLogger,
  LOG_LEVELS,
};
