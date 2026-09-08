import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import InviteAccess from "./pages/InviteAccess";
import BoardJoin from "./pages/BoardJoin";
import Login from "./pages/Login";
import ManagerInviteAccess from "./pages/ManagerInviteAccess";
import BoardOnboarding from "./pages/BoardOnboarding";
import AdminDashboard from "./pages/AdminDashboard";
import { Privacy, Support } from "./pages/PublicInfo";

function Router() {
  // make sure to consider if you need authentication for certain routes
  return (
    <Switch>
      <Route path={"/"} component={Home} />
      <Route path={"/invite/:token"} component={InviteAccess} />
      <Route path={"/join/:token"} component={BoardJoin} />
      <Route path={"/login"} component={Login} />
      <Route path={"/manager-invite/:token"} component={ManagerInviteAccess} />
      <Route path={"/boards/new"}>{() => <BoardOnboarding />}</Route>
      <Route path={"/admin"} component={AdminDashboard} />
      <Route path={"/privacy"} component={Privacy} />
      <Route path={"/support"} component={Support} />
      <Route path={"/404"} component={NotFound} />
      {/* Final fallback route */}
      <Route component={NotFound} />
    </Switch>
  );
}

// NOTE: About Theme
// - First choose a default theme according to your design style (dark or light bg), than change color palette in index.css
//   to keep consistent foreground/background color across components
// - If you want to make theme switchable, pass `switchable` ThemeProvider and use `useTheme` hook

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider
        defaultTheme="light"
        // switchable
      >
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
