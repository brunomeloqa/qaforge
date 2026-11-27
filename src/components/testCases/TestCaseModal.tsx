'use client';

import React, { useEffect, useState } from 'react';
import { Modal, Form, Input, Select, Space, Tag, Button, Divider } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import type { TestCase, TestPriority, Tag as TagType } from '@/types/database';
import { getTags, createTag, getTagsByTestCase, setTagsForTestCase } from '@/services/tags';

interface TestCaseModalProps {
  open: boolean;
  testCase?: TestCase | null;
  onCancel: () => void;
  onSubmit: (values: { title: string; priority: TestPriority; tagIds: string[] }) => Promise<void>;
  loading?: boolean;
}

export default function TestCaseModal({
  open,
  testCase,
  onCancel,
  onSubmit,
  loading = false,
}: TestCaseModalProps) {
  const [form] = Form.useForm();
  const isEditing = !!testCase;

  const [availableTags, setAvailableTags] = useState<TagType[]>([]);
  const [newTagName, setNewTagName] = useState('');
  const [creatingTag, setCreatingTag] = useState(false);

  useEffect(() => {
    getTags().then(setAvailableTags).catch(() => {});
  }, []);

  useEffect(() => {
    if (open) {
      if (testCase) {
        form.setFieldsValue({ title: testCase.title, priority: testCase.priority, tagIds: [] });
        // Load existing tags for this test case
        getTagsByTestCase(testCase.id)
          .then((tags) => form.setFieldValue('tagIds', tags.map((t) => t.id)))
          .catch(() => {});
      } else {
        form.resetFields();
      }
    }
  }, [open, testCase, form]);

  const handleInlineCreateTag = async () => {
    const name = newTagName.trim();
    if (!name) return;
    setCreatingTag(true);
    try {
      const created = await createTag({ name, color: '#1677ff' });
      setAvailableTags((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)));
      const current: string[] = form.getFieldValue('tagIds') || [];
      form.setFieldValue('tagIds', [...current, created.id]);
      setNewTagName('');
    } catch {
      // silently fail
    } finally {
      setCreatingTag(false);
    }
  };

  const handleOk = async () => {
    try {
      const values = await form.validateFields();
      await onSubmit({
        title: values.title,
        priority: values.priority,
        tagIds: values.tagIds || [],
      });
      form.resetFields();
    } catch {
      // form validation failed
    }
  };

  return (
    <Modal
      title={isEditing ? 'Editar Caso de Teste' : 'Novo Caso de Teste'}
      open={open}
      onOk={handleOk}
      onCancel={onCancel}
      confirmLoading={loading}
      okText={isEditing ? 'Salvar Alterações' : 'Criar Caso'}
      cancelText="Cancelar"
      destroyOnClose
    >
      <Form
        form={form}
        layout="vertical"
        requiredMark={false}
        initialValues={{ priority: 'medium', tagIds: [] }}
        style={{ marginTop: 16 }}
      >
        <Form.Item
          name="title"
          label="Título do Caso de Teste"
          rules={[
            { required: true, message: 'Por favor, informe o título do teste' },
            { min: 3, message: 'O título deve ter no mínimo 3 caracteres' },
          ]}
        >
          <Input placeholder="Ex: Validar se o QR Code Pix expira após 15 minutos" />
        </Form.Item>

        <Form.Item
          name="priority"
          label="Prioridade"
          rules={[{ required: true, message: 'Selecione a prioridade' }]}
        >
          <Select
            options={[
              { value: 'low', label: 'Baixa' },
              { value: 'medium', label: 'Média' },
              { value: 'high', label: 'Alta' },
              { value: 'critical', label: 'Crítica' },
            ]}
          />
        </Form.Item>

        <Form.Item name="tagIds" label="Tags">
          <Select
            mode="multiple"
            allowClear
            placeholder="Selecione ou crie tags..."
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
                    style={{ width: 150 }}
                  />
                  <Button
                    size="small"
                    type="text"
                    icon={<PlusOutlined />}
                    loading={creatingTag}
                    onClick={handleInlineCreateTag}
                  >
                    Criar
                  </Button>
                </Space>
              </>
            )}
          />
        </Form.Item>
      </Form>
    </Modal>
  );
}
