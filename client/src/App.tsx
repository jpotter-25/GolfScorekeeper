import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";
import Home from "@/pages/Home";
import GameSetup from "@/pages/GameSetup";
import GameWrapper from "@/pages/GameWrapper";
import Settings from "@/pages/Settings";
import Cosmetics from "@/pages/Cosmetics";
import OnlineMultiplayer from "@/pages/OnlineMultiplayer";
import RoomView from "@/pages/RoomView";
import Landing from "@/pages/Landing";
import NotFound from "@/pages/not-found";

function Router() {
  const { isAuthenticated, isLoading } = useAuth();

  return (
    <Switch>
      {isLoading || !isAuthenticated ? (
        <Route path="/" component={Landing} />
      ) : (
        <>
          <Route path="/" component={Home} />
          <Route path="/setup" component={GameSetup} />
          <Route path="/game" component={GameWrapper} />
          <Route path="/settings" component={Settings} />
          <Route path="/cosmetics" component={Cosmetics} />
          <Route path="/online-multiplayer" component={OnlineMultiplayer} />
          <Route path="/room/:code" component={RoomView} />
        </>
      )}
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
