'use client';

import React, { useEffect, useState } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import {
  Typography,
  Card,
  Table,
  Tag,
  Select,
  Button,
  Space,
  Tabs,
  Popconfirm,
  message,
  Result,
  Row,
  Col,
  Statistic,
  Input,
  Descriptions,
  Modal,
  Form,
  ColorPicker,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  SettingOutlined,
  UserOutlined,
  SafetyCertificateOutlined,
  CrownOutlined,
  TeamOutlined,
  DeleteOutlined,
  LinkOutlined,
  CheckCircleOutlined,
  GlobalOutlined,
  TagsOutlined,
  PlusOutlined,
  EditOutlined,
} from '@ant-design/icons';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { getUsers, updateUserRole, deleteUser } from '@/services/users';
import { getTags, createTag, updateTag, deleteTag } from '@/services/tags';
import type { UserProfile, UserRole, Tag as TagType } from '@/types/database';
import dayjs from 'dayjs';

const { Title, Text, Paragraph } = Typography;

type Color = { toHexString: () => string } | string;
export default function SettingsPage() {
  const { profile, user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [usersList, setUsersList] = useState<UserProfile[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);

  // Tags state
  const [tagsList, setTagsList] = useState<TagType[]>([]);
  const [loadingTags, setLoadingTags] = useState(false);
  const [tagModalOpen, setTagModalOpen] = useState(false);
  const [editingTag, setEditingTag] = useState<TagType | null>(null);
  const [tagSubmitting, setTagSubmitting] = useState(false);
  const [tagForm] = Form.useForm();

  const isAdmin = profile?.role === 'admin';

  const loadUsers = async () => {
    setLoadingUsers(true);
    try {
      const data = await getUsers();
      setUsersList(data);
    } catch {
      message.error('Erro ao carregar lista de usuários');
    } finally {
      setLoadingUsers(false);
    }
  };

  const loadTags = async () => {
    setLoadingTags(true);
    try {
      const data = await getTags();
      setTagsList(data);
    } catch {
      message.error('Erro ao carregar tags');
    } finally {
      setLoadingTags(false);
    }
  };

  useEffect(() => {
    if (isAdmin) {
      loadUsers();
      loadTags();
    }
  }, [isAdmin]);

  if (!authLoading && !isAdmin) {
    return (
      <AppLayout>
        <Result
          status="403"
          title="403 - Acesso Negado"
          subTitle="Apenas administradores possuem permissão para gerenciar usuários e configurações do sistema."
          extra={
            <Button type="primary" onClick={() => router.push('/dashboard')}>
              Voltar ao Dashboard
            </Button>
          }
        />
      </AppLayout>
    );
  }

  const handleRoleChange = async (userId: string, newRole: UserRole) => {
    setUpdatingUserId(userId);
    try {
      await updateUserRole(userId, newRole);
      setUsersList((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, role: newRole } : u))
      );
      message.success('Permissão do usuário atualizada com sucesso!');
    } catch {
      message.error('Erro ao alterar permissão do usuário');
    } finally {
      setUpdatingUserId(null);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (userId === profile?.id) {
      message.warning('Você não pode excluir o seu próprio perfil de administrador.');
      return;
    }
    try {
      await deleteUser(userId);
      setUsersList((prev) => prev.filter((u) => u.id !== userId));
      message.success('Usuário removido!');
    } catch {
      message.error('Erro ao excluir usuário');
    }
  };

  const handleOpenTagModal = (tag?: TagType) => {
    setEditingTag(tag || null);
    if (tag) {
      tagForm.setFieldsValue({ name: tag.name, color: tag.color });
    } else {
      tagForm.resetFields();
      tagForm.setFieldsValue({ color: '#1677ff' });
    }
    setTagModalOpen(true);
  };

  const handleTagSubmit = async () => {
    try {
      const values = await tagForm.validateFields();
      setTagSubmitting(true);
      const colorHex =
        typeof values.color === 'string'
          ? values.color
          : (values.color as any)?.toHexString?.() ?? '#1677ff';

      if (editingTag) {
        const updated = await updateTag(editingTag.id, { name: values.name, color: colorHex });
        setTagsList((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
        message.success('Tag atualizada!');
      } else {
        const created = await createTag({ name: values.name, color: colorHex });
        setTagsList((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)));
        message.success('Tag criada!');
      }
      setTagModalOpen(false);
    } catch {
      message.error('Erro ao salvar tag');
    } finally {
      setTagSubmitting(false);
    }
  };

  const handleDeleteTag = async (id: string) => {
    try {
      await deleteTag(id);
      setTagsList((prev) => prev.filter((t) => t.id !== id));
      message.success('Tag removida!');
    } catch {
      message.error('Erro ao remover tag');
    }
  };

  const totalUsers = usersList.length;
  const adminCount = usersList.filter((u) => u.role === 'admin').length;
  const qaCount = usersList.filter((u) => u.role === 'qa').length;
  const viewerCount = usersList.filter((u) => u.role === 'viewer').length;

  const userColumns: ColumnsType<UserProfile> = [
    {
      title: 'Colaborador',
      dataIndex: 'email',
      key: 'email',
      render: (email: string, record) => (
        <div>
          <Space align="center">
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: '50%',
                backgroundColor: record.role === 'admin' ? '#ff4d4f' : '#1677ff',
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 'bold',
                fontSize: 13,
              }}
            >
              {email.slice(0, 2).toUpperCase()}
            </div>
            <div>
              <div style={{ fontWeight: 600 }}>{email}</div>
              {record.id === profile?.id && (
                <Tag color="cyan" style={{ fontSize: 11, marginTop: 2 }}>
                  Você (Sessão Atual)
                </Tag>
              )}
            </div>
          </Space>
        </div>
      ),
    },
    {
      title: 'Papel no Sistema (Role)',
      dataIndex: 'role',
      key: 'role',
      width: 200,
      render: (role: UserRole, record) => (
        <Select
          value={role}
          onChange={(newVal) => handleRoleChange(record.id, newVal as UserRole)}
          loading={updatingUserId === record.id}
          disabled={record.id === profile?.id}
          style={{ width: 160 }}
          options={[
            { value: 'admin', label: 'Admin' },
            { value: 'qa', label: 'QA' },
            { value: 'viewer', label: 'Viewer' },
          ]}
        />
      ),
    },
    {
      title: 'Desde',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 140,
      render: (date: string) => dayjs(date).format('DD/MM/YYYY'),
    },
    {
      title: 'Ações',
      key: 'actions',
      width: 100,
      align: 'right',
      render: (_, record) => (
        <Popconfirm
          title="Remover acesso?"
          description="O usuário perderá acesso ao sistema."
          onConfirm={() => handleDeleteUser(record.id)}
          okText="Remover"
          cancelText="Cancelar"
          okButtonProps={{ danger: true }}
          disabled={record.id === profile?.id}
        >
          <Button
            size="small"
            danger
            icon={<DeleteOutlined />}
            disabled={record.id === profile?.id}
          />
        </Popconfirm>
      ),
    },
  ];

  const tagColumns: ColumnsType<TagType> = [
    {
      title: 'Tag',
      key: 'tag',
      render: (_, record) => (
        <Tag color={record.color} style={{ fontSize: 13, padding: '2px 10px' }}>
          {record.name}
        </Tag>
      ),
    },
    {
      title: 'Cor (hex)',
      dataIndex: 'color',
      key: 'color',
      width: 120,
      render: (color: string) => (
        <Space>
          <div
            style={{
              width: 16,
              height: 16,
              borderRadius: 3,
              backgroundColor: color,
              border: '1px solid rgba(128,128,128,0.3)',
            }}
          />
          <Text type="secondary" style={{ fontSize: 12 }}>{color}</Text>
        </Space>
      ),
    },
    {
      title: 'Criada em',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 140,
      render: (date: string) => dayjs(date).format('DD/MM/YYYY'),
    },
    {
      title: 'Ações',
      key: 'actions',
      width: 120,
      align: 'right',
      render: (_, record) => (
        <Space size="small">
          <Button
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleOpenTagModal(record)}
          />
          <Popconfirm
            title="Remover tag?"
            description="Os vínculos com casos de teste serão removidos automaticamente."
            onConfirm={() => handleDeleteTag(record.id)}
            okText="Remover"
            cancelText="Cancelar"
            okButtonProps={{ danger: true }}
          >
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const tabItems = [
    {
      key: 'team',
      label: (
        <span>
          <TeamOutlined /> Equipe &amp; Acesso
        </span>
      ),
      children: (
        <div>
          <Row gutter={16} style={{ marginBottom: 20 }}>
            <Col span={6}>
              <Card bordered={false}>
                <Statistic title="Total de Usuários" value={totalUsers} prefix={<UserOutlined />} />
              </Card>
            </Col>
            <Col span={6}>
              <Card bordered={false}>
                <Statistic title="Admins" value={adminCount} prefix={<CrownOutlined />} valueStyle={{ color: '#ff4d4f' }} />
              </Card>
            </Col>
            <Col span={6}>
              <Card bordered={false}>
                <Statistic title="QAs" value={qaCount} prefix={<CheckCircleOutlined />} valueStyle={{ color: '#1677ff' }} />
              </Card>
            </Col>
            <Col span={6}>
              <Card bordered={false}>
                <Statistic title="Viewers" value={viewerCount} prefix={<UserOutlined />} valueStyle={{ color: '#8c8c8c' }} />
              </Card>
            </Col>
          </Row>
          <Table
            columns={userColumns}
            dataSource={usersList}
            rowKey="id"
            loading={loadingUsers}
            pagination={false}
          />
        </div>
      ),
    },
    {
      key: 'tags',
      label: (
        <span>
          <TagsOutlined /> Tags
        </span>
      ),
      children: (
        <div>
          <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text type="secondary">
              Tags são usadas para classificar casos de teste e filtrar a criação de ciclos de execução.
              Qualquer membro pode criar e aplicar tags; apenas admins podem excluí-las.
            </Text>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => handleOpenTagModal()}
            >
              Nova Tag
            </Button>
          </div>
          <Table
            columns={tagColumns}
            dataSource={tagsList}
            rowKey="id"
            loading={loadingTags}
            pagination={false}
            locale={{
              emptyText: (
                <div style={{ padding: '30px 0', textAlign: 'center' }}>
                  <Text type="secondary">Nenhuma tag cadastrada. Crie a primeira!</Text>
                </div>
              ),
            }}
          />
        </div>
      ),
    },
    {
      key: 'security',
      label: (
        <span>
          <SafetyCertificateOutlined /> Segurança &amp; Domínio
        </span>
      ),
      children: (
        <Card bordered={false}>
          <Descriptions
            title="Política de Acesso"
            bordered
            column={1}
            size="small"
          >
            <Descriptions.Item label="Domínio permitido">
              <Tag color="blue">@insanemedia.com.br</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="Restrição aplicada em">
              Frontend (validação imediata) + Database Trigger (backend)
            </Descriptions.Item>
            <Descriptions.Item label="Administrador padrão">
              bruno.melo@insanemedia.com.br
            </Descriptions.Item>
          </Descriptions>
        </Card>
      ),
    },
    {
      key: 'integrations',
      label: (
        <span>
          <LinkOutlined /> Integrações
        </span>
      ),
      children: (
        <Card bordered={false}>
          <Title level={5}>ClickUp</Title>
          <Paragraph type="secondary">
            Cole a URL base do seu workspace do ClickUp. Os links de bugs serão
            validados e exibidos como atalhos clicáveis nos comentários dos ciclos de teste.
          </Paragraph>
          <Space>
            <Input
              prefix={<GlobalOutlined />}
              placeholder="https://app.clickup.com/t/..."
              style={{ width: 400 }}
            />
            <Button icon={<CheckCircleOutlined />}>Salvar</Button>
          </Space>
        </Card>
      ),
    },
  ];

  return (
    <AppLayout>
      <div style={{ marginBottom: 24 }}>
        <Space align="center">
          <SettingOutlined style={{ fontSize: 20 }} />
          <Title level={3} style={{ margin: 0 }}>
            Configurações
          </Title>
        </Space>
        <Text type="secondary">Gerencie equipe, tags e configurações do sistema.</Text>
      </div>

      <Card bordered={false}>
        <Tabs items={tabItems} defaultActiveKey="team" />
      </Card>

      {/* Modal de criação/edição de tag */}
      <Modal
        title={editingTag ? 'Editar Tag' : 'Nova Tag'}
        open={tagModalOpen}
        onOk={handleTagSubmit}
        onCancel={() => setTagModalOpen(false)}
        confirmLoading={tagSubmitting}
        okText={editingTag ? 'Salvar' : 'Criar'}
        cancelText="Cancelar"
        destroyOnClose
      >
        <Form form={tagForm} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item
            name="name"
            label="Nome da Tag"
            rules={[
              { required: true, message: 'Informe o nome da tag' },
              { min: 2, message: 'Mínimo de 2 caracteres' },
            ]}
          >
            <Input placeholder="Ex: Smoke, Regressão, Crítico..." />
          </Form.Item>
          <Form.Item name="color" label="Cor">
            <ColorPicker
              format="hex"
              presets={[
                {
                  label: 'Sugeridas',
                  colors: [
                    '#fa8c16', '#1677ff', '#52c41a', '#ff4d4f',
                    '#722ed1', '#13c2c2', '#eb2f96', '#fadb14',
                  ],
                },
              ]}
            />
          </Form.Item>
        </Form>
      </Modal>
    </AppLayout>
  );
}
