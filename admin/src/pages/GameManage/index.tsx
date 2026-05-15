/**
 * 游戏排行榜页面
 */
import React, { useEffect, useState, useCallback } from 'react';
import { Table, Card, Tabs, Tag, Avatar, message } from 'antd';
import { UserOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { gameApi } from '../../services/api';

interface RankRecord {
  _id: string;
  nickName: string;
  avatarUrl: string;
  score?: number;
  commission?: number;
}

const RANK_COLORS: Record<number, string> = {
  1: 'gold',
  2: '#C0C0C0',
  3: '#CD7F32',
};

const RANK_TAGS: Record<number, { color: string; text: string }> = {
  1: { color: 'gold', text: '🥇 第1名' },
  2: { color: 'default', text: '🥈 第2名' },
  3: { color: 'orange', text: '🥉 第3名' },
};

/**
 * 游戏排行榜组件
 */
const GameManage: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [rankList, setRankList] = useState<RankRecord[]>([]);
  const [activeTab, setActiveTab] = useState('score');

  /** 获取排行榜数据 */
  const fetchRank = useCallback(async () => {
    setLoading(true);
    try {
      const result = await gameApi.getRank(activeTab, 100);
      if (result.code === 0) {
        setRankList(result.data || []);
      } else {
        message.error(result.message);
      }
    } catch (error) {
      console.error('获取排行榜失败:', error);
      message.error('获取排行榜失败');
    } finally {
      setLoading(false);
    }
  }, [activeTab]);

  useEffect(() => {
    fetchRank();
  }, [fetchRank]);

  /** 渲染排名 */
  const renderRank = (_: unknown, __: unknown, index: number) => {
    const rank = index + 1;
    if (rank <= 3) {
      return <Tag color={RANK_TAGS[rank].color}>{RANK_TAGS[rank].text}</Tag>;
    }
    return rank;
  };

  /** 渲染得分/佣金 */
  const renderValue = (record: RankRecord) => {
    if (activeTab === 'score') {
      return record.score ?? 0;
    }
    return `¥${(record.commission || 0).toFixed(2)}`;
  };

  const columns: ColumnsType<RankRecord> = [
    {
      title: '排名',
      key: 'rank',
      width: 100,
      render: renderRank,
    },
    {
      title: '头像',
      dataIndex: 'avatarUrl',
      key: 'avatarUrl',
      width: 60,
      render: (url) => (
        <Avatar src={url} icon={<UserOutlined />} size="small" />
      ),
    },
    {
      title: '昵称',
      dataIndex: 'nickName',
      key: 'nickName',
      render: (name, record) => name || record._id.slice(0, 8),
    },
    {
      title: activeTab === 'score' ? '得分' : '佣金',
      key: 'value',
      render: (_, record) => renderValue(record),
      sorter: activeTab === 'score'
        ? (a, b) => (a.score || 0) - (b.score || 0)
        : (a, b) => (a.commission || 0) - (b.commission || 0),
    },
  ];

  return (
    <Card title="游戏排行榜">
      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={[
          { key: 'score', label: '积分排行' },
          { key: 'commission', label: '佣金排行' },
        ]}
      />

      <Table
        columns={columns}
        dataSource={rankList}
        rowKey="_id"
        loading={loading}
        pagination={false}
        rowClassName={(_, index) => (index < 3 ? 'rank-highlight' : '')}
      />
    </Card>
  );
};

export default GameManage;
