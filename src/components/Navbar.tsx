import React from "react";
import { BookOpen, Sparkles, LogOut, Moon, Sun, ArrowRight, LayoutDashboard } from "lucide-react";
import { User } from "../types";

interface NavbarProps {
  user: User | null;
  currentView: "landing" | "dashboard";
  darkMode: boolean;
  onToggleDarkMode: () => void;
  onNavigate: (view: "landing" | "dashboard") => void;
  onOpenAuth: (mode: "login" | "signup") => void;
  onLogout: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  user,
  currentView,
  darkMode,
  onToggleDarkMode,
  onNavigate,
  onOpenAuth,
  onLogout,
}) => {
  return (
    <header className="sticky top-0 z-40 w-full h-16 border-b border-slate-200 bg-white/95 backdrop-blur-md transition-colors dark:border-slate-800 dark:bg-slate-900/95">
      <div className="flex h-full w-full items-center justify-between px-2.5 sm:px-4 gap-3 sm:gap-4">
        {/* Left: Brand Logo */}
        <div
          id="navbar-brand-logo"
          onClick={() => onNavigate("landing")}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === "Enter" && onNavigate("landing")}
          className="flex cursor-pointer items-center gap-3 transition-opacity hover:opacity-90 shrink-0 select-none"
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-900 text-white shadow-xs ring-1 ring-slate-950/10 dark:bg-indigo-600 transition-colors">
            <BookOpen className="h-4.5 w-4.5 text-indigo-400 dark:text-white" />
          </div>
          <div className="flex flex-col justify-center">
            <div className="flex items-center gap-2">
              <span className="font-black tracking-tight text-slate-900 text-base sm:text-lg dark:text-white leading-tight">
                PaperMind
              </span>
              <span className="inline-flex items-center rounded-md bg-indigo-50 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-indigo-700 border border-indigo-200/60 dark:bg-indigo-950/70 dark:text-indigo-300 dark:border-indigo-800/80">
                Agentic RAG
              </span>
            </div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 leading-none mt-0.5 hidden sm:block">
              AI Research Paper Analyzer
            </p>
          </div>
        </div>

        {/* Center: Centered Nav Links with Symmetric Segmented Pills */}
        <div className="hidden md:flex items-center justify-center flex-1">
          <nav
            id="navbar-nav-links"
            className="inline-flex h-9 items-center rounded-xl bg-slate-100/90 p-1 border border-slate-200/80 dark:bg-slate-800/80 dark:border-slate-700/80 gap-1 shadow-2xs"
          >
            <button
              id="nav-link-overview"
              type="button"
              onClick={() => onNavigate("landing")}
              className={`inline-flex h-7 items-center gap-1.5 rounded-lg px-3 text-xs font-bold uppercase tracking-wider transition-all ${
                currentView === "landing"
                  ? "bg-white text-slate-900 shadow-xs font-black dark:bg-slate-900 dark:text-white"
                  : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
              }`}
            >
              <LayoutDashboard className="h-3.5 w-3.5" />
              <span>Overview</span>
            </button>
            <button
              id="nav-link-dashboard"
              type="button"
              onClick={() => onNavigate("dashboard")}
              className={`inline-flex h-7 items-center gap-1.5 rounded-lg px-3 text-xs font-bold uppercase tracking-wider transition-all ${
                currentView === "dashboard"
                  ? "bg-white text-slate-900 shadow-xs font-black dark:bg-slate-900 dark:text-white"
                  : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
              }`}
            >
              <BookOpen className="h-3.5 w-3.5" />
              <span>Workspace Dashboard</span>
            </button>
          </nav>
        </div>

        {/* Right: Actions Area with Uniform H-9 Heights */}
        <div id="navbar-user-actions" className="flex items-center gap-2 sm:gap-2.5 shrink-0">
          {/* Mobile view switch button */}
          <button
            type="button"
            onClick={() => onNavigate(currentView === "landing" ? "dashboard" : "landing")}
            className="md:hidden h-9 inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-2.5 text-xs font-bold uppercase tracking-wider text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
          >
            {currentView === "landing" ? (
              <>
                <BookOpen className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
                <span className="text-[11px]">Workspace</span>
              </>
            ) : (
              <>
                <LayoutDashboard className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
                <span className="text-[11px]">Overview</span>
              </>
            )}
          </button>

          {/* Dark Mode Toggle */}
          <button
            id="theme-toggle-btn"
            type="button"
            onClick={onToggleDarkMode}
            title={darkMode ? "Switch to light mode" : "Switch to dark mode"}
            aria-label={darkMode ? "Switch to light mode" : "Switch to dark mode"}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:text-white"
          >
            {darkMode ? <Sun className="h-4 w-4 text-amber-400" /> : <Moon className="h-4 w-4" />}
          </button>

          {user ? (
            <div className="flex items-center gap-2 sm:gap-2.5">
              <button
                id="nav-btn-active-session"
                type="button"
                onClick={() => onNavigate("dashboard")}
                className="hidden sm:inline-flex h-9 items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs font-bold uppercase tracking-wider text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 transition-colors"
              >
                <Sparkles className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
                <span>Active</span>
              </button>

              <span className="h-5 w-px bg-slate-200 dark:bg-slate-800 shrink-0" />

              {/* User profile capsule */}
              <div className="flex h-9 items-center gap-2 rounded-xl border border-slate-200/80 bg-slate-50/80 pl-1 pr-2.5 dark:border-slate-800 dark:bg-slate-800/60">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-900 text-white text-xs font-bold shadow-xs dark:bg-indigo-600">
                  {user.name.charAt(0).toUpperCase()}
                </div>
                <div className="hidden lg:flex flex-col text-left">
                  <span className="text-xs font-bold text-slate-900 leading-none dark:text-white">{user.name}</span>
                  <span className="text-[10px] text-slate-400 dark:text-slate-500 leading-none mt-0.5 truncate max-w-[110px]">{user.email}</span>
                </div>
              </div>

              <button
                id="nav-btn-logout"
                type="button"
                onClick={onLogout}
                title="Logout"
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-transparent text-slate-400 hover:border-slate-200 hover:bg-rose-50 hover:text-rose-600 dark:hover:border-slate-700 dark:hover:bg-rose-950/50 dark:hover:text-rose-400 transition-colors"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2 sm:gap-2.5">
              <button
                id="nav-btn-login"
                type="button"
                onClick={() => onOpenAuth("login")}
                className="h-9 inline-flex items-center justify-center rounded-xl px-3 sm:px-3.5 text-xs font-bold uppercase tracking-wider text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 transition-colors"
              >
                Log In
              </button>
              <button
                id="nav-btn-signup"
                type="button"
                onClick={() => onOpenAuth("signup")}
                className="h-9 inline-flex items-center justify-center gap-1.5 rounded-xl bg-slate-900 px-3.5 sm:px-4 text-xs font-bold uppercase tracking-wider text-white shadow-xs hover:bg-slate-800 dark:bg-indigo-600 dark:hover:bg-indigo-500 transition-all"
              >
                <span>Get Started</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
