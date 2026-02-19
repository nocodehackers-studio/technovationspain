import React, { ReactNode } from "react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AdminSidebar } from "./AdminSidebar";
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb";
import { useLocation } from "react-router-dom";

interface AdminLayoutProps {
  children: ReactNode;
  title?: string;
}

const routeLabels: Record<string, string> = {
  "/admin": "Dashboard",
  "/admin/users": "Usuarios",
  "/admin/teams": "Equipos",
  "/admin/hubs": "Hubs",
  "/admin/events": "Eventos",
  "/admin/workshops": "Talleres",
  "/admin/reports": "Reportes",
  "/admin/settings": "Configuración",
};

export function AdminLayout({ children, title }: AdminLayoutProps) {
  const location = useLocation();
  const pathSegments = location.pathname.split("/").filter(Boolean);
  
  const breadcrumbs = pathSegments.map((segment, index) => {
    const path = "/" + pathSegments.slice(0, index + 1).join("/");
    const label = routeLabels[path] || segment.charAt(0).toUpperCase() + segment.slice(1);
    return { path, label };
  });

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background">
        <AdminSidebar />
        
        <div className="flex flex-1 flex-col min-w-0">
          {/* Header */}
          <header className="sticky top-0 z-40 flex h-14 items-center gap-2 sm:gap-4 border-b bg-background px-3 sm:px-4 lg:px-6">
            <SidebarTrigger className="lg:hidden" />
            
            {/* Mobile title */}
            <h1 className="text-lg font-semibold truncate md:hidden">
              {title || breadcrumbs[breadcrumbs.length - 1]?.label}
            </h1>
            
            <Breadcrumb className="hidden md:flex">
              <BreadcrumbList>
                {breadcrumbs.map((crumb, index) => (
                  <React.Fragment key={crumb.path}>
                    <BreadcrumbItem>
                      {index < breadcrumbs.length - 1 ? (
                        <BreadcrumbLink href={crumb.path}>{crumb.label}</BreadcrumbLink>
                      ) : (
                        <BreadcrumbPage>{title || crumb.label}</BreadcrumbPage>
                      )}
                    </BreadcrumbItem>
                    {index < breadcrumbs.length - 1 && <BreadcrumbSeparator />}
                  </React.Fragment>
                ))}
              </BreadcrumbList>
            </Breadcrumb>

            <div className="ml-auto flex items-center gap-2">
              {/* Future: notifications, user menu */}
            </div>
          </header>

          {/* Main content */}
          <main className="flex-1 overflow-auto p-4 lg:p-6">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
