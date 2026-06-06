import { useAuth } from "@workspace/replit-auth-web";
import { Button } from "@/components/ui/button";

export function LoginScreen() {
  const { login } = useAuth();
  
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background p-4">
      <div className="max-w-md w-full p-8 rounded-2xl bg-card border shadow-xl flex flex-col items-center text-center">
        <div className="w-16 h-16 bg-primary/10 text-primary rounded-xl flex items-center justify-center mb-6">
          <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinelinejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><line x1="9" x2="9" y1="3" y2="21"/><path d="M14 8h.01"/><path d="M14 14h.01"/></svg>
        </div>
        <h1 className="text-3xl font-bold tracking-tight mb-2">TaskBoard</h1>
        <p className="text-muted-foreground mb-8 text-lg">Clarity for your team's projects.</p>
        <Button onClick={login} size="lg" className="w-full text-base h-12">Log in to TaskBoard</Button>
      </div>
    </div>
  );
}
