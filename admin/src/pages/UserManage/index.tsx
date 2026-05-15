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
} from 'antd';
import { UserOutlined, SearchOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { userApi } from '../../services/api';

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
      width: 120,
      render: (_, record) => (
        <Button
          size="small"
          type={record.userType === 'A' ? 'default' : 'primary'}
          danger={record.userType === 'A'}
          onClick={() => handleToggleType(record)}
        >
          切换为{record.userType === 'A' ? 'B' : 'A'}类
        </Button>
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
    </Card>
  );
};

export default UserManage;
