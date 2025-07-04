import { Routes, Route, Navigate } from "react-router-dom";
//import { DashboardLayout } from "./layouts/dashboard-layout";
import LoginPage from "./pages/login-page";
import DashboardLayout from "./layouts/dashboard-layout";
import Dashboard from "./pages/dashboard-page";
import Tasks from "./pages/tasks-page";
import Users from "./pages/users-page";

// Placeholder components for routes
// const Dashboard = () => <h1 className="text-3xl font-bold">Dashboard</h1>;
// const Tasks = () => <h1 className="text-3xl font-bold">Task Management</h1>;
// const Users = () => <h1 className="text-3xl font-bold">User Management</h1>;

function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/" element={<DashboardLayout />}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="tasks" element={<Tasks />} />
        <Route path="users" element={<Users />} />
      </Route>
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}

export default App;
