import {
  LayoutDashboard,
  Users,
  UsersRound,
  Building2,
  Calendar,
  GraduationCap,
  Upload,
  BarChart3,
  Settings,
  LogOut,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { NavLink } from "@/components/NavLink";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";

// White logos from Supabase Storage for dark sidebar
const LOGO_TECHNOVATION_WHITE = "https://orvkqnbshkxzyhqpjsdw.supabase.co/storage/v1/object/public/Assets/TechnovationGirls-White-Madrid%20(1).png";
const LOGO_POWER_TO_CODE_WHITE = "https://orvkqnbshkxzyhqpjsdw.supabase.co/storage/v1/object/public/Assets/Logo%20transparente%20PowerToCode_white.svg";

const menuItems = [
  { title: "Dashboard", url: "/admin", icon: LayoutDashboard },
  { title: "Usuarios", url: "/admin/users", icon: Users },
  { title: "Equipos", url: "/admin/teams", icon: UsersRound },
  { title: "Hubs", url: "/admin/hubs", icon: Building2 },
  { title: "Eventos", url: "/admin/events", icon: Calendar },
  { title: "Talleres", url: "/admin/workshops", icon: GraduationCap },
  { title: "Importar CSV", url: "/admin/import-csv", icon: Upload },
  { title: "Reportes", url: "/admin/reports", icon: BarChart3 },
];

const settingsItems = [
  { title: "Configuración", url: "/admin/settings", icon: Settings },
];

export function AdminSidebar() {
  const { signOut, profile } = useAuth();

  return (
    <Sidebar className="border-r border-sidebar-border">
      <SidebarHeader className="border-b border-sidebar-border p-4">
        <div className="flex flex-col gap-3">
          {/* Technovation Logo - White version with background fix */}
          <div className="flex items-center justify-center">
            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-2">
              <img 
                src={LOGO_TECHNOVATION_WHITE} 
                alt="Technovation Girls Madrid" 
                className="h-10 w-auto mix-blend-lighten"
              />
            </div>
          </div>
          {/* Power to Code Logo - White version */}
          <div className="flex items-center justify-center">
            <img 
              src={LOGO_POWER_TO_CODE_WHITE} 
              alt="Power to Code" 
              className="h-8 w-auto"
            />
          </div>
          <div className="text-center">
            <span className="text-xs text-sidebar-foreground/60">
              Panel de Administración
            </span>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent className="scrollbar-thin">
        <SidebarGroup>
          <SidebarGroupLabel className="text-sidebar-foreground/60">
            Gestión
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      end={item.url === "/admin"}
                      className="flex items-center gap-3 rounded-lg px-3 py-2 text-sidebar-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                      activeClassName="bg-sidebar-accent text-sidebar-primary font-medium"
                    >
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel className="text-sidebar-foreground/60">
            Sistema
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {settingsItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      className="flex items-center gap-3 rounded-lg px-3 py-2 text-sidebar-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                      activeClassName="bg-sidebar-accent text-sidebar-primary font-medium"
                    >
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border p-4">
        <div className="flex items-center gap-3 mb-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-sidebar-accent text-sidebar-primary text-sm font-medium">
            {profile?.first_name?.charAt(0) || "A"}
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-medium text-sidebar-foreground">
              {profile?.first_name} {profile?.last_name}
            </span>
            <span className="text-xs text-sidebar-foreground/60">
              Administrador
            </span>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={signOut}
          className="w-full justify-start text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent"
        >
          <LogOut className="mr-2 h-4 w-4" />
          Cerrar sesión
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
