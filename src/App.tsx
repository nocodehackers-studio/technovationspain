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
import PendingVerification from "./pages/PendingVerification";
import NotFound from "./pages/NotFound";
import ParticipantDashboard from "./pages/ParticipantDashboard";

// Registration Pages
import RegisterSelect from "./pages/register/RegisterSelect";
import RegisterStudent from "./pages/register/RegisterStudent";
import RegisterMentor from "./pages/register/RegisterMentor";
import RegisterJudge from "./pages/register/RegisterJudge";
import RegisterVolunteer from "./pages/register/RegisterVolunteer";

// Volunteer Pages
import VolunteerDashboard from "./pages/volunteer/VolunteerDashboard";

// Mentor Pages
import MentorDashboard from "./pages/mentor/MentorDashboard";

// Admin Pages
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminUsers from "./pages/admin/AdminUsers";
import AdminTeams from "./pages/admin/AdminTeams";
import AdminHubs from "./pages/admin/AdminHubs";
import AdminEvents from "./pages/admin/AdminEvents";
import AdminEventEditor from "./pages/admin/AdminEventEditor";
import AdminWorkshops from "./pages/admin/AdminWorkshops";
import AdminWorkshopCapacity from "./pages/admin/AdminWorkshopCapacity";
import AdminWorkshopPreferences from "./pages/admin/AdminWorkshopPreferences";
import AdminWorkshopAssignment from "./pages/admin/AdminWorkshopAssignment";
import AdminWorkshopSchedule from "./pages/admin/AdminWorkshopSchedule";
import AdminImportUnified from "./pages/admin/AdminImportUnified";
import AdminImportTeams from "./pages/admin/AdminImportTeams";
import AdminReports from "./pages/admin/AdminReports";
import AdminSettings from "./pages/admin/AdminSettings";
import AdminTickets from "./pages/admin/AdminTickets";

// Event Pages
import EventsListPage from "./pages/events/EventsListPage";
import EventDetailPage from "./pages/events/EventDetailPage";
import EventRegistrationPage from "./pages/events/EventRegistrationPage";
import RegistrationConfirmationPage from "./pages/events/RegistrationConfirmationPage";
import TicketDetailPage from "./pages/events/TicketDetailPage";
import WorkshopPreferencesPage from "./pages/events/WorkshopPreferencesPage";
import ValidatePage from "./pages/validate/ValidatePage";
import ConsentPage from "./pages/consent/ConsentPage";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      staleTime: 5 * 60 * 1000, // 5 minutes
    },
  },
});

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
            <Route path="/pending-verification" element={<PendingVerification />} />
            
            {/* Registration routes (public) */}
            <Route path="/register" element={<RegisterSelect />} />
            <Route path="/register/student" element={<RegisterStudent />} />
            <Route path="/register/mentor" element={<RegisterMentor />} />
            <Route path="/register/judge" element={<RegisterJudge />} />
            
            {/* Volunteer registration (public) */}
            <Route path="/voluntario" element={<RegisterVolunteer />} />
            
            {/* Volunteer dashboard (protected) */}
            <Route path="/voluntario/dashboard" element={
              <ProtectedRoute requiredRoles={["volunteer", "admin"]}>
                <VolunteerDashboard />
              </ProtectedRoute>
            } />
            
            {/* Mentor dashboard (protected) */}
            <Route path="/mentor/dashboard" element={
              <ProtectedRoute requiredRoles={["mentor", "admin"]}>
                <MentorDashboard />
              </ProtectedRoute>
            } />
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
            <Route path="/admin/events/new" element={
              <ProtectedRoute requiredRoles={["admin"]}>
                <AdminEventEditor />
              </ProtectedRoute>
            } />
            <Route path="/admin/events/:eventId/edit" element={
              <ProtectedRoute requiredRoles={["admin"]}>
                <AdminEventEditor />
              </ProtectedRoute>
            } />
            <Route path="/admin/workshops" element={
              <ProtectedRoute requiredRoles={["admin"]}>
                <AdminWorkshops />
              </ProtectedRoute>
            } />
            <Route path="/admin/events/:eventId/workshops/capacity" element={
              <ProtectedRoute requiredRoles={["admin"]}>
                <AdminWorkshopCapacity />
              </ProtectedRoute>
            } />
            <Route path="/admin/events/:eventId/workshops/preferences" element={
              <ProtectedRoute requiredRoles={["admin"]}>
                <AdminWorkshopPreferences />
              </ProtectedRoute>
            } />
            <Route path="/admin/events/:eventId/workshops/assign" element={
              <ProtectedRoute requiredRoles={["admin"]}>
                <AdminWorkshopAssignment />
              </ProtectedRoute>
            } />
            <Route path="/admin/events/:eventId/workshops/schedule" element={
              <ProtectedRoute requiredRoles={["admin"]}>
                <AdminWorkshopSchedule />
              </ProtectedRoute>
            } />
            <Route path="/admin/import-csv" element={
              <ProtectedRoute requiredRoles={["admin"]}>
                <AdminImportUnified />
              </ProtectedRoute>
            } />
            <Route path="/admin/import-teams" element={
              <ProtectedRoute requiredRoles={["admin"]}>
                <AdminImportTeams />
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
            <Route path="/admin/tickets" element={
              <ProtectedRoute requiredRoles={["admin"]}>
                <AdminTickets />
              </ProtectedRoute>
            } />
            
            {/* Participant dashboard */}
            <Route path="/dashboard" element={
              <ProtectedRoute>
                <ParticipantDashboard />
              </ProtectedRoute>
            } />
            
            {/* Event routes */}
            <Route path="/events" element={
              <ProtectedRoute>
                <EventsListPage />
              </ProtectedRoute>
            } />
            <Route path="/events/:eventId" element={
              <ProtectedRoute>
                <EventDetailPage />
              </ProtectedRoute>
            } />
            <Route path="/events/:eventId/register" element={
              <ProtectedRoute>
                <EventRegistrationPage />
              </ProtectedRoute>
            } />
            <Route path="/events/:eventId/confirmation/:registrationId" element={
              <ProtectedRoute>
                <RegistrationConfirmationPage />
              </ProtectedRoute>
            } />
            <Route path="/events/:eventId/workshop-preferences" element={
              <ProtectedRoute requiredRoles={["mentor", "admin"]}>
                <WorkshopPreferencesPage />
              </ProtectedRoute>
            } />
            <Route path="/tickets/:registrationId" element={
              <ProtectedRoute>
                <TicketDetailPage />
              </ProtectedRoute>
            } />
            <Route path="/validate" element={<ValidatePage />} />
            <Route path="/validate/:code" element={<ValidatePage />} />
            <Route path="/consentimiento" element={<ConsentPage />} />

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