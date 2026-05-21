/**
 * 抖音小游戏入口文件
 * 使用适配层模式加载页面结构
 */

// 引入适配层
require('./app.js');

// 游戏启动
GameGlobal.onload = function() {
  console.log('麻将消消乐游戏启动');
};