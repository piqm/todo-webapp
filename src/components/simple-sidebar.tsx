import { NavLink } from "react-router-dom";
import { Home, Users, CheckSquare } from "lucide-react";

// Helper for NavLink styling
const getNavLinkClass = ({ isActive }: { isActive: boolean }): string =>
  `flex items-center p-2 text-base font-normal rounded-lg transition-colors ${
    isActive
      ? "bg-gray-700 text-white"
      : "text-gray-400 hover:bg-gray-700 hover:text-white"
  }`;

export function SimpleSidebar() {
  return (
    <div className="flex flex-col w-64 h-screen px-4 py-8 bg-gray-800">
      <h2 className="text-3xl font-semibold text-white mb-8">DVP Tasks</h2>
      <div className="flex flex-col justify-between flex-1">
        <nav className="space-y-2">
          {/* These links would be shown based on user role */}
          <NavLink to="/dashboard" className={getNavLinkClass}>
            <Home className="w-6 h-6" />
            <span className="ml-3">Dashboard</span>
          </NavLink>

          <NavLink to="/tasks" className={getNavLinkClass}>
            <CheckSquare className="w-6 h-6" />
            <span className="ml-3">Tasks</span>
          </NavLink>

          {/* Example of a link only for Administrators */}
          <NavLink to="/users" className={getNavLinkClass}>
            <Users className="w-6 h-6" />
            <span className="ml-3">Users</span>
          </NavLink>
        </nav>
      </div>
    </div>
  );
}
