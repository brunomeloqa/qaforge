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
} from '@ant-design/icons';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { getUsers, updateUserRole, deleteUser } from '@/services/users';
import type { UserProfile, UserRole } from '@/types/database';
import dayjs from 'dayjs';

const { Title, Text, Paragraph } = Typography;

export default function SettingsPage() {
  const { profile, user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [usersList, setUsersList] = useState<UserProfile[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);

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

  useEffect(() => {
    if (isAdmin) {
      loadUsers();
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

  const totalUsers = usersList.length;
  const adminCount = usersList.filter((u) => u.role === 'admin').length;
  const qaCount = usersList.filter((u) => u.role === 'qa').length;
  const viewerCount = usersList.filter((u) => u.role === 'viewer').length;

  const columns: ColumnsType<UserProfile> = [
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
          style={{ width: 140 }}
          options={[
            {
              value: 'admin',
              label: (
                <Tag color="red" icon={<CrownOutlined />}>
                  ADMIN
                </Tag>
              ),
            },
            {
              value: 'qa',
              label: (
                <Tag color="blue" icon={<SafetyCertificateOutlined />}>
                  QA
                </Tag>
              ),
            },
            {
              value: 'viewer',
              label: (
                <Tag color="green" icon={<UserOutlined />}>
                  VIEWER
                </Tag>
              ),
            },
          ]}
        />
      ),
    },
    {
      title: 'Cadastrado em',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 140,
      render: (date: string) => dayjs(date).format('DD/MM/YYYY'),
      sorter: (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
    },
    {
      title: 'Ações',
      key: 'actions',
      width: 100,
      align: 'right',
      render: (_, record) => (
        <Popconfirm
          title="Remover usuário?"
          description="O acesso desta conta ao sistema será revogado."
          disabled={record.id === profile?.id}
          onConfirm={() => handleDeleteUser(record.id)}
          okText="Remover"
          cancelText="Cancelar"
          okButtonProps={{ danger: true }}
        >
          <Button
            size="small"
            danger
            icon={<DeleteOutlined />}
            disabled={record.id === profile?.id}
            title={record.id === profile?.id ? 'Você não pode excluir sua própria conta' : 'Excluir'}
          />
        </Popconfirm>
      ),
    },
  ];

  return (
    <AppLayout>
      <div style={{ marginBottom: 20 }}>
        <Title level={4} style={{ margin: 0 }}>
          Painel de Administração & Configurações
        </Title>
        <Text type="secondary">
          Gerenciamento de acessos da equipe Insane Media, permissões e parâmetros do sistema
        </Text>
      </div>

      <Tabs
        defaultActiveKey="team"
        items={[
          {
            key: 'team',
            label: (
              <span>
                <TeamOutlined />
                Equipe & Controle de Acessos
              </span>
            ),
            children: (
              <div>
                {/* Stats Row */}
                <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
                  <Col xs={24} sm={12} lg={6}>
                    <Card bordered={false}>
                      <Statistic
                        title="Total de Colaboradores"
                        value={totalUsers}
                        prefix={<TeamOutlined style={{ color: '#1677ff' }} />}
                      />
                    </Card>
                  </Col>
                  <Col xs={24} sm={12} lg={6}>
                    <Card bordered={false}>
                      <Statistic
                        title="Administradores"
                        value={adminCount}
                        prefix={<CrownOutlined style={{ color: '#ff4d4f' }} />}
                      />
                    </Card>
                  </Col>
                  <Col xs={24} sm={12} lg={6}>
                    <Card bordered={false}>
                      <Statistic
                        title="Membros de QA"
                        value={qaCount}
                        prefix={<SafetyCertificateOutlined style={{ color: '#1677ff' }} />}
                      />
                    </Card>
                  </Col>
                  <Col xs={24} sm={12} lg={6}>
                    <Card bordered={false}>
                      <Statistic
                        title="Visualizadores (Viewers)"
                        value={viewerCount}
                        prefix={<UserOutlined style={{ color: '#52c41a' }} />}
                      />
                    </Card>
                  </Col>
                </Row>

                {/* Users Table */}
                <Card bordered={false} bodyStyle={{ padding: 0 }}>
                  <Table
                    columns={columns}
                    dataSource={usersList}
                    rowKey="id"
                    loading={loadingUsers}
                    pagination={{ pageSize: 10 }}
                  />
                </Card>
              </div>
            ),
          },
          {
            key: 'security',
            label: (
              <span>
                <SafetyCertificateOutlined />
                Segurança & Domínio Corporativo
              </span>
            ),
            children: (
              <Card bordered={false}>
                <Descriptions title="Políticas de Segurança do QAForge" bordered column={1}>
                  <Descriptions.Item label="Domínio Corporativo Permitido">
                    <Tag color="blue" icon={<GlobalOutlined />} style={{ fontSize: 13, padding: '4px 10px' }}>
                      @insanemedia.com.br
                    </Tag>
                    <div style={{ marginTop: 6, color: '#8c8c8c', fontSize: 12 }}>
                      Apenas e-mails terminados em @insanemedia.com.br têm permissão para criar contas e fazer login.
                    </div>
                  </Descriptions.Item>
                  <Descriptions.Item label="Papel Padrão para Novos Colaboradores">
                    <Tag color="blue">QA (Criação e Execução de Testes)</Tag>
                    <div style={{ marginTop: 6, color: '#8c8c8c', fontSize: 12 }}>
                      Ao fazer login pela primeira vez, o colaborador recebe perfil de QA automaticamente. O Admin pode alterar para Viewer ou Admin quando desejar.
                    </div>
                  </Descriptions.Item>
                  <Descriptions.Item label="Auditoria e Rastreabilidade">
                    <Tag color="green" icon={<CheckCircleOutlined />}>
                      Ativo (Tabela audit_logs)
                    </Tag>
                    <div style={{ marginTop: 6, color: '#8c8c8c', fontSize: 12 }}>
                      Todas as ações de exclusão e fechamento de ciclos de testes são gravadas com timestamp e ID do usuário executor.
                    </div>
                  </Descriptions.Item>
                </Descriptions>
              </Card>
            ),
          },
          {
            key: 'integrations',
            label: (
              <span>
                <LinkOutlined />
                Integrações & ClickUp
              </span>
            ),
            children: (
              <Card bordered={false}>
                <Descriptions title="Integrações de Gestão de Tarefas" bordered column={1}>
                  <Descriptions.Item label="ClickUp Workspace">
                    <Input
                      defaultValue="https://app.clickup.com/"
                      style={{ maxWidth: 450 }}
                      placeholder="https://app.clickup.com/..."
                    />
                    <div style={{ marginTop: 6, color: '#8c8c8c', fontSize: 12 }}>
                      URLs coladas no campo de comentário de testes com links do ClickUp abrem automaticamente em nova aba.
                    </div>
                  </Descriptions.Item>
                  <Descriptions.Item label="Repositório Oficial do Projeto">
                    <a
                      href="https://github.com/brunomeloqa/qaforge"
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                    >
                      <LinkOutlined /> https://github.com/brunomeloqa/qaforge
                    </a>
                  </Descriptions.Item>
                </Descriptions>
              </Card>
            ),
          },
        ]}
      />
    </AppLayout>
  );
}
