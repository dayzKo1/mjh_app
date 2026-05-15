/**
 * 系统配置管理页面
 */
import React, { useEffect, useState } from 'react';
import {
  Card,
  Descriptions,
  Button,
  Modal,
  Form,
  InputNumber,
  Switch,
  message,
  Row,
  Col,
  Divider,
} from 'antd';
import { EditOutlined, SettingOutlined } from '@ant-design/icons';
import { configApi } from '../../services/api';

interface GameConfig {
  maxScore: number;
  maxLevel: number;
  maxTime: number;
  maxRecordsPerHour: number;
  maxCommissionPerDay: number;
}

interface WithdrawConfig {
  minAmount: number;
  maxAmount: number;
  dailyLimit: number;
}

interface RewardedAdConfig {
  enabled: boolean;
  reward: number;
  dailyLimit: number;
}

interface BannerAdConfig {
  enabled: boolean;
}

interface InterstitialAdConfig {
  enabled: boolean;
  frequency: number;
}

interface AdConfig {
  rewarded: RewardedAdConfig;
  banner: BannerAdConfig;
  interstitial: InterstitialAdConfig;
}

interface SystemConfig {
  game: GameConfig;
  withdraw: WithdrawConfig;
  ad: AdConfig;
}

const defaultConfig: SystemConfig = {
  game: {
    maxScore: 10000,
    maxLevel: 100,
    maxTime: 3600,
    maxRecordsPerHour: 100,
    maxCommissionPerDay: 100,
  },
  withdraw: {
    minAmount: 1,
    maxAmount: 100,
    dailyLimit: 3,
  },
  ad: {
    rewarded: {
      enabled: true,
      reward: 0.01,
      dailyLimit: 50,
    },
    banner: {
      enabled: true,
    },
    interstitial: {
      enabled: true,
      frequency: 3,
    },
  },
};

/**
 * 系统配置管理组件
 */
