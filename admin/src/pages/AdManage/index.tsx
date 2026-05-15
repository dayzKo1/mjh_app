/**
 * 广告统计页面
 */
import React, { useEffect, useState } from 'react';
import { Card, Row, Col, Statistic, DatePicker, Spin, Table } from 'antd';
import { EyeOutlined, DollarOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import type { ColumnsType } from 'antd/es/table';
import { adApi } from '../../services/api';

const { RangePicker } = DatePicker;

interface AdStats {
  rewarded: { count: number; reward: number };
  banner: { count: number };
  interstitial: { count: number };
}

/**
 * 广告统计组件
 */
const AdManage: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<AdStats | null>(null);
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs]>([
    dayjs().subtract(30, 'day'),
    dayjs(),
  ]);

  useEffect(() => {
    fetchStats();
  }, [dateRange]);

  /** 获取广告统计 */
  const fetchStats = async () => {
    setLoading(true);
    try {
      const result = await adApi.getStatistics(
        dateRange[0].format('YYYY-MM-DD'),
        dateRange[1].format('YYYY-MM-DD')
      );
      if (result.code === 0) {
        setStats(result.data);
      }
    } catch (error) {
      console.error('获取广告统计失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const tableData = stats
    ? [
        { key: 'rewarded', name: '激励视频', count: stats.rewarded.count, reward: stats.rewarded.reward },
        { key: 'banner', name: 'Banner广告', count: stats.banner.count, reward: 0 },
        { key: 'interstitial', name: '插屏广告', count: stats.interstitial.count, reward: 0 },
      ]
    : [];

  const columns: ColumnsType<{ key: string; name: string; count: number; reward: number }> = [
    { title: '广告类型', dataIndex: 'name', key: 'name' },
    {
      title: '观看次数',
      dataIndex: 'count',
      key: 'count',
      sorter: (a, b) => a.count - b.count,
    },
    {
      title: '发放奖励',
      dataIndex: 'reward',
      key: 'reward',
      render: (val) => `¥${val.toFixed(2)}`,
    },
  ];

  const totalViews = (stats?.rewarded.count || 0) + (stats?.banner.count || 0) + (stats?.interstitial.count || 0);
  const totalReward = stats?.rewarded.reward || 0;

  return (
    <Card title="广告统计">
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
        <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
          <Col xs={24} sm={12} lg={8}>
            <Card>
              <Statistic
                title="总观看次数"
                value={totalViews}
                prefix={<EyeOutlined />}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={8}>
            <Card>
              <Statistic
                title="激励视频次数"
                value={stats?.rewarded.count || 0}
                prefix={<EyeOutlined />}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={8}>
            <Card>
              <Statistic
                title="总发放奖励"
                value={totalReward}
                precision={2}
                prefix={<DollarOutlined />}
                suffix="元"
              />
            </Card>
          </Col>
        </Row>

        <Table columns={columns} dataSource={tableData} pagination={false} />
      </Spin>
    </Card>
  );
};

export default AdManage;
