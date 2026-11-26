import { createClient } from '@/lib/supabase/client';
import type { UserProfile, UserRole } from '@/types/database';

export async function getUsers(): Promise<UserProfile[]> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from('users')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching users:', error);
    throw error;
  }

  return data || [];
}

export async function updateUserRole(userId: string, role: UserRole): Promise<void> {
  const supabase = createClient();

  const { error } = await supabase
    .from('users')
    .update({ role })
    .eq('id', userId);

  if (error) {
    console.error('Error updating user role:', error);
    throw error;
  }
}

export async function deleteUser(userId: string): Promise<void> {
  const supabase = createClient();

  const { error } = await supabase
    .from('users')
    .delete()
    .eq('id', userId);

  if (error) {
    console.error('Error deleting user:', error);
    throw error;
  }
}
