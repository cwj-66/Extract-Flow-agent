import { createBrowserRouter, Navigate, RouterProvider } from 'react-router-dom';
import { AppLayout } from '../components/layout/AppLayout';
import { BatchDetailPage } from '../pages/BatchDetailPage';
import { FeishuGroupsPage } from '../pages/FeishuGroupsPage';
import { UploadPage } from '../pages/UploadPage';
import { TaskListPage } from '../pages/TaskListPage';
import { TaskDetailPage } from '../pages/TaskDetailPage';
import { SettingsPage } from '../pages/SettingsPage';

const router = createBrowserRouter([
  {
    path: '/',
    element: <AppLayout />,
    children: [
      { index: true, element: <Navigate to="/upload" replace /> },
      { path: 'config/groups', element: <FeishuGroupsPage /> },
      { path: 'upload', element: <UploadPage /> },
      { path: 'batches/:id', element: <BatchDetailPage /> },
      { path: 'tasks', element: <TaskListPage /> },
      { path: 'tasks/:id', element: <TaskDetailPage /> },
      { path: 'settings', element: <SettingsPage /> },
    ],
  },
]);

export function AppRouter() {
  return <RouterProvider router={router} />;
}
