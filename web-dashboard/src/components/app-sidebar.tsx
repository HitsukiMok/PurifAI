import { Link, useRouterState } from "@tanstack/react-router";
import { Shield, LayoutDashboard, Bot, AlertTriangle, ScrollText, FileLock2, Settings } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { useTheme } from "@/hooks/use-theme";

const items = [
  { title: "Command Center", url: "/", icon: LayoutDashboard },
  { title: "AI Agents", url: "/agents", icon: Bot },
  { title: "Threats", url: "/threats", icon: AlertTriangle },
  { title: "Logs", url: "/logs", icon: ScrollText },
  { title: "Policies", url: "/policies", icon: FileLock2 },
  { title: "Settings", url: "/settings", icon: Settings },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const { theme } = useTheme(); // Access current theme status
  const collapsed = state === "collapsed";
  const currentPath = useRouterState({ select: (r) => r.location.pathname });

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <div className="flex items-center gap-2 px-2 py-3">
          {/* Logo container */}
          <div className="relative flex h-8 w-8 items-center justify-center rounded-md">
            {/* Swaps icon based on theme. Files must be in /public folder. */}
            <img 
              src={theme === 'dark' ? '/logo-dark.png' : '/logo-light.png'} 
              alt="Logo" 
              className={`h-9 w-9 object-contain ${theme === 'dark' ? 'drop-shadow-[0_0_12px_var(--color-ai)]' : ''}`}
            />
          </div>
          
          {!collapsed && (
            <div className="flex flex-col leading-tight">
              {/* Changed name to PurifAI */}
              <span className="text-sm font-semibold tracking-tight font-sans">PurifAI</span>
              <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                Platform
              </span>
            </div>
          )}
        </div>
      </SidebarHeader>
      
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Operations</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => {
                const active = currentPath === item.url;
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild isActive={active}>
                      <Link to={item.url} className="flex items-center gap-2">
                        <item.icon className="h-4 w-4" />
                        {!collapsed && <span>{item.title}</span>}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
