/**
 * 提现审核页面
 */
import React, { useEffect, useState } from 'react';
import {
  Table,
  Card,
  Button,
  Tag,
  Space,
  Modal,
  Input,
  message,
  Tabs,
  Statistic,
  Row,
  Col,
} from 'antd';
import { CheckOutlined, CloseOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { withdrawApi } from '../../services/api';

interface WithdrawRecord {
  _id: string;
  userId: string;
  amount: number;
  status: 'pending' | 'approved' | 'rejected';
  applyTime: string;
  processTime: string;
  reason: string;
  user?: {
    _id: string;
    nickName: string;
    avatarUrl: string;
  };
}

/**
 * 提现审核组件
 */
const WithdrawManage: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [records, setRecords] = useState<WithdrawRecord[]>([]);
  const [stats, setStats] = useState({
    pending: 0,
    approved: 0,
    rejected: 0,
    totalAmount: 0,
  });
  const [activeTab, setActiveTab] = useState('pending');

  useEffect(() => {
    fetchRecords();
  }, [activeTab]);

  /** 获取提现记录 */
  const fetchRecords = async () => {
    setLoading(true);
    try {
      const result = await withdrawApi.getStatistics(
        activeTab === 'all' ? undefined : activeTab
      );
      if (result.code === 0) {
        setRecords(result.data.records);
        setStats(result.data.statistics);
      }
    } catch (error) {
      console.error('获取提现记录失败:', error);
    } finally {
      setLoading(false);
    }
  };

  /** 审核通过 */
  const handleApprove = (record: WithdrawRecord) => {
    Modal.confirm({
      title: '确认通过',
      content: `确认通过用户 ${record.user?.nickName || record.userId} 的提现申请 ¥${record.amount.toFixed(2)} 吗？`,
      onOk: async () => {
        try {
          const result = await withdrawApi.process(record._id, 'approved');
          if (result.code === 0) {
            message.success('审核通过');
            fetchRecords();
          } else {
            message.error(result.message);
          }
        } catch (error) {
          message.error('操作失败');
        }
      },
    });
  };

  /** 审核拒绝 */
  const handleReject = (record: WithdrawRecord) => {
    let reason = '';
    Modal.confirm({
      title: '拒绝提现',
      content: (
        <div>
          <p>拒绝用户 {record.user?.nickName || record.userId} 的提现申请</p>
          <Input.TextArea
            rows={3}
            placeholder="请输入拒绝原因"
            onChange={(e) => {
              reason = e.target.value;
            }}
          />
        </div>
      ),
      onOk: async () => {
        if (!reason) {
          message.warning('请输入拒绝原因');
          return Promise.reject();
        }
        try {
          const result = await withdrawApi.process(record._id, 'rejected', reason);
          if (result.code === 0) {
            message.success('已拒绝');
            fetchRecords();
          } else {
            message.error(result.message);
          }
        } catch (error) {
          message.error('操作失败');
        }
      },
    });
  };

  const statusMap: Record<string, { text: string; color: string }> = {
    pending: { text: '待审核', color: 'orange' },
    approved: { text: '已通过', color: 'green' },
    rejected: { text: '已拒绝', color: 'red' },
  };

  const columns: ColumnsType<WithdrawRecord> = [
    {
      title: '用户',
      key: 'user',
      render: (_, record) => record.user?.nickName || record.userId.slice(0, 8),
    },
    {
      title: '提现金额',
      dataIndex: 'amount',
      key: 'amount',
      render: (val) => `¥${val.toFixed(2)}`,
      sorter: (a, b) => a.amount - b.amount,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status) => (
        <Tag color={statusMap[status].color}>
          {statusMap[status].text}
        </Tag>
      ),
    },
    {
      title: '申请时间',
      dataIndex: 'applyTime',
      key: 'applyTime',
      render: (time) => (time ? new Date(time).toLocaleString() : '-'),
    },
    {
      title: '处理时间',
      dataIndex: 'processTime',
      key: 'processTime',
      render: (time) => (time ? new Date(time).toLocaleString() : '-'),
    },
    {
      title: '拒绝原因',
      dataIndex: 'reason',
      key: 'reason',
      render: (reason) => reason || '-',
    },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => {
        if (record.status !== 'pending') return null;
        return (
          <Space>
            <Button
              size="small"
              type="primary"
              icon={<CheckOutlined />}
              onClick={() => handleApprove(record)}
            >
              通过
            </Button>
            <Button
              size="small"
              danger
              icon={<CloseOutlined />}
              onClick={() => handleReject(record)}
            >
              拒绝
            </Button>
          </Space>
        );
      },
    },
  ];

  return (
    <Card title="提现管理">
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Statistic title="待审核" value={stats.pending} suffix="笔" />
        </Col>
        <Col span={6}>
          <Statistic title="已通过" value={stats.approved} suffix="笔" />
        </Col>
        <Col span={6}>
          <Statistic title="已拒绝" value={stats.rejected} suffix="笔" />
        </Col>
        <Col span={6}>
          <Statistic
            title="提现总额"
            value={stats.totalAmount}
            precision={2}
            prefix="¥"
          />
        </Col>
      </Row>

      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={[
          { key: 'pending', label: '待审核' },
          { key: 'approved', label: '已通过' },
          { key: 'rejected', label: '已拒绝' },
          { key: 'all', label: '全部' },
        ]}
      />

      <Table
        columns={columns}
        dataSource={records}
        rowKey="_id"
        loading={loading}
      />
    </Card>
  );
};

export default WithdrawManage;
