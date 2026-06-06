import { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@workspace/replit-auth-web";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LayoutDashboard, LogOut } from "lucide-react";

export function Layout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const [location] = useLocation();

  return (
    <div className="min-h-[100dvh] flex flex-col bg-background">
      <header className="h-14 border-b bg-card flex items-center justify-between px-4 sm:px-6 sticky top-0 z-10">
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-2 font-bold text-lg text-primary">
            <div className="w-8 h-8 bg-primary/10 rounded flex items-center justify-center">
              <LayoutDashboard className="w-5 h-5" />
            </div>
            TaskBoard
          </Link>
          <nav className="hidden sm:flex items-center gap-4">
            <Link 
              href="/" 
              className={`text-sm font-medium transition-colors hover:text-primary ${location === "/" ? "text-foreground" : "text-muted-foreground"}`}
            >
              Dashboard
            </Link>
          </nav>
        </div>

        <div className="flex items-center gap-4">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="relative h-9 w-9 rounded-full">
                <Avatar className="h-9 w-9 border border-border">
                  <AvatarImage src={user?.profileImage || ""} alt={user?.username || ""} />
                  <AvatarFallback>{user?.firstName?.[0] || user?.username?.[0] || "U"}</AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56" align="end" forceMount>
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium leading-none">{user?.firstName} {user?.lastName}</p>
                  <p className="text-xs leading-none text-muted-foreground">
                    @{user?.username}
                  </p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={logout} className="text-destructive focus:text-destructive cursor-pointer">
                <LogOut className="mr-2 h-4 w-4" />
                <span>Log out</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <main className="flex-1 flex flex-col overflow-hidden">
        {children}
      </main>
    </div>
  );
}
