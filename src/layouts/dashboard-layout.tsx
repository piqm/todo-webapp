// import { SimpleSidebar } from "@/components/simple-sidebar";
// import { Outlet } from "react-router-dom";

// export function DashboardLayout() {
//   return (
//     <div className="flex">
//       <SimpleSidebar />
//       <main className="flex-1 p-8 bg-gray-50">
//         {/* The content for each route (e.g., Tasks, Users) will be rendered here */}
//         <Outlet />
//       </main>
//     </div>
//   );
// }

import { AppSidebar } from "@/components/app-sidebar";
import { SiteHeader } from "@/components/site-header";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { Outlet } from "react-router-dom";

export default function DashboardLayout() {
  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": "calc(var(--spacing) * 72)",
          "--header-height": "calc(var(--spacing) * 12)",
        } as React.CSSProperties
      }
    >
      <AppSidebar variant="inset" />
      <SidebarInset>
        <SiteHeader />
        <Outlet />
      </SidebarInset>
    </SidebarProvider>
  );
}
