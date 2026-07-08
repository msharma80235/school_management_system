import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';
import Login from './pages/Login';
import AdminDashboard from './pages/AdminDashboard';
import TeacherManagement from './pages/TeacherManagement';
import ClassManagement from './pages/ClassManagement';
import StudentManagement from './pages/StudentManagement';
import GradeManagement from './pages/GradeManagement';
import ParentManagement from './pages/ParentManagement';
import AttendancePage from './pages/AttendancePage';
import TeacherDashboard from './pages/TeacherDashboard';
import ParentDashboard from './pages/ParentDashboard';
import StudentDashboard from './pages/StudentDashboard';
import Register from './pages/Register';
import ParentLogin from './pages/ParentLogin';
import SubjectManagement from './pages/SubjectManagement';
import ExamMarks from './pages/ExamMarks';
import ReportCard from './pages/ReportCard';
import Approvals from './pages/Approvals';
import HomeworkManagement from './pages/HomeworkManagement';
import BookManagement from './pages/BookManagement';
import VolunteerManagement from './pages/VolunteerManagement';
import VolunteerDashboard from './pages/VolunteerDashboard';
import DocumentManagement from './pages/DocumentManagement';
import StaffManagement from './pages/StaffManagement';
import StaffDashboard from './pages/StaffDashboard';
import CalendarPage from './pages/CalendarPage';
import RolesDutiesEditor from './pages/RolesDutiesEditor';
import SchoolDocuments from './pages/SchoolDocuments';
import SuperLogin from './pages/SuperLogin';
import InviteManagement from './pages/InviteManagement';
import UserManagement from './pages/UserManagement';
import ModerationQueue from './pages/ModerationQueue';
import ParentDetail from './pages/ParentDetail';
import ClassScheduleManagement from './pages/ClassScheduleManagement';
import TeacherScheduleManagement from './pages/TeacherScheduleManagement';
import ContentSafety from './pages/ContentSafety';
import AuditLog from './pages/AuditLog';
import JoinPage from './pages/JoinPage';
import SuperDashboard from './pages/SuperDashboard';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/parent-login" element={<ParentLogin />} />
          <Route path="/register" element={<Register />} />
          <Route path="/super-login" element={<SuperLogin />} />
          <Route path="/join" element={<JoinPage />} />
          <Route path="/join/:code" element={<JoinPage />} />

          {/* Admin Routes */}
          <Route path="/admin" element={
            <ProtectedRoute role="admin"><Layout /></ProtectedRoute>
          }>
            <Route path="dashboard" element={<AdminDashboard />} />
            <Route path="teachers" element={<TeacherManagement />} />
            <Route path="classes" element={<ClassManagement />} />
            <Route path="classes/:classId/students" element={<StudentManagement />} />
            <Route path="schedules" element={<ClassScheduleManagement />} />
            <Route path="teacher-schedules" element={<TeacherScheduleManagement />} />
            <Route path="students" element={<StudentManagement />} />
            <Route path="grades" element={<GradeManagement />} />
            <Route path="parents" element={<ParentManagement />} />
            <Route path="parents/:parentId" element={<ParentDetail />} />
            <Route path="attendance" element={<AttendancePage />} />
            <Route path="subjects" element={<SubjectManagement />} />
            <Route path="exams" element={<ExamMarks />} />
            <Route path="report-cards" element={<ReportCard />} />
            <Route path="approvals" element={<Approvals />} />
            <Route path="homework" element={<HomeworkManagement />} />
            <Route path="books" element={<BookManagement />} />
            <Route path="volunteers" element={<VolunteerManagement />} />
            <Route path="documents" element={<DocumentManagement />} />
            <Route path="staff" element={<StaffManagement />} />
            <Route path="roles-duties" element={<RolesDutiesEditor />} />
            <Route path="invites" element={<InviteManagement />} />
            <Route path="users" element={<UserManagement />} />
            <Route path="moderation" element={<ModerationQueue />} />
            <Route path="content-safety" element={<ContentSafety />} />
            <Route path="audit-log" element={<AuditLog />} />
            <Route path="calendar" element={<CalendarPage />} />
            <Route index element={<Navigate to="dashboard" replace />} />
          </Route>

          {/* Teacher Routes */}
          <Route path="/teacher" element={
            <ProtectedRoute role="teacher"><Layout /></ProtectedRoute>
          }>
            <Route path="dashboard" element={<TeacherDashboard />} />
            <Route path="my-schedule" element={<TeacherScheduleManagement />} />
            <Route path="attendance" element={<AttendancePage />} />
            <Route path="exams" element={<ExamMarks />} />
            <Route path="report-cards" element={<ReportCard />} />
            <Route path="homework" element={<HomeworkManagement />} />
            <Route path="books" element={<BookManagement />} />
            <Route path="documents" element={<SchoolDocuments />} />
            <Route path="moderation" element={<ModerationQueue />} />
            <Route path="calendar" element={<CalendarPage />} />
            <Route index element={<Navigate to="dashboard" replace />} />
          </Route>

          {/* Parent Routes */}
          <Route path="/parent" element={
            <ProtectedRoute role="parent"><Layout /></ProtectedRoute>
          }>
            <Route path="dashboard" element={<ParentDashboard />} />
            <Route path="calendar" element={<CalendarPage />} />
            <Route index element={<Navigate to="dashboard" replace />} />
          </Route>

          {/* Student Routes */}
          <Route path="/student" element={
            <ProtectedRoute role="student"><Layout /></ProtectedRoute>
          }>
            <Route path="dashboard" element={<StudentDashboard />} />
            <Route path="documents" element={<SchoolDocuments />} />
            <Route path="calendar" element={<CalendarPage />} />
            <Route index element={<Navigate to="dashboard" replace />} />
          </Route>

          {/* Volunteer Routes */}
          <Route path="/volunteer" element={
            <ProtectedRoute role="volunteer"><Layout /></ProtectedRoute>
          }>
            <Route path="dashboard" element={<VolunteerDashboard />} />
            <Route path="attendance" element={<AttendancePage />} />
            <Route path="homework" element={<HomeworkManagement />} />
            <Route path="report-cards" element={<ReportCard />} />
            <Route path="documents" element={<SchoolDocuments />} />
            <Route path="moderation" element={<ModerationQueue />} />
            <Route path="calendar" element={<CalendarPage />} />
            <Route index element={<Navigate to="dashboard" replace />} />
          </Route>

          {/* Staff Routes */}
          <Route path="/staff" element={
            <ProtectedRoute role="staff"><Layout /></ProtectedRoute>
          }>
            <Route path="dashboard" element={<StaffDashboard />} />
            <Route path="calendar" element={<CalendarPage />} />
            <Route path="documents" element={<SchoolDocuments />} />
            <Route path="moderation" element={<ModerationQueue />} />
            <Route index element={<Navigate to="dashboard" replace />} />
          </Route>

          {/* Super Admin Routes */}
          <Route path="/superadmin" element={
            <ProtectedRoute role="superadmin"><Layout /></ProtectedRoute>
          }>
            <Route path="dashboard" element={<SuperDashboard />} />
            <Route index element={<Navigate to="dashboard" replace />} />
          </Route>

          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
