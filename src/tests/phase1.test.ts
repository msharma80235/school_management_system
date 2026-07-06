import request from 'supertest';
import app from '../app';
import prisma from '../prisma/client';
import { hashPassword } from '../utils/password';
import { generateToken, verifyToken } from '../utils/jwt';
import { createTestAdmin, createTestTeacher, cleanDatabase } from './helpers';

beforeEach(async () => {
  await cleanDatabase();
});

afterAll(async () => {
  await cleanDatabase();
  await prisma.$disconnect();
});

// Test 1: Admin seed creates account
describe('Admin Seed', () => {
  it('should create admin account via seed script logic', async () => {
    const hashed = await hashPassword('Admin@123');
    const admin = await prisma.user.create({
      data: {
        name: 'Admin',
        email: 'admin@educationhub.com',
        password: hashed,
        role: 'admin',
      },
    });

    expect(admin.email).toBe('admin@educationhub.com');
    expect(admin.role).toBe('admin');
    expect(admin.is_active).toBe(true);
  });
});

// Test 2: Login with valid credentials returns JWT
describe('Auth - Login', () => {
  it('should return JWT token for valid credentials', async () => {
    const { admin } = await createTestAdmin();

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@test.com', password: 'Admin@123' });

    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
    expect(res.body.user.email).toBe('admin@test.com');
    expect(res.body.user.role).toBe('admin');
    // Password should not be returned
    expect(res.body.user.password).toBeUndefined();
  });

  // Test 3: Login with invalid credentials returns 401
  it('should return 401 for invalid credentials', async () => {
    await createTestAdmin();

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@test.com', password: 'wrongpassword' });

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Invalid email or password');
  });
});

// Test 4: Accessing protected route without token returns 401
describe('Auth - Protected Routes', () => {
  it('should return 401 when accessing protected route without token', async () => {
    const res = await request(app).get('/api/auth/me');

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Authentication required');
  });

  // Test 5: Accessing admin route as teacher returns 403
  it('should return 403 when teacher accesses admin route', async () => {
    const { token } = await createTestTeacher();

    const res = await request(app)
      .get('/api/users/teachers')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('Insufficient permissions');
  });
});

// Test 6: Create teacher with valid data succeeds
describe('Teacher Management', () => {
  it('should create teacher with valid data', async () => {
    const { token } = await createTestAdmin();

    const res = await request(app)
      .post('/api/users/teachers')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Jane Smith',
        email: 'jane@school.com',
        password: 'Teacher@123',
        subject: 'Science',
      });

    expect(res.status).toBe(201);
    expect(res.body.teacher.name).toBe('Jane Smith');
    expect(res.body.teacher.email).toBe('jane@school.com');
    expect(res.body.teacher.role).toBe('teacher');
    expect(res.body.teacher.subject).toBe('Science');
    // Password should not be returned
    expect(res.body.teacher.password).toBeUndefined();
  });

  // Test 7: Create teacher with duplicate email fails
  it('should fail to create teacher with duplicate email', async () => {
    const { token } = await createTestAdmin();

    await request(app)
      .post('/api/users/teachers')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Teacher One',
        email: 'duplicate@school.com',
        password: 'Teacher@123',
      });

    const res = await request(app)
      .post('/api/users/teachers')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Teacher Two',
        email: 'duplicate@school.com',
        password: 'Teacher@456',
      });

    expect(res.status).toBe(409);
    expect(res.body.error).toBe('Email already exists');
  });

  // Test 8: List teachers returns paginated results
  it('should return paginated list of teachers', async () => {
    const { token } = await createTestAdmin();

    // Create 3 teachers
    for (let i = 1; i <= 3; i++) {
      await request(app)
        .post('/api/users/teachers')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: `Teacher ${i}`,
          email: `teacher${i}@school.com`,
          password: 'Teacher@123',
        });
    }

    const res = await request(app)
      .get('/api/users/teachers?page=1&limit=2')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.teachers).toHaveLength(2);
    expect(res.body.pagination.total).toBe(3);
    expect(res.body.pagination.totalPages).toBe(2);
  });
});

