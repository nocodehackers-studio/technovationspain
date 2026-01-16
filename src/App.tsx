import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { VerificationPendingModal } from "@/components/auth/VerificationPendingModal";

// Pages
import Index from "./pages/Index";
import AuthCallback from "./pages/AuthCallback";
import Onboarding from "./pages/Onboarding";
import NotFound from "./pages/NotFound";

// Admin Pages
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminUsers from "./pages/admin/AdminUsers";
import AdminTeams from "./pages/admin/AdminTeams";
import AdminHubs from "./pages/admin/AdminHubs";
import AdminEvents from "./pages/admin/AdminEvents";
import AdminWorkshops from "./pages/admin/AdminWorkshops";
import AdminImportCSV from "./pages/admin/AdminImportCSV";
import AdminReports from "./pages/admin/AdminReports";
import AdminSettings from "./pages/admin/AdminSettings";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          {/* Global verification modal - blocks navigation for unverified users */}
          <VerificationPendingModal />
          
          <Routes>
            {/* Public routes */}
            <Route path="/auth/callback" element={<AuthCallback />} />
            
            {/* Protected routes */}
            <Route path="/onboarding" element={
              <ProtectedRoute>
                <Onboarding />
              </ProtectedRoute>
            } />
            
            {/* Admin routes */}
            <Route path="/admin" element={
              <ProtectedRoute requiredRoles={["admin"]}>
                <AdminDashboard />
              </ProtectedRoute>
            } />
            <Route path="/admin/users" element={
              <ProtectedRoute requiredRoles={["admin"]}>
                <AdminUsers />
              </ProtectedRoute>
            } />
            <Route path="/admin/teams" element={
              <ProtectedRoute requiredRoles={["admin"]}>
                <AdminTeams />
              </ProtectedRoute>
            } />
            <Route path="/admin/hubs" element={
              <ProtectedRoute requiredRoles={["admin"]}>
                <AdminHubs />
              </ProtectedRoute>
            } />
            <Route path="/admin/events" element={
              <ProtectedRoute requiredRoles={["admin"]}>
                <AdminEvents />
              </ProtectedRoute>
            } />
            <Route path="/admin/workshops" element={
              <ProtectedRoute requiredRoles={["admin"]}>
                <AdminWorkshops />
              </ProtectedRoute>
            } />
            <Route path="/admin/import-csv" element={
              <ProtectedRoute requiredRoles={["admin"]}>
                <AdminImportCSV />
              </ProtectedRoute>
            } />
            <Route path="/admin/reports" element={
              <ProtectedRoute requiredRoles={["admin"]}>
                <AdminReports />
              </ProtectedRoute>
            } />
            <Route path="/admin/settings" element={
              <ProtectedRoute requiredRoles={["admin"]}>
                <AdminSettings />
              </ProtectedRoute>
            } />
            
            {/* Main app */}
            <Route path="/" element={<Index />} />
            
            {/* Catch-all */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;