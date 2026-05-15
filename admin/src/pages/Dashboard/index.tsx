/**
 * 仪表盘页面 - 数据概览
 */
import React, { useEffect, useState } from 'react';
import { Card, Col, Row, Statistic, DatePicker, Spin } from 'antd';
import {
  UserOutlined,
  TrophyOutlined,
  DollarOutlined,
  FundOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { statsApi } from '../../services/api';

const { RangePicker } = DatePicker;

interface StatsData {
  users: { total: number; aType: number; bType: number; newUsers: number };
  games: { total: number; totalScore: number };
  withdraw: { total: number; count: number };
  ads: { total: number; reward: number };
}

/**
 * 仪表盘组件
 */
const Dashboard: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<StatsData | null>(null);
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs]>([
    dayjs().subtract(30, 'day'),
    dayjs(),
  ]);

  useEffect(() => {
    fetchStats();
  }, [dateRange]);

  /** 获取统计数据 */
  const fetchStats = async () => {
    setLoading(true);
    try {
      const result = await statsApi.getStatistics(
        dateRange[0].format('YYYY-MM-DD'),
        dateRange[1].format('YYYY-MM-DD')
      );
      if (result.code === 0) {
        setStats(result.data);
      }
    } catch (error) {
      console.error('获取统计数据失败:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <RangePicker
          value={dateRange}
          onChange={(dates) => {
            if (dates && dates[0] && dates[1]) {
              setDateRange([dates[0], dates[1]]);
            }
          }}
        />
      </div>

      <Spin spinning={loading}>
        <Row gutter={[16, 16]}>
          <Col xs={24} sm={12} lg={6}>
            <Card>
              <Statistic
                title="总用户数"
                value={stats?.users.total || 0}
                prefix={<UserOutlined />}
                suffix={
                  <span style={{ fontSize: 14, color: '#999' }}>
                    (A类: {stats?.users.aType || 0} / B类: {stats?.users.bType || 0})
                  </span>
                }
              />
              <div style={{ marginTop: 8, color: '#52c41a', fontSize: 14 }}>
                新增: {stats?.users.newUsers || 0}
              </div>
            </Card>
          </Col>

          <Col xs={24} sm={12} lg={6}>
            <Card>
              <Statistic
                title="游戏总局数"
                value={stats?.games.total || 0}
                prefix={<TrophyOutlined />}
              />
              <div style={{ marginTop: 8, color: '#1890ff', fontSize: 14 }}>
                总得分: {stats?.games.totalScore || 0}
              </div>
            </Card>
          </Col>

          <Col xs={24} sm={12} lg={6}>
            <Card>
              <Statistic
                title="提现总额"
                value={stats?.withdraw.total || 0}
                prefix={<DollarOutlined />}
                precision={2}
                suffix="元"
              />
              <div style={{ marginTop: 8, color: '#faad14', fontSize: 14 }}>
                提现次数: {stats?.withdraw.count || 0}
              </div>
            </Card>
          </Col>

          <Col xs={24} sm={12} lg={6}>
            <Card>
              <Statistic
                title="广告观看次数"
                value={stats?.ads.total || 0}
                prefix={<FundOutlined />}
              />
              <div style={{ marginTop: 8, color: '#722ed1', fontSize: 14 }}>
                广告奖励: ¥{((stats?.ads.reward || 0)).toFixed(2)}
              </div>
            </Card>
          </Col>
        </Row>
      </Spin>
    </div>
  );
};

export default Dashboard;