// Test 9: Deactivated teacher cannot login
describe('Teacher Status', () => {
  it('should prevent deactivated teacher from logging in', async () => {
    const { token: adminToken } = await createTestAdmin();

    // Create a teacher
    const createRes = await request(app)
      .post('/api/users/teachers')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Deactivated Teacher',
        email: 'deactivated@school.com',
        password: 'Teacher@123',
      });

    const teacherId = createRes.body.teacher.id;

    // Deactivate the teacher
    await request(app)
      .patch(`/api/users/teachers/${teacherId}/status`)
      .set('Authorization', `Bearer ${adminToken}`);

    // Try to login as deactivated teacher
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'deactivated@school.com', password: 'Teacher@123' });

    expect(loginRes.status).toBe(401);
    expect(loginRes.body.error).toBe('Account is deactivated');
  });
});

// Test 10: Password change updates hash correctly
describe('Password Management', () => {
  it('should change password successfully', async () => {
    const { token } = await createTestAdmin();

    const res = await request(app)
      .put('/api/auth/change-password')
      .set('Authorization', `Bearer ${token}`)
      .send({
        currentPassword: 'Admin@123',
        newPassword: 'NewAdmin@456',
      });

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Password changed successfully');

    // Verify new password works
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@test.com', password: 'NewAdmin@456' });

    expect(loginRes.status).toBe(200);
  });
});

// Test 11: JWT token verification
describe('JWT Utils', () => {
  it('should generate and verify token correctly', () => {
    const payload = { userId: 'test-id', email: 'test@test.com', role: 'admin' };
    const token = generateToken(payload);
    const decoded = verifyToken(token);

    expect(decoded.userId).toBe('test-id');
    expect(decoded.email).toBe('test@test.com');
    expect(decoded.role).toBe('admin');
  });

  it('should throw error for invalid token', () => {
    expect(() => verifyToken('invalid-token')).toThrow();
  });
});

// Test 12: Logout clears token
describe('Auth - Logout', () => {
  it('should clear token cookie on logout', async () => {
    const { token } = await createTestAdmin();

    const res = await request(app)
      .post('/api/auth/logout')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Logout successful');
    // Check that Set-Cookie header clears the token
    const cookies = res.headers['set-cookie'];
    if (cookies) {
      const tokenCookie = Array.isArray(cookies)
        ? cookies.find((c: string) => c.startsWith('token='))
        : cookies;
      if (tokenCookie) {
        expect(tokenCookie).toMatch(/token=;|token=\s*;|Expires=/i);
      }
    }
  });
});

// Test 13: Get current user profile
describe('Auth - Me', () => {
  it('should return current user profile', async () => {
    const { token, admin } = await createTestAdmin();

    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe(admin.email);
    expect(res.body.user.name).toBe(admin.name);
    expect(res.body.user.password).toBeUndefined();
  });
});

// Test 14: Update teacher details
describe('Teacher Update', () => {
  it('should update teacher name and subject', async () => {
    const { token: adminToken } = await createTestAdmin();

    const createRes = await request(app)
      .post('/api/users/teachers')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Original Name',
        email: 'update@school.com',
        password: 'Teacher@123',
        subject: 'Math',
      });

    const teacherId = createRes.body.teacher.id;

    const res = await request(app)
      .put(`/api/users/teachers/${teacherId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Updated Name', subject: 'Physics' });

    expect(res.status).toBe(200);
    expect(res.body.teacher.name).toBe('Updated Name');
    expect(res.body.teacher.subject).toBe('Physics');
  });
});

// Test 15: Get single teacher details
describe('Teacher Details', () => {
  it('should return single teacher details by ID', async () => {
    const { token: adminToken } = await createTestAdmin();

    const createRes = await request(app)
      .post('/api/users/teachers')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Detail Teacher',
        email: 'detail@school.com',
        password: 'Teacher@123',
        subject: 'English',
      });

    const teacherId = createRes.body.teacher.id;

    const res = await request(app)
      .get(`/api/users/teachers/${teacherId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.teacher.name).toBe('Detail Teacher');
    expect(res.body.teacher.subject).toBe('English');
    expect(res.body.teacher.id).toBe(teacherId);
  });
});
