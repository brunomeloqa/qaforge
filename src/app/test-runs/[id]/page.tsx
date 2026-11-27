'use client';

import React, { useEffect, useState, useMemo } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import {
  Typography,
  Button,
  Space,
  Table,
  Input,
  Select,
  Breadcrumb,
  Card,
  Progress,
  Tag,
  message,
  Tooltip,
  InputNumber,
  Form,
  Modal,
  Alert,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  SearchOutlined,
  ArrowLeftOutlined,
  CheckOutlined,
  UndoOutlined,
  BranchesOutlined,
  LinkOutlined,
  SaveOutlined,
  BugOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import { useParams, useRouter } from 'next/navigation';
import {
  getTestRunById,
  updateTestRunStatus,
  updateTestRunItem,
  type TestRunSummary,
} from '@/services/testRuns';
import { updateBranch, getBranchById } from '@/services/branches';
import type { TestRunItem, ItemStatus, QaBranch, BranchStatus } from '@/types/database';
import PriorityTag from '@/components/testCases/PriorityTag';
import RunStatusTag from '@/components/testRuns/RunStatusTag';
import ItemStatusTag, { itemStatusConfig } from '@/components/testRuns/ItemStatusTag';
import { useAuth } from '@/context/AuthContext';
import dayjs from 'dayjs';

const { Title, Text } = Typography;

export default function TestRunExecutionPage() {
  const params = useParams();
  const router = useRouter();
  const runId = params.id as string;
  const { user, profile } = useAuth();
  const isViewer = profile?.role === 'viewer';

  const [run, setRun] = useState<TestRunSummary | null>(null);
  const [items, setItems] = useState<(TestRunItem & { qa_email?: string | null })[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [updatingItemId, setUpdatingItemId] = useState<string | null>(null);

  // Local comments editing map to avoid losing keystrokes
  const [commentsMap, setCommentsMap] = useState<Record<string, string>>({});

  // Branch closure state
  const [branch, setBranch] = useState<QaBranch | null>(null);
  const [closeModalOpen, setCloseModalOpen] = useState(false);
  const [closeForm] = Form.useForm();
  const [closing, setClosing] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await getTestRunById(runId);
      setRun(data.run);
      setItems(data.items);

      const initialComments: Record<string, string> = {};
      data.items.forEach((item) => {
        initialComments[item.id] = item.comment || '';
      });
      setCommentsMap(initialComments);

      // Load linked branch if exists and run is open
      if (data.run?.qa_branch_id && data.run.status === 'open') {
        const b = await getBranchById(data.run.qa_branch_id);
        setBranch(b);
      }
    } catch {
      message.error('Erro ao carregar dados do ciclo de teste');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (runId) {
      loadData();
    }
  }, [runId]);

  // Inline Status Change
  const handleStatusChange = async (itemId: string, newStatus: ItemStatus) => {
    if (isViewer) return;

    setUpdatingItemId(itemId);
    const qaId = profile?.id || user?.id || null;
    const qaEmail = profile?.email || user?.email || null;

    try {
      await updateTestRunItem(itemId, {
        status: newStatus,
        qa_id: qaId,
      });

      setItems((prev) =>
        prev.map((item) =>
          item.id === itemId
            ? {
                ...item,
                status: newStatus,
                qa_id: qaId,
                qa_email: qaEmail,
                updated_at: new Date().toISOString(),
              }
            : item
        )
      );

      if (run) {
        setRun((prevRun) => {
          if (!prevRun) return null;
          const updatedItems = items.map((i) =>
            i.id === itemId ? { ...i, status: newStatus } : i
          );
          return {
            ...prevRun,
            done_count: updatedItems.filter((i) => i.status === 'done').length,
            failed_count: updatedItems.filter((i) => i.status === 'failed').length,
            testing_count: updatedItems.filter((i) => i.status === 'testing').length,
            to_test_count: updatedItems.filter((i) => i.status === 'to_test').length,
          };
        });
      }

      message.success(`Status atualizado para "${itemStatusConfig[newStatus]?.label || newStatus}"`);
    } catch {
      message.error('Erro ao atualizar status');
    } finally {
      setUpdatingItemId(null);
    }
  };

  // Inline Comment Save
  const handleCommentBlur = async (itemId: string) => {
    if (isViewer) return;

    const currentComment = commentsMap[itemId] ?? '';
    const originalItem = items.find((i) => i.id === itemId);

    if (originalItem && (originalItem.comment || '') === currentComment) {
      return;
    }

    try {
      await updateTestRunItem(itemId, {
        comment: currentComment,
        qa_id: profile?.id || user?.id || null,
      });
      setItems((prev) =>
        prev.map((item) =>
          item.id === itemId
            ? {
                ...item,
                comment: currentComment,
                qa_email: profile?.email || user?.email || item.qa_email,
                updated_at: new Date().toISOString(),
              }
            : item
        )
      );
      message.success('Comentário salvo!');
    } catch {
      message.error('Erro ao salvar comentário');
    }
  };

  // Open close modal (requires branch update if linked)
  const handleClickFinalize = () => {
    if (!run || isViewer) return;
    if (branch) {
      closeForm.setFieldsValue({
        bugs_created_count: branch.bugs_created_count || 0,
        rejected_cards_count: branch.rejected_cards_count || 0,
        rejection_count: branch.rejection_count || 0,
        status: branch.status,
        reason: branch.reason || '',
      });
      setCloseModalOpen(true);
    } else {
      handleCloseRun();
    }
  };

  const handleCloseRun = async (branchValues?: {
    bugs_created_count: number;
    rejected_cards_count: number;
    rejection_count: number;
    status: BranchStatus;
    reason?: string;
  }) => {
    if (!run) return;
    setClosing(true);
    try {
      if (branch && branchValues) {
        await updateBranch(branch.id, {
          bugs_created_count: branchValues.bugs_created_count,
          rejected_cards_count: branchValues.rejected_cards_count,
          rejection_count: branchValues.rejection_count,
          status: branchValues.status,
          reason: branchValues.reason || null,
        });
      }
      await updateTestRunStatus(run.id, 'closed');
      setRun({ ...run, status: 'closed' });
      setBranch(null);
      setCloseModalOpen(false);
      message.success('Ciclo finalizado e branch atualizada!');
    } catch {
      message.error('Erro ao finalizar ciclo');
    } finally {
      setClosing(false);
    }
  };

  const handleCloseModalOk = async () => {
    try {
      const values = await closeForm.validateFields();
      await handleCloseRun(values);
    } catch {
      // form validation error
    }
  };

  const handleReopenRun = async () => {
    if (!run || isViewer) return;
    try {
      await updateTestRunStatus(run.id, 'open');
      setRun({ ...run, status: 'open' });
      // Re-load branch if exists
      if (run.qa_branch_id) {
        const b = await getBranchById(run.qa_branch_id);
        setBranch(b);
      }
      message.success('Ciclo reaberto para execução!');
    } catch {
      message.error('Erro ao reabrir ciclo');
    }
  };

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const matchesSearch =
        item.title_snapshot.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (item.comment && item.comment.toLowerCase().includes(searchTerm.toLowerCase()));
      const matchesStatus = statusFilter === 'all' || item.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [items, searchTerm, statusFilter]);

  const totalItems = run?.total_items || items.length;
  const doneCount = items.filter((i) => i.status === 'done').length;
  const failedCount = items.filter((i) => i.status === 'failed').length;
  const testingCount = items.filter((i) => i.status === 'testing').length;
  const toTestCount = items.filter((i) => i.status === 'to_test').length;

  const progressPercent =
    totalItems > 0 ? Math.round(((doneCount + failedCount) / totalItems) * 100) : 0;

  const branchStatusField = Form.useWatch('status', closeForm);

  const columns: ColumnsType<TestRunItem & { qa_email?: string | null }> = [
    {
      title: 'Caso de Teste (Snapshot Imutável)',
      dataIndex: 'title_snapshot',
      key: 'title_snapshot',
      render: (title: string, record) => (
        <div>
          <div style={{ fontWeight: 500, fontSize: 14 }}>{title}</div>
          <div style={{ marginTop: 4 }}>
            <PriorityTag priority={record.priority_snapshot} />
          </div>
        </div>
      ),
    },
    {
      title: 'Status da Execução (Inline)',
      dataIndex: 'status',
      key: 'status',
      width: 170,
      render: (status: ItemStatus, record) => {
        if (isViewer) {
          return <ItemStatusTag status={status} />;
        }

        return (
          <Select
            value={status}
            onChange={(newVal) => handleStatusChange(record.id, newVal as ItemStatus)}
            loading={updatingItemId === record.id}
            style={{ width: 145 }}
            dropdownMatchSelectWidth={false}
            options={[
              { value: 'to_test', label: <span><ItemStatusTag status="to_test" /></span> },
              { value: 'testing', label: <span><ItemStatusTag status="testing" /></span> },
              { value: 'failed', label: <span><ItemStatusTag status="failed" /></span> },
              { value: 'done', label: <span><ItemStatusTag status="done" /></span> },
            ]}
          />
        );
      },
    },
    {
      title: 'Comentário / Link do Bug (ClickUp)',
      dataIndex: 'comment',
      key: 'comment',
      render: (_, record) => {
        const commentValue = commentsMap[record.id] ?? record.comment ?? '';
        const isUrl =
          commentValue.startsWith('http://') ||
          commentValue.startsWith('https://') ||
          commentValue.includes('clickup.com');

        return (
          <div>
            <Input
              value={commentValue}
              disabled={isViewer}
              placeholder="Cole a URL do ClickUp ou adicione observações..."
              onChange={(e) =>
                setCommentsMap({ ...commentsMap, [record.id]: e.target.value })
              }
              onBlur={() => handleCommentBlur(record.id)}
              onPressEnter={() => handleCommentBlur(record.id)}
              suffix={
                isUrl ? (
                  <a href={commentValue} target="_blank" rel="noopener noreferrer">
                    <LinkOutlined style={{ color: '#1677ff' }} />
                  </a>
                ) : null
              }
            />
          </div>
        );
      },
    },
    {
      title: 'QA Executor',
      dataIndex: 'qa_email',
      key: 'qa_email',
      width: 140,
      render: (email: string | null) =>
        email ? (
          <Text type="secondary" style={{ fontSize: 13 }}>
            {email.split('@')[0]}
          </Text>
        ) : (
          <Text type="secondary">-</Text>
        ),
    },
    {
      title: 'Atualizado em',
      dataIndex: 'updated_at',
      key: 'updated_at',
      width: 130,
      render: (date: string) => dayjs(date).format('DD/MM HH:mm'),
      sorter: (a, b) => new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime(),
    },
  ];

  return (
    <AppLayout>
      <Breadcrumb
        style={{ marginBottom: 16 }}
        items={[
          {
            title: (
              <span
                style={{ cursor: 'pointer', color: '#1677ff' }}
                onClick={() => router.push('/test-runs')}
              >
                Ciclos de Execução
              </span>
            ),
          },
          { title: run?.title || 'Execução do Ciclo' },
        ]}
      />

      {/* Header Info Card */}
      <Card bordered={false} style={{ marginBottom: 20 }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            flexWrap: 'wrap',
            gap: 16,
          }}
        >
          <div>
            <Space align="center" wrap>
              <Button
                icon={<ArrowLeftOutlined />}
                onClick={() => router.push('/test-runs')}
                style={{ marginRight: 4 }}
              />
              <Title level={3} style={{ margin: 0 }}>
                {run?.title}
              </Title>
              {run && <RunStatusTag status={run.status} />}
              {run?.branch_name && (
                <Tag icon={<BranchesOutlined />} color="blue">
                  {run.branch_name}
                </Tag>
              )}
            </Space>

            <div style={{ marginTop: 8 }}>
              <Text type="secondary">
                Criado em {dayjs(run?.created_at).format('DD/MM/YYYY [às] HH:mm')} • Total de {totalItems} testes no snapshot
              </Text>
            </div>
          </div>

          {!isViewer && run && (
            <Space>
              {run.status === 'open' ? (
                <Button
                  type="primary"
                  icon={<CheckOutlined />}
                  onClick={handleClickFinalize}
                >
                  {branch ? 'Finalizar e Atualizar Branch' : 'Finalizar Ciclo'}
                </Button>
              ) : (
                <Button
                  icon={<UndoOutlined />}
                  onClick={handleReopenRun}
                >
                  Reabrir Ciclo
                </Button>
              )}
            </Space>
          )}
        </div>

        {/* Progress Section */}
        <div style={{ marginTop: 20 }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              marginBottom: 6,
              fontSize: 13,
            }}
          >
            <span>
              <strong>Progresso da Execução:</strong> {progressPercent}% finalizado
            </span>
            <Space size="middle">
              <span style={{ color: '#52c41a', fontWeight: 600 }}>✓ Passou: {doneCount}</span>
              <span style={{ color: '#ff4d4f', fontWeight: 600 }}>✕ Falhou: {failedCount}</span>
              <span style={{ color: '#fa8c16', fontWeight: 600 }}>⟳ Testando: {testingCount}</span>
              <span style={{ color: '#8c8c8c', fontWeight: 600 }}>⋯ A Testar: {toTestCount}</span>
            </Space>
          </div>

          <Progress
            percent={progressPercent}
            status={run?.status === 'closed' ? 'success' : 'active'}
            strokeColor={{
              '0%': '#1677ff',
              '100%': '#52c41a',
            }}
          />
        </div>
      </Card>

      {/* Execution Table Card */}
      <Card bordered={false} bodyStyle={{ padding: 0 }}>
        <div
          style={{
            padding: '16px 20px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 12,
            borderBottom: '1px solid rgba(128, 128, 128, 0.15)',
          }}
        >
          <Title level={5} style={{ margin: 0 }}>
            Itens em Execução ({filteredItems.length} de {items.length})
          </Title>

          <Space size="middle">
            <Select
              value={statusFilter}
              onChange={setStatusFilter}
              style={{ width: 140 }}
              options={[
                { value: 'all', label: 'Todos Status' },
                { value: 'to_test', label: 'A Testar' },
                { value: 'testing', label: 'Testando' },
                { value: 'failed', label: 'Falhou' },
                { value: 'done', label: 'Passou' },
              ]}
            />
            <Input
              placeholder="Buscar por teste ou comentário..."
              prefix={<SearchOutlined />}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              allowClear
              style={{ width: 260 }}
            />
          </Space>
        </div>

        <Table
          columns={columns}
          dataSource={filteredItems}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 20, showSizeChanger: true }}
          locale={{
            emptyText: (
              <div style={{ padding: '30px 0', textAlign: 'center' }}>
                <Text type="secondary">Nenhum teste encontrado neste filtro.</Text>
              </div>
            ),
          }}
        />
      </Card>

      {/* Modal de Finalização com atualização de branch */}
      <Modal
        title={
          <Space>
            <BranchesOutlined />
            Finalizar Ciclo — Atualizar Branch
          </Space>
        }
        open={closeModalOpen}
        onOk={handleCloseModalOk}
        onCancel={() => setCloseModalOpen(false)}
        confirmLoading={closing}
        okText="Finalizar e Salvar"
        cancelText="Cancelar"
        width={520}
        destroyOnClose
      >
        {branch && (
          <>
            <Alert
              message={`Branch vinculada: ${branch.name}`}
              type="info"
              showIcon
              icon={<BranchesOutlined />}
              style={{ marginBottom: 20 }}
            />
            <Form form={closeForm} layout="vertical">
              <Space style={{ width: '100%' }} direction="vertical">
                <div style={{ display: 'flex', gap: 16 }}>
                  <Form.Item
                    name="bugs_created_count"
                    label={<Space><BugOutlined /> Bugs Encontrados</Space>}
                    rules={[{ required: true, message: 'Informe a quantidade' }]}
                    style={{ flex: 1, marginBottom: 0 }}
                  >
                    <InputNumber min={0} style={{ width: '100%' }} />
                  </Form.Item>
                  <Form.Item
                    name="rejected_cards_count"
                    label={<Space><WarningOutlined /> Cards Reprovados</Space>}
                    rules={[{ required: true, message: 'Informe a quantidade' }]}
                    style={{ flex: 1, marginBottom: 0 }}
                  >
                    <InputNumber min={0} style={{ width: '100%' }} />
                  </Form.Item>
                  <Form.Item
                    name="rejection_count"
                    label="Nº de Retornos"
                    rules={[{ required: true, message: 'Informe a quantidade' }]}
                    style={{ flex: 1, marginBottom: 0 }}
                  >
                    <InputNumber min={0} style={{ width: '100%' }} />
                  </Form.Item>
                </div>

                <Form.Item
                  name="status"
                  label="Status da Branch"
                  rules={[{ required: true, message: 'Selecione o status' }]}
                  style={{ marginBottom: 0 }}
                >
                  <Select
                    options={[
                      { value: 'approved', label: '✅ Aprovada' },
                      { value: 'rejected', label: '❌ Reprovada' },
                      { value: 'testing', label: '🔄 Manter Em Teste' },
                    ]}
                  />
                </Form.Item>

                {branchStatusField === 'rejected' && (
                  <Form.Item
                    name="reason"
                    label="Motivo da reprovação"
                    rules={[{ required: true, message: 'Informe o motivo da reprovação' }]}
                    style={{ marginBottom: 0 }}
                  >
                    <Input.TextArea
                      rows={3}
                      placeholder="Descreva o motivo da reprovação da branch..."
                    />
                  </Form.Item>
                )}
              </Space>
            </Form>
          </>
        )}
      </Modal>
    </AppLayout>
  );
}
