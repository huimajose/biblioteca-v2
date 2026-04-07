import { Routes, Route, Navigate } from 'react-router-dom';
import { SignIn, SignUp, SignedIn, SignedOut } from '@clerk/clerk-react';
import { useAuth } from './hooks/useAuth.ts';
import { Layout } from './components/Layout.tsx';
import AdminDashboard  from './app/admin/AdminDashboard.tsx';
import { BookForm } from './app/admin/BookForm.tsx';
import { ReportsPage } from './app/admin/ReportsPage.tsx';
import { UserPortal } from './app/user/UserPortal.tsx';
import { AdminBooksPage } from './app/admin/AdminBooksPage.tsx';
import { UsersPage } from './app/admin/UsersPage.tsx';
import { TransactionsPage } from './app/admin/TransactionsPage.tsx';
import { StudentVerificationsPage } from './app/admin/StudentVerificationsPage.tsx';
import CoursesPage from './app/admin/CoursesPage.tsx';
import CatalogReviewPage from './app/admin/CatalogReviewPage.tsx';
import AdminAuditPage from './app/admin/AdminAuditPage.tsx';
import { StudentVerificationForm } from './app/user/StudentVerificationForm.tsx';
import { UserShelfPage } from './app/user/UserShelfPage.tsx';
import { UserHistoryPage } from './app/user/UserHistoryPage.tsx';
import { UserDashboardPage } from './app/user/UserDashboardPage.tsx';
import { UserProfilePage } from './app/user/UserProfilePage.tsx';
import { PublicLayout } from './components/PublicLayout.tsx';
import { HomePage } from './app/public/HomePage.tsx';
import { ContactsPage } from './app/public/ContactsPage.tsx';
import { AuthShell } from './components/AuthShell.tsx';
import { PdfReaderPage } from './app/shared/PdfReaderPage.tsx';
import { canAccessAdminSection } from './utils/roles.ts';

export default function App() {
  const { auth, logout, isLoaded } = useAuth();

  if (!isLoaded) return null;

  const staffHome = auth?.role === 'operator' ? '/admin/transactions' : auth?.role === 'catalogador' ? '/admin/books' : '/admin';
  const staffRoute = (section: Parameters<typeof canAccessAdminSection>[1], element: JSX.Element) =>
    auth && canAccessAdminSection(auth.role, section) ? element : <Navigate to={staffHome} replace />;

  const clerkAppearance = {
    variables: {
      colorPrimary: '#65a30d',
      colorTextOnPrimaryBackground: '#ffffff',
      colorBackground: '#ffffff',
    },
    elements: {
      card: 'shadow-none border-0',
      headerTitle: 'text-gray-900',
      headerSubtitle: 'text-gray-500',
      formButtonPrimary: 'bg-lime-600 hover:bg-lime-700',
      socialButtonsBlockButton: 'border border-lime-100 hover:border-lime-200',
      formFieldInput: 'focus:ring-lime-500 focus:border-lime-500',
    },
  };

  return (
    <>
      <SignedOut>
        <Routes>
          <Route
            path="/sign-in/*"
            element={
              <AuthShell
                title="Entrar na Biblioteca Virtual"
                subtitle="Aceda com o seu perfil de estudante, membro externo ou administrador."
              >
                <SignIn routing="path" path="/sign-in" appearance={clerkAppearance} />
              </AuthShell>
            }
          />
          <Route
            path="/sign-up/*"
            element={
              <AuthShell
                title="Pedir acesso a biblioteca"
                subtitle="Registe-se para requisitar livros fisicos e digitais."
              >
                <SignUp routing="path" path="/sign-up" appearance={clerkAppearance} />
              </AuthShell>
            }
          />
          <Route
            path="/"
            element={
              <PublicLayout hero>
                <HomePage />
              </PublicLayout>
            }
          />
          <Route
            path="/contactos"
            element={
              <PublicLayout>
                <ContactsPage />
              </PublicLayout>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </SignedOut>

      <SignedIn>
        {auth && (
          <Layout user={auth} onLogout={logout}>
            <Routes>
              {auth.isStaff ? (
                <>
                  <Route path="/admin" element={staffRoute('dashboard', <AdminDashboard />)} />
                  <Route path="/admin/books" element={staffRoute('books', <AdminBooksPage />)} />
                  <Route path="/admin/catalog-review" element={staffRoute('catalog-review', <CatalogReviewPage />)} />
                  <Route path="/admin/courses" element={staffRoute('courses', <CoursesPage />)} />
                  <Route path="/admin/books/new" element={staffRoute('books', <BookForm />)} />
                  <Route path="/admin/books/edit" element={staffRoute('books', <BookForm />)} />
                  <Route path="/admin/users" element={staffRoute('users', <UsersPage />)} />
                  <Route path="/admin/student-verifications" element={staffRoute('student-verifications', <StudentVerificationsPage />)} />
                  <Route path="/admin/transactions" element={staffRoute('transactions', <TransactionsPage />)} />
                  <Route path="/admin/reports" element={staffRoute('reports', <ReportsPage />)} />
                  <Route path="/admin/audit" element={staffRoute('audit', <AdminAuditPage />)} />
                  <Route path="/admin/as-user" element={staffRoute('reader-mode', <UserPortal user={auth} />)} />
                  <Route path="/profile/*" element={<UserProfilePage user={auth} />} />
                  <Route path="/reader/:bookId" element={<PdfReaderPage user={auth} />} />
                  <Route path="*" element={<Navigate to={staffHome} />} />
                </>
              ) : (
                <>
                  <Route path="/" element={<UserPortal user={auth} />} />
                  <Route path="/dashboard" element={<UserDashboardPage user={auth} />} />
                  <Route path="/shelf" element={<UserShelfPage user={auth} />} />
                  <Route path="/history" element={<UserHistoryPage user={auth} />} />
                  <Route path="/student-verification" element={<StudentVerificationForm user={auth} />} />
                  <Route path="/profile/*" element={<UserProfilePage user={auth} />} />
                  <Route path="/reader/:bookId" element={<PdfReaderPage user={auth} />} />
                  <Route path="*" element={<Navigate to="/" />} />
                </>
              )}
            </Routes>
          </Layout>
        )}
      </SignedIn>
    </>
  );
}