const ConfigManage: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [config, setConfig] = useState<SystemConfig>(defaultConfig);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editSection, setEditSection] = useState<string>('');
  const [form] = Form.useForm();

  /** 获取系统配置 */
  const fetchConfig = async () => {
    setLoading(true);
    try {
      const [gameResult, adResult] = await Promise.all([
        configApi.getGameConfig(),
        configApi.getAdConfig(),
      ]);

      const newConfig = { ...defaultConfig };

      if (gameResult.code === 0 && gameResult.data) {
        newConfig.game = { ...newConfig.game, ...gameResult.data };
      }
      if (adResult.code === 0 && adResult.data) {
        newConfig.ad = {
          ...newConfig.ad,
          ...adResult.data,
          rewarded: { ...newConfig.ad.rewarded, ...adResult.data.rewarded },
          banner: { ...newConfig.ad.banner, ...adResult.data.banner },
          interstitial: { ...newConfig.ad.interstitial, ...adResult.data.interstitial },
        };
      }

      setConfig(newConfig);
    } catch (error) {
      console.error('获取系统配置失败:', error);
      message.error('获取系统配置失败，使用默认配置');
      setConfig(defaultConfig);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConfig();
  }, []);

  /** 打开编辑弹窗 */
  const handleEdit = (section: string) => {
    setEditSection(section);
    setEditModalVisible(true);

    if (section === 'game') {
      form.setFieldsValue(config.game);
    } else if (section === 'withdraw') {
      form.setFieldsValue(config.withdraw);
    } else if (section === 'ad') {
      form.setFieldsValue({
        'rewarded.enabled': config.ad.rewarded.enabled,
        'rewarded.reward': config.ad.rewarded.reward,
        'rewarded.dailyLimit': config.ad.rewarded.dailyLimit,
        'banner.enabled': config.ad.banner.enabled,
        'interstitial.enabled': config.ad.interstitial.enabled,
        'interstitial.frequency': config.ad.interstitial.frequency,
      });
    }
  };

  /** 提交编辑 */
  const handleSave = async () => {
    message.info('功能开发中');
    setEditModalVisible(false);
  };

  /** 渲染游戏配置编辑表单 */
  const renderGameForm = () => (
    <>
      <Form.Item name="maxScore" label="最高得分上限" rules={[{ required: true }]}>
        <InputNumber min={0} style={{ width: '100%' }} />
      </Form.Item>
      <Form.Item name="maxLevel" label="最高关卡" rules={[{ required: true }]}>
        <InputNumber min={1} style={{ width: '100%' }} />
      </Form.Item>
      <Form.Item name="maxTime" label="最长用时（秒）" rules={[{ required: true }]}>
        <InputNumber min={1} style={{ width: '100%' }} />
      </Form.Item>
      <Form.Item name="maxRecordsPerHour" label="每小时记录上限" rules={[{ required: true }]}>
        <InputNumber min={1} style={{ width: '100%' }} />
      </Form.Item>
      <Form.Item name="maxCommissionPerDay" label="每日分佣上限" rules={[{ required: true }]}>
        <InputNumber min={0} style={{ width: '100%' }} />
      </Form.Item>
    </>
  );

  /** 渲染提现配置编辑表单 */
  const renderWithdrawForm = () => (
    <>
      <Form.Item name="minAmount" label="最低提现金额（元）" rules={[{ required: true }]}>
        <InputNumber min={0.01} step={0.01} precision={2} style={{ width: '100%' }} />
      </Form.Item>
      <Form.Item name="maxAmount" label="最高提现金额（元）" rules={[{ required: true }]}>
        <InputNumber min={0.01} step={0.01} precision={2} style={{ width: '100%' }} />
      </Form.Item>
      <Form.Item name="dailyLimit" label="每日提现次数" rules={[{ required: true }]}>
        <InputNumber min={1} style={{ width: '100%' }} />
      </Form.Item>
    </>
  );

  /** 渲染广告配置编辑表单 */
  const renderAdForm = () => (
    <>
      <Divider orientation="left">激励视频</Divider>
      <Form.Item name="rewarded.enabled" label="激励视频开关" valuePropName="checked">
        <Switch />
      </Form.Item>
      <Form.Item name="rewarded.reward" label="激励视频奖励（元）" rules={[{ required: true }]}>
        <InputNumber min={0.001} step={0.001} precision={3} style={{ width: '100%' }} />
      </Form.Item>
      <Form.Item name="rewarded.dailyLimit" label="每日观看上限（次）" rules={[{ required: true }]}>
        <InputNumber min={1} style={{ width: '100%' }} />
      </Form.Item>

      <Divider orientation="left">Banner广告</Divider>
      <Form.Item name="banner.enabled" label="Banner开关" valuePropName="checked">
        <Switch />
      </Form.Item>

      <Divider orientation="left">插屏广告</Divider>
      <Form.Item name="interstitial.enabled" label="插屏开关" valuePropName="checked">
        <Switch />
      </Form.Item>
      <Form.Item name="interstitial.frequency" label="插屏频率" rules={[{ required: true }]}>
        <InputNumber min={1} style={{ width: '100%' }} />
      </Form.Item>
    </>
  );

  /** 获取编辑弹窗标题 */
  const getModalTitle = () => {
    const titles: Record<string, string> = {
      game: '编辑游戏配置',
      withdraw: '编辑提现配置',
      ad: '编辑广告配置',
    };
    return titles[editSection] || '编辑配置';
  };

  /** 渲染编辑表单内容 */
  const renderEditForm = () => {
    if (editSection === 'game') return renderGameForm();
    if (editSection === 'withdraw') return renderWithdrawForm();
    if (editSection === 'ad') return renderAdForm();
    return null;
  };

  return (
    <div>
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={8}>
          <Card
            title={
              <span>
                <SettingOutlined style={{ marginRight: 8 }} />
                游戏配置
              </span>
            }
            extra={
              <Button
                type="primary"
                icon={<EditOutlined />}
                size="small"
                onClick={() => handleEdit('game')}
              >
                编辑
              </Button>
            }
            loading={loading}
          >
            <Descriptions column={1} size="small">
              <Descriptions.Item label="最高得分上限">
                {config.game.maxScore}
              </Descriptions.Item>
              <Descriptions.Item label="最高关卡">
                {config.game.maxLevel}
              </Descriptions.Item>
              <Descriptions.Item label="最长用时">
                {config.game.maxTime}秒
              </Descriptions.Item>
              <Descriptions.Item label="每小时记录上限">
                {config.game.maxRecordsPerHour}
              </Descriptions.Item>
              <Descriptions.Item label="每日分佣上限">
                {config.game.maxCommissionPerDay}
              </Descriptions.Item>
            </Descriptions>
          </Card>
        </Col>

        <Col xs={24} lg={8}>
          <Card
            title={
              <span>
                <SettingOutlined style={{ marginRight: 8 }} />
                提现配置
              </span>
            }
            extra={
              <Button
                type="primary"
                icon={<EditOutlined />}
                size="small"
                onClick={() => handleEdit('withdraw')}
              >
                编辑
              </Button>
            }
            loading={loading}
          >
            <Descriptions column={1} size="small">
              <Descriptions.Item label="最低提现金额">
                {config.withdraw.minAmount}元
              </Descriptions.Item>
              <Descriptions.Item label="最高提现金额">
                {config.withdraw.maxAmount}元
              </Descriptions.Item>
              <Descriptions.Item label="每日提现次数">
                {config.withdraw.dailyLimit}次
              </Descriptions.Item>
            </Descriptions>
          </Card>
        </Col>

        <Col xs={24} lg={8}>
          <Card
            title={
              <span>
                <SettingOutlined style={{ marginRight: 8 }} />
                广告配置
              </span>
            }
            extra={
              <Button
                type="primary"
                icon={<EditOutlined />}
                size="small"
                onClick={() => handleEdit('ad')}
              >
                编辑
              </Button>
            }
            loading={loading}
          >
            <Descriptions column={1} size="small">
              <Descriptions.Item label="激励视频开关">
                {config.ad.rewarded.enabled ? '开启' : '关闭'}
              </Descriptions.Item>
              <Descriptions.Item label="激励视频奖励">
                {config.ad.rewarded.reward}元
              </Descriptions.Item>
              <Descriptions.Item label="每日观看上限">
                {config.ad.rewarded.dailyLimit}次
              </Descriptions.Item>
              <Descriptions.Item label="Banner开关">
                {config.ad.banner.enabled ? '开启' : '关闭'}
              </Descriptions.Item>
              <Descriptions.Item label="插屏开关">
                {config.ad.interstitial.enabled ? '开启' : '关闭'}
              </Descriptions.Item>
              <Descriptions.Item label="插屏频率">
                {config.ad.interstitial.frequency}
              </Descriptions.Item>
            </Descriptions>
          </Card>
        </Col>
      </Row>

      <Modal
        title={getModalTitle()}
        open={editModalVisible}
        onOk={handleSave}
        onCancel={() => setEditModalVisible(false)}
        destroyOnClose
        width={520}
      >
        <Form form={form} layout="vertical" preserve={false}>
          {renderEditForm()}
        </Form>
      </Modal>
    </div>
  );
};

export default ConfigManage;
