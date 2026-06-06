import { Switch, Route, Router as WouterRouter, Link, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import { useAuth } from "@workspace/replit-auth-web";
import { LoginScreen } from "@/components/login-screen";

import { Dashboard } from "@/pages/dashboard";
import { BoardView } from "@/pages/board";
import { CardDetail } from "@/pages/card-detail";
import { MembersView } from "@/pages/members";
import { Layout } from "@/components/layout";

const queryClient = new QueryClient();

function Router() {
  const { isAuthenticated, isLoading } = useAuth();
  
  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center">
      <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
    </div>;
  }
  
  if (!isAuthenticated) {
    return <LoginScreen />;
  }

  return (
    <Layout>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/boards/:boardId" component={BoardView} />
        <Route path="/boards/:boardId/card/:cardId" component={CardDetail} />
        <Route path="/boards/:boardId/members" component={MembersView} />
        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
