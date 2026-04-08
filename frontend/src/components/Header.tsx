import { Link } from "react-router";
import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { getTheme, setTheme } from "@/lib/theme";
import { Moon, Sun } from "lucide-react";

export function Header() {
  const { user, logout } = useAuth();
  const [dark, setDark] = useState(getTheme() === "dark");

  const toggleTheme = () => {
    const next = dark ? "light" : "dark";
    setTheme(next);
    setDark(!dark);
  };

  return (
    <header className="border-b">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
        <div className="flex items-center gap-6">
          <Link to="/" className="text-lg font-semibold">
            Cash Request
          </Link>
          <nav className="hidden sm:flex items-center gap-4">
            <Link to="/" className="text-sm text-muted-foreground hover:text-foreground">
              Dashboard
            </Link>
            <Link to="/new" className="text-sm text-muted-foreground hover:text-foreground">
              New Request
            </Link>
          </nav>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={toggleTheme} aria-label="Toggle theme">
            {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
          {user && (
            <>
              <span className="text-sm text-muted-foreground hidden sm:inline">{user.email}</span>
              <Button variant="ghost" size="sm" onClick={logout}>
                Log out
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
