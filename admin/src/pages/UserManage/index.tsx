/**
 * 用户管理页面
 */
import React, { useEffect, useState, useCallback } from 'react';
import {
  Table,
  Card,
  Button,
  Tag,
  Input,
  Select,
  Space,
  Modal,
  message,
  Avatar,
  Drawer,
  Descriptions,
  Divider,
} from 'antd';
import { UserOutlined, SearchOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { userApi, adminApi } from '../../services/api';

interface UserRecord {
  _id: string;
  openId: string;
  nickName: string;
  avatarUrl: string;
  userType: 'A' | 'B';
  inviterId: string;
  level: number;
  score: number;
  commission: number;
  totalWithdraw: number;
  createTime: string;
}

/**
 * 用户管理组件
 */
const UserManage: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [userType, setUserType] = useState<string | undefined>(undefined);
  const [keyword, setKeyword] = useState('');
  const [searchKeyword, setSearchKeyword] = useState('');
  const [detailVisible, setDetailVisible] = useState(false);
  const [detailData, setDetailData] = useState<any>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  /** 获取用户列表 */
  const fetchUsers = useCallback(async (searchKey?: string) => {
    setLoading(true);
    try {
      const result = await userApi.getList({
        page,
        pageSize,
        userType,
        keyword: searchKey || keyword || undefined,
      });
      if (result.code === 0) {
        setUsers(result.data.list);
        setTotal(result.data.total);
      } else {
        message.error(result.message);
      }
    } catch (error) {
      console.error('获取用户列表失败:', error);
      message.error('获取用户列表失败');
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, userType, keyword]);

  useEffect(() => {
    fetchUsers(searchKeyword);
  }, [page, pageSize, userType, searchKeyword, fetchUsers]);

  /** 切换用户类型 */
  const handleToggleType = (record: UserRecord) => {
    const newType = record.userType === 'A' ? 'B' : 'A';
    Modal.confirm({
      title: '确认切换用户类型',
      content: `确定将用户 ${record.nickName || record._id} 从${record.userType}类切换为${newType}类吗？`,
      onOk: async () => {
        try {
          const result = await userApi.updateType(record._id, newType);
          if (result.code === 0) {
            message.success('切换成功');
            fetchUsers();
          } else {
            message.error(result.message);
          }
        } catch (error) {
          message.error('切换失败');
        }
      },
    });
  };

  /** 搜索 */
  const handleSearch = () => {
    setPage(1);
    setSearchKeyword(keyword);
  };

  /** 查看用户详情 */
  const handleViewDetail = async (record: UserRecord) => {
    setDetailVisible(true);
    setDetailLoading(true);
    try {
      const result = await adminApi.getUserDetail(record._id);
      if (result.code === 0) {
        setDetailData(result.data);
      } else {
        message.error(result.message);
      }
    } catch (error) {
      message.error('获取用户详情失败');
    } finally {
      setDetailLoading(false);
    }
  };

  const columns: ColumnsType<UserRecord> = [
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
      title: '类型',
      dataIndex: 'userType',
      key: 'userType',
      width: 80,
      render: (type) => (
        <Tag color={type === 'A' ? 'green' : 'default'}>
          {type}类用户
        </Tag>
      ),
    },
    {
      title: '关卡',
      dataIndex: 'level',
      key: 'level',
      width: 80,
      sorter: (a, b) => a.level - b.level,
    },
    {
      title: '得分',
      dataIndex: 'score',
      key: 'score',
      width: 100,
      sorter: (a, b) => a.score - b.score,
    },
    {
      title: '佣金余额',
      dataIndex: 'commission',
      key: 'commission',
      width: 100,
      render: (val) => `¥${(val || 0).toFixed(2)}`,
      sorter: (a, b) => a.commission - b.commission,
    },
    {
      title: '累计提现',
      dataIndex: 'totalWithdraw',
      key: 'totalWithdraw',
      width: 100,
      render: (val) => `¥${(val || 0).toFixed(2)}`,
    },
    {
      title: '注册时间',
      dataIndex: 'createTime',
      key: 'createTime',
      width: 180,
      render: (time) => (time ? new Date(time).toLocaleString() : '-'),
    },
    {
      title: '操作',
      key: 'action',
      width: 180,
      render: (_, record) => (
        <Space>
          <Button size="small" onClick={() => handleViewDetail(record)}>
            详情
          </Button>
          <Button
            size="small"
            type={record.userType === 'A' ? 'default' : 'primary'}
            danger={record.userType === 'A'}
            onClick={() => handleToggleType(record)}
          >
            切换为{record.userType === 'A' ? 'B' : 'A'}类
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <Card title="用户管理">
      <Space style={{ marginBottom: 16 }}>
        <Input
          placeholder="搜索昵称"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          onPressEnter={handleSearch}
          prefix={<SearchOutlined />}
          style={{ width: 200 }}
        />
        <Select
          placeholder="用户类型"
          value={userType}
          onChange={(val) => setUserType(val)}
          allowClear
          style={{ width: 120 }}
        >
          <Select.Option value="A">A类用户</Select.Option>
          <Select.Option value="B">B类用户</Select.Option>
        </Select>
        <Button type="primary" onClick={handleSearch}>
          搜索
        </Button>
      </Space>

      <Table
        columns={columns}
        dataSource={users}
        rowKey="_id"
        loading={loading}
        pagination={{
          current: page,
          pageSize,
          total,
          showSizeChanger: true,
          showTotal: (t) => `共 ${t} 条`,
          onChange: (p, ps) => {
            setPage(p);
            setPageSize(ps);
          },
        }}
      />
      <Drawer
        title="用户详情"
        placement="right"
        width={560}
        open={detailVisible}
        onClose={() => setDetailVisible(false)}
        loading={detailLoading}
      >
        {detailData && (
          <>
            <Descriptions title="基本信息" bordered size="small" column={2}>
              <Descriptions.Item label="头像">
                <Avatar src={detailData.user.avatarUrl} icon={<UserOutlined />} />
              </Descriptions.Item>
              <Descriptions.Item label="昵称">{detailData.user.nickName || '-'}</Descriptions.Item>
              <Descriptions.Item label="类型">
                <Tag color={detailData.user.userType === 'A' ? 'green' : 'default'}>
                  {detailData.user.userType}类用户
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="关卡">{detailData.user.level}</Descriptions.Item>
              <Descriptions.Item label="得分">{detailData.user.score}</Descriptions.Item>
              <Descriptions.Item label="佣金余额">¥{(detailData.user.commission || 0).toFixed(2)}</Descriptions.Item>
              <Descriptions.Item label="累计提现">¥{(detailData.user.totalWithdraw || 0).toFixed(2)}</Descriptions.Item>
              <Descriptions.Item label="注册时间">
                {detailData.user.createTime ? new Date(detailData.user.createTime).toLocaleString() : '-'}
              </Descriptions.Item>
            </Descriptions>

            {detailData.inviter && (
              <>
                <Divider />
                <Descriptions title="邀请人" bordered size="small" column={2}>
                  <Descriptions.Item label="昵称">{detailData.inviter.nickName || '-'}</Descriptions.Item>
                  <Descriptions.Item label="类型">
                    <Tag color={detailData.inviter.userType === 'A' ? 'green' : 'default'}>
                      {detailData.inviter.userType}类
                    </Tag>
                  </Descriptions.Item>
                </Descriptions>
              </>
            )}

            <Divider />
            <div style={{ marginBottom: 8, fontWeight: 'bold' }}>一级邀请 ({detailData.inviteList?.level1?.length || 0}人)</div>
            <Table
              size="small"
              pagination={false}
              dataSource={detailData.inviteList?.level1 || []}
              rowKey="_id"
              columns={[
                { title: '昵称', dataIndex: 'nickName', render: (name: string, r: any) => name || r._id?.slice(0, 8) },
                { title: '类型', dataIndex: 'userType', width: 80, render: (t: string) => <Tag color={t === 'A' ? 'green' : 'default'}>{t}类</Tag> },
                { title: '佣金', dataIndex: 'commission', width: 90, render: (v: number) => `¥${(v || 0).toFixed(2)}` },
              ]}
            />

            <Divider />
            <div style={{ marginBottom: 8, fontWeight: 'bold' }}>最近游戏记录</div>
            <Table
              size="small"
              pagination={false}
              dataSource={detailData.gameRecords || []}
              rowKey="_id"
              columns={[
                { title: '关卡', dataIndex: 'level', width: 60 },
                { title: '得分', dataIndex: 'score', width: 70 },
                { title: '用时', dataIndex: 'time', width: 70, render: (v: number) => `${v}s` },
                { title: '时间', dataIndex: 'createTime', render: (t: string) => t ? new Date(t).toLocaleString() : '-' },
              ]}
            />

            <Divider />
            <div style={{ marginBottom: 8, fontWeight: 'bold' }}>最近提现记录</div>
            <Table
              size="small"
              pagination={false}
              dataSource={detailData.withdrawRecords || []}
              rowKey="_id"
              columns={[
                { title: '金额', dataIndex: 'amount', width: 80, render: (v: number) => `¥${v.toFixed(2)}` },
                { title: '状态', dataIndex: 'status', width: 80, render: (s: string) => {
                  const map: Record<string, { text: string; color: string }> = { pending: { text: '待审核', color: 'orange' }, approved: { text: '已通过', color: 'green' }, rejected: { text: '已拒绝', color: 'red' } };
                  const item = map[s] || { text: s, color: 'default' };
                  return <Tag color={item.color}>{item.text}</Tag>;
                }},
                { title: '申请时间', dataIndex: 'applyTime', render: (t: string) => t ? new Date(t).toLocaleString() : '-' },
              ]}
            />
          </>
        )}
      </Drawer>
    </Card>
  );
};

export default UserManage;
