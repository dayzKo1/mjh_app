/**
 * 邀请关系管理页面
 */
import React, { useState } from 'react';
import {
  Table,
  Card,
  Button,
  Tag,
  Input,
  Space,
  Descriptions,
  Avatar,
  message,
} from 'antd';
import { UserOutlined, SearchOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { adminApi } from '../../services/api';

interface InviteeRecord {
  _id: string;
  nickName: string;
  avatarUrl: string;
  userType: 'A' | 'B';
  commission: number;
  createTime: string;
}

interface InviterInfo {
  _id: string;
  nickName: string;
  avatarUrl: string;
  userType: 'A' | 'B';
}

interface UserDetail {
  _id: string;
  nickName: string;
  avatarUrl: string;
  userType: 'A' | 'B';
  score: number;
  commission: number;
  level: number;
  createTime: string;
  invitees: InviteeRecord[];
  inviter: InviterInfo | null;
}

/**
 * 邀请关系管理组件
 */
const InviteManage: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [userId, setUserId] = useState('');
  const [userDetail, setUserDetail] = useState<UserDetail | null>(null);

  /** 查询用户邀请关系 */
  const handleSearch = async () => {
    if (!userId.trim()) {
      message.warning('请输入用户ID');
      return;
    }
    setLoading(true);
    try {
      const result = await adminApi.getUserDetail(userId.trim());
      if (result.code === 0) {
        setUserDetail(result.data);
      } else {
        message.error(result.message);
        setUserDetail(null);
      }
    } catch (error) {
      console.error('查询用户详情失败:', error);
      message.error('查询用户详情失败');
      setUserDetail(null);
    } finally {
      setLoading(false);
    }
  };

  const inviteeColumns: ColumnsType<InviteeRecord> = [
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
      title: '佣金',
      dataIndex: 'commission',
      key: 'commission',
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
  ];

  return (
    <Card title="邀请关系查询">
      <Space style={{ marginBottom: 16 }}>
        <Input
          placeholder="输入用户ID"
          value={userId}
          onChange={(e) => setUserId(e.target.value)}
          onPressEnter={handleSearch}
          prefix={<SearchOutlined />}
          style={{ width: 300 }}
        />
        <Button type="primary" onClick={handleSearch} loading={loading}>
          查询
        </Button>
      </Space>

      {userDetail && (
        <>
          <Card
            type="inner"
            title="用户信息"
            style={{ marginBottom: 16 }}
          >
            <Descriptions column={3} bordered size="small">
              <Descriptions.Item label="头像">
                <Avatar src={userDetail.avatarUrl} icon={<UserOutlined />} />
              </Descriptions.Item>
              <Descriptions.Item label="昵称">
                {userDetail.nickName || userDetail._id.slice(0, 8)}
              </Descriptions.Item>
              <Descriptions.Item label="类型">
                <Tag color={userDetail.userType === 'A' ? 'green' : 'default'}>
                  {userDetail.userType}类用户
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="关卡">
                {userDetail.level}
              </Descriptions.Item>
              <Descriptions.Item label="得分">
                {userDetail.score}
              </Descriptions.Item>
              <Descriptions.Item label="佣金余额">
                ¥{(userDetail.commission || 0).toFixed(2)}
              </Descriptions.Item>
              <Descriptions.Item label="注册时间" span={3}>
                {userDetail.createTime
                  ? new Date(userDetail.createTime).toLocaleString()
                  : '-'}
              </Descriptions.Item>
            </Descriptions>
          </Card>

          {userDetail.inviter && (
            <Card
              type="inner"
              title="邀请人信息"
              style={{ marginBottom: 16 }}
            >
              <Descriptions column={3} bordered size="small">
                <Descriptions.Item label="头像">
                  <Avatar
                    src={userDetail.inviter.avatarUrl}
                    icon={<UserOutlined />}
                  />
                </Descriptions.Item>
                <Descriptions.Item label="昵称">
                  {userDetail.inviter.nickName ||
                    userDetail.inviter._id.slice(0, 8)}
                </Descriptions.Item>
                <Descriptions.Item label="类型">
                  <Tag
                    color={
                      userDetail.inviter.userType === 'A' ? 'green' : 'default'
                    }
                  >
                    {userDetail.inviter.userType}类用户
                  </Tag>
                </Descriptions.Item>
              </Descriptions>
            </Card>
          )}

          <Card type="inner" title={`一级邀请列表（${userDetail.invitees?.length || 0}人）`}>
            <Table
              columns={inviteeColumns}
              dataSource={userDetail.invitees || []}
              rowKey="_id"
              loading={loading}
              pagination={{
                pageSize: 10,
                showTotal: (t) => `共 ${t} 条`,
              }}
            />
          </Card>
        </>
      )}
    </Card>
  );
};

export default InviteManage;
