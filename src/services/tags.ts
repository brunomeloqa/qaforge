import { createClient } from '@/lib/supabase/client';
import type { Tag } from '@/types/database';

export async function getTags(): Promise<Tag[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('tags')
    .select('*')
    .order('name', { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function createTag(tag: { name: string; color: string }): Promise<Tag> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('tags')
    .insert([{ name: tag.name.trim(), color: tag.color }])
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateTag(id: string, tag: { name: string; color: string }): Promise<Tag> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('tags')
    .update({ name: tag.name.trim(), color: tag.color })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteTag(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from('tags').delete().eq('id', id);
  if (error) throw error;
}

export async function getTagsByTestCase(testCaseId: string): Promise<Tag[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('test_case_tags')
    .select('tags(*)')
    .eq('test_case_id', testCaseId);
  if (error) throw error;
  return (data || []).map((row: any) => row.tags).filter(Boolean);
}

export async function setTagsForTestCase(testCaseId: string, tagIds: string[]): Promise<void> {
  const supabase = createClient();
  // Remove existing
  await supabase.from('test_case_tags').delete().eq('test_case_id', testCaseId);
  if (tagIds.length === 0) return;
  // Insert new
  const rows = tagIds.map((tag_id) => ({ test_case_id: testCaseId, tag_id }));
  const { error } = await supabase.from('test_case_tags').insert(rows);
  if (error) throw error;
}

export async function getTestCaseIdsByTag(tagIds: string[]): Promise<string[]> {
  if (tagIds.length === 0) return [];
  const supabase = createClient();
  const { data, error } = await supabase
    .from('test_case_tags')
    .select('test_case_id')
    .in('tag_id', tagIds);
  if (error) throw error;
  return Array.from(new Set((data || []).map((r: any) => r.test_case_id)));
}
