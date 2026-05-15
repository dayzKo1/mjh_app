/**
 * 登录页面
 */
import React, { useState } from 'react';
import { Card, Form, Input, Button, message } from 'antd';
import { LockOutlined, UserOutlined } from '@ant-design/icons';
import { useStore } from '../../store';
import { authApi } from '../../services/api';

const ADMIN_CREDENTIALS = {
  username: 'admin',
  password: 'mah123456',
};

/**
 * 登录组件
 */
const Login: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const { setToken } = useStore();

  /** 登录 */
  const handleLogin = async (values: { username: string; password: string }) => {
    setLoading(true);
    try {
      if (values.username !== ADMIN_CREDENTIALS.username || values.password !== ADMIN_CREDENTIALS.password) {
        message.error('用户名或密码错误');
        setLoading(false);
        return;
      }

      const token = `admin_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      localStorage.setItem('admin_token', token);

      try {
        await authApi.verify();
      } catch (verifyError) {
        console.warn('Token验证失败，但允许登录:', verifyError);
      }

      setToken(token);
      message.success('登录成功');
    } catch (error) {
      message.error('登录失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      }}
    >
      <Card
        title="中国龙2 - 管理后台"
        style={{ width: 400 }}
        headStyle={{ textAlign: 'center', fontSize: 20 }}
      >
        <Form onFinish={handleLogin} size="large">
          <Form.Item
            name="username"
            rules={[{ required: true, message: '请输入用户名' }]}
          >
            <Input prefix={<UserOutlined />} placeholder="用户名" />
          </Form.Item>
          <Form.Item
            name="password"
            rules={[{ required: true, message: '请输入密码' }]}
          >
            <Input.Password prefix={<LockOutlined />} placeholder="密码" />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" loading={loading} block>
              登录
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
};

export default Login;
