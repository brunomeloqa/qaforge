'use client';

import React, { useEffect, useState } from 'react';
import {
  Modal,
  Form,
  Input,
  Select,
  Checkbox,
  Collapse,
  Typography,
  Space,
  Badge,
  message,
  Divider,
  Button,
  Tag,
} from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { getBranches, createBranch } from '@/services/branches';
import { getFeaturesWithCounts } from '@/services/features';
import { getTags, createTag, getTestCaseIdsByTag } from '@/services/tags';
import { createClient } from '@/lib/supabase/client';
import type { QaBranch, Tag as TagType } from '@/types/database';
import type { FeatureWithCount } from '@/services/features';
import PriorityTag from '@/components/testCases/PriorityTag';

const { Text } = Typography;

interface CreateRunModalProps {
  open: boolean;
  onCancel: () => void;
  onSubmit: (values: {
    title: string;
    qa_branch_id?: string | null;
    selectedTestCaseIds: string[];
  }) => Promise<void>;
  loading?: boolean;
}

interface FeatureWithTests extends FeatureWithCount {
  tests: { id: string; title: string; priority: string }[];
}

export default function CreateRunModal({
  open,
  onCancel,
  onSubmit,
  loading = false,
}: CreateRunModalProps) {
  const [form] = Form.useForm();
  const [branches, setBranches] = useState<QaBranch[]>([]);
  const [availableTags, setAvailableTags] = useState<TagType[]>([]);
  const [featuresWithTests, setFeaturesWithTests] = useState<FeatureWithTests[]>([]);
  const [selectedTestIds, setSelectedTestIds] = useState<Set<string>>(new Set());
  const [loadingData, setLoadingData] = useState(false);

  // Branch: 'existing' | 'new'
  const [branchMode, setBranchMode] = useState<'existing' | 'new'>('existing');
  const [newBranchName, setNewBranchName] = useState('');

  // Tag filter
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [filteredByTagCaseIds, setFilteredByTagCaseIds] = useState<Set<string> | null>(null);

  // Inline new tag creation
  const [newTagName, setNewTagName] = useState('');
  const [creatingTag, setCreatingTag] = useState(false);

  useEffect(() => {
    if (open) {
      loadInitialData();
      form.resetFields();
      setSelectedTestIds(new Set());
      setBranchMode('existing');
      setNewBranchName('');
      setSelectedTagIds([]);
      setFilteredByTagCaseIds(null);
    }
  }, [open]);

  const loadInitialData = async () => {
    setLoadingData(true);
    try {
      const supabase = createClient();
      const [branchesData, featuresData, tagsData] = await Promise.all([
        getBranches(),
        getFeaturesWithCounts(),
        getTags(),
      ]);
      setBranches(branchesData);
      setAvailableTags(tagsData);

      const { data: allTestCases } = await supabase
        .from('test_cases')
        .select('id, feature_id, title, priority')
        .order('created_at', { ascending: true });

      const mapped = featuresData.map((f) => ({
        ...f,
        tests: (allTestCases || []).filter((tc) => tc.feature_id === f.id),
      }));
      setFeaturesWithTests(mapped);
    } catch {
      message.error('Erro ao carregar dados');
    } finally {
      setLoadingData(false);
    }
  };

  const handleTagFilterChange = async (tagIds: string[]) => {
    setSelectedTagIds(tagIds);
    setSelectedTestIds(new Set()); // reset selection when filter changes
    if (tagIds.length === 0) {
      setFilteredByTagCaseIds(null);
      return;
    }
    try {
      const ids = await getTestCaseIdsByTag(tagIds);
      setFilteredByTagCaseIds(new Set(ids));
    } catch {
      message.error('Erro ao filtrar por tags');
    }
  };

  const handleInlineCreateTag = async () => {
    const name = newTagName.trim();
    if (!name) return;
    setCreatingTag(true);
    try {
      const created = await createTag({ name, color: '#1677ff' });
      setAvailableTags((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)));
      setSelectedTagIds((prev) => [...prev, created.id]);
      await handleTagFilterChange([...selectedTagIds, created.id]);
      setNewTagName('');
      message.success(`Tag "${created.name}" criada!`);
    } catch {
      message.error('Erro ao criar tag');
    } finally {
      setCreatingTag(false);
    }
  };

  const visibleTests = (tests: { id: string; title: string; priority: string }[]) => {
    if (!filteredByTagCaseIds) return tests;
    return tests.filter((t) => filteredByTagCaseIds.has(t.id));
  };

  const toggleTestCase = (id: string) => {
    setSelectedTestIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleFeatureAll = (feature: FeatureWithTests, checked: boolean) => {
    const visible = visibleTests(feature.tests).map((t) => t.id);
    setSelectedTestIds((prev) => {
      const next = new Set(prev);
      visible.forEach((id) => (checked ? next.add(id) : next.delete(id)));
      return next;
    });
  };

  const handleOk = async () => {
    try {
      const values = await form.validateFields();
      if (branchMode === 'new' && !newBranchName.trim()) {
        message.error('Informe o nome da branch');
        return;
      }
      if (selectedTestIds.size === 0) {
        message.error('Selecione ao menos um caso de teste');
        return;
      }

      let branchId: string | null = values.qa_branch_id || null;

      if (branchMode === 'new') {
        const created = await createBranch({ name: newBranchName.trim(), status: 'testing' });
        branchId = created.id;
      }

      await onSubmit({
        title: values.title,
        qa_branch_id: branchId,
        selectedTestCaseIds: Array.from(selectedTestIds),
      });
    } catch {
      // form validation error
    }
  };

  const collapseItems = featuresWithTests
    .filter((f) => {
      const visible = visibleTests(f.tests);
      return visible.length > 0;
    })
    .map((feature) => {
      const visible = visibleTests(feature.tests);
      const selectedCount = visible.filter((t) => selectedTestIds.has(t.id)).length;
      const allSelected = visible.length > 0 && selectedCount === visible.length;

      return {
        key: feature.id,
        label: (
          <Space>
            <Checkbox
              checked={allSelected}
              indeterminate={selectedCount > 0 && !allSelected}
              onChange={(e) => toggleFeatureAll(feature, e.target.checked)}
              onClick={(e) => e.stopPropagation()}
            />
            <Text strong>{feature.title}</Text>
            <Badge count={selectedCount} showZero color={selectedCount > 0 ? '#1677ff' : '#d9d9d9'} />
            <Text type="secondary">/ {visible.length} testes</Text>
          </Space>
        ),
        children: (
          <Space direction="vertical" style={{ width: '100%' }}>
            {visible.map((test) => (
              <div
                key={test.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '4px 0',
                  cursor: 'pointer',
                }}
                onClick={() => toggleTestCase(test.id)}
              >
                <Checkbox checked={selectedTestIds.has(test.id)} />
                <PriorityTag priority={test.priority} />
                <Text style={{ flex: 1 }}>{test.title}</Text>
              </div>
            ))}
          </Space>
        ),
      };
    });

  return (
    <Modal
      title="Novo Ciclo de Execução"
      open={open}
      onOk={handleOk}
      onCancel={onCancel}
      confirmLoading={loading}
      okText="Criar Ciclo"
      cancelText="Cancelar"
      width={700}
      destroyOnClose
    >
      <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
        {/* Título */}
        <Form.Item
          name="title"
          label="Título do Ciclo"
          rules={[{ required: true, message: 'Informe o título do ciclo' }]}
        >
          <Input placeholder="Ex: Sprint 23 — Checkout e Pagamentos" />
        </Form.Item>

        {/* Branch */}
        <Form.Item label="Branch Testada">
          <Space direction="vertical" style={{ width: '100%' }}>
            <Select
              value={branchMode}
              onChange={(v) => { setBranchMode(v); setNewBranchName(''); }}
              style={{ width: 220 }}
              options={[
                { value: 'existing', label: 'Vincular branch existente' },
                { value: 'new', label: 'Criar nova branch agora' },
              ]}
            />
            {branchMode === 'existing' ? (
              <Form.Item name="qa_branch_id" noStyle>
                <Select
                  allowClear
                  placeholder="Selecione uma branch (opcional)"
                  style={{ width: '100%' }}
                  showSearch
                  filterOption={(input, opt) =>
                    (opt?.label as string)?.toLowerCase().includes(input.toLowerCase())
                  }
                  options={branches.map((b) => ({ value: b.id, label: b.name }))}
                />
              </Form.Item>
            ) : (
              <Input
                placeholder="Nome da nova branch (Ex: feature/login-redesign)"
                value={newBranchName}
                onChange={(e) => setNewBranchName(e.target.value)}
                style={{ width: '100%' }}
              />
            )}
          </Space>
        </Form.Item>

        <Divider style={{ margin: '8px 0 16px' }} />

        {/* Filtro por tag */}
        <Form.Item label="Filtrar casos de teste por tag">
          <Space direction="vertical" style={{ width: '100%' }}>
            <Select
              mode="multiple"
              allowClear
              placeholder="Selecione tags para filtrar (opcional)"
              style={{ width: '100%' }}
              value={selectedTagIds}
              onChange={handleTagFilterChange}
              options={availableTags.map((t) => ({
                value: t.id,
                label: (
                  <Tag color={t.color} style={{ margin: 0 }}>
                    {t.name}
                  </Tag>
                ),
              }))}
              dropdownRender={(menu) => (
                <>
                  {menu}
                  <Divider style={{ margin: '8px 0' }} />
                  <Space style={{ padding: '0 8px 8px' }}>
                    <Input
                      placeholder="Nova tag..."
                      value={newTagName}
                      onChange={(e) => setNewTagName(e.target.value)}
                      onPressEnter={handleInlineCreateTag}
                      size="small"
                      style={{ width: 160 }}
                    />
                    <Button
                      size="small"
                      type="text"
                      icon={<PlusOutlined />}
                      loading={creatingTag}
                      onClick={handleInlineCreateTag}
                    >
                      Criar tag
                    </Button>
                  </Space>
                </>
              )}
            />
            {filteredByTagCaseIds !== null && (
              <Text type="secondary" style={{ fontSize: 12 }}>
                {filteredByTagCaseIds.size} casos de teste encontrados com as tags selecionadas.
              </Text>
            )}
          </Space>
        </Form.Item>

        {/* Seleção de casos de teste */}
        <Form.Item label={
          <Space>
            <span>Casos de Teste</span>
            <Badge count={selectedTestIds.size} showZero color="#1677ff" />
          </Space>
        }>
          {loadingData ? (
            <Text type="secondary">Carregando casos de teste...</Text>
          ) : collapseItems.length === 0 ? (
            <Text type="secondary">
              {filteredByTagCaseIds !== null
                ? 'Nenhum caso de teste encontrado com as tags selecionadas.'
                : 'Nenhum caso de teste cadastrado.'}
            </Text>
          ) : (
            <Collapse
              size="small"
              items={collapseItems}
              style={{ maxHeight: 320, overflowY: 'auto' }}
            />
          )}
        </Form.Item>
      </Form>
    </Modal>
  );
}
