export interface User {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'teacher' | 'parent' | 'student' | 'volunteer' | 'staff' | 'superadmin';
  subject: string | null;
  is_active: boolean;
  is_moderator?: boolean;
  created_at: string;
  updated_at?: string;
}

export interface LoginResponse {
  message: string;
  token: string;
  user: User;
}

export interface TeacherListResponse {
  teachers: User[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
