import { Switch, Route, Router as WouterRouter } from "wouter";
import { useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import { AppProvider, useAppStore } from "@/lib/store";
import { AppLayout } from "@/components/layout/app-layout";
import Dashboard from "@/pages/dashboard";
import Products from "@/pages/products";
import Procurement from "@/pages/procurement";
import Orders from "@/pages/orders";
import Customers from "@/pages/customers";
import Ratings from "@/pages/ratings";
import Permissions from "@/pages/permissions";
import Riders from "@/pages/riders";
import SignIn from "@/pages/sign-in";
import { setLogoutHandler } from "@/lib/api/adminApi";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Data is considered fresh for 10 minutes — no refetch while navigating
      staleTime: 10 * 60 * 1000,
      // Keep unused cached data in memory for 30 minutes
      gcTime: 30 * 60 * 1000,
      // One retry on transient network errors, no exponential back-off delay
      retry: 1,
      retryDelay: 1_000,
    },
  },
});

function Router() {
  const { isAuthenticated, isRestoring, signOut } = useAppStore();

  // Register forced-logout handler so the API interceptor can sign out on token failure
  useEffect(() => {
    setLogoutHandler(signOut);
  }, [signOut]);

  if (isRestoring) return null;
  if (!isAuthenticated) return <SignIn />;

  return (
    <AppLayout>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/orders" component={Orders} />
        <Route path="/products" component={Products} />
        <Route path="/procurement" component={Procurement} />
        <Route path="/riders" component={Riders} />
        <Route path="/customers" component={Customers} />
        <Route path="/ratings" component={Ratings} />
        <Route path="/permissions" component={Permissions} />
        <Route component={NotFound} />
      </Switch>
    </AppLayout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AppProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <Router />
          </WouterRouter>
        </AppProvider>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
