import React, { useState, useEffect } from "react";
import { Navbar } from "./components/Navbar";
import { LandingPage } from "./components/LandingPage";
import { Dashboard } from "./components/Dashboard";
import { AuthModal } from "./components/AuthModal";
import { UploadModal } from "./components/UploadModal";
import { VoiceChatModal } from "./components/VoiceChatModal";
import { User, Paper } from "./types";

export default function App() {
  const [currentView, setCurrentView] = useState<"landing" | "dashboard">("landing");
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "signup">("login");
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [voiceChatModalOpen, setVoiceChatModalOpen] = useState(false);

  // Dark mode state
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    const saved = localStorage.getItem("papermind_theme");
    if (saved) return saved === "dark";
    return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
  });

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("papermind_theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("papermind_theme", "light");
    }
  }, [darkMode]);

  const toggleDarkMode = () => {
    setDarkMode((prev) => !prev);
  };

  const [papers, setPapers] = useState<Paper[]>([]);
  const [selectedPaper, setSelectedPaper] = useState<Paper | null>(null);
  const [loadingPapers, setLoadingPapers] = useState(false);

  // Initialize session from localStorage
  useEffect(() => {
    const storedToken = localStorage.getItem("papermind_token");
    if (storedToken) {
      setToken(storedToken);
      fetch("/api/auth/me", {
        headers: { Authorization: `Bearer ${storedToken}` },
      })
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data && data.user) {
            setUser(data.user);
          } else {
            localStorage.removeItem("papermind_token");
            setToken(null);
          }
        })
        .catch(() => {
          localStorage.removeItem("papermind_token");
          setToken(null);
        });
    }
  }, []);

  // Fetch papers
  const loadPapers = async () => {
    setLoadingPapers(true);
    try {
      const headers: Record<string, string> = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const res = await fetch("/api/papers", { headers });
      const data = await res.json();
      if (res.ok && data.papers) {
        setPapers(data.papers);
        // Select first paper by default if none selected
        if (!selectedPaper && data.papers.length > 0) {
          setSelectedPaper(data.papers[0]);
        }
      }
    } catch (err) {
      console.error("Failed to load papers:", err);
    } finally {
      setLoadingPapers(false);
    }
  };

  useEffect(() => {
    loadPapers();
  }, [token]);

  const handleLoginSuccess = (authenticatedUser: User, sessionToken: string) => {
    setUser(authenticatedUser);
    setToken(sessionToken);
    localStorage.setItem("papermind_token", sessionToken);
    setCurrentView("dashboard");
  };

  const handleLogout = () => {
    if (token) {
      fetch("/api/auth/logout", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      }).catch(() => {});
    }
    setUser(null);
    setToken(null);
    localStorage.removeItem("papermind_token");
    setCurrentView("landing");
  };

  const handleOpenAuth = (mode: "login" | "signup") => {
    setAuthMode(mode);
    setAuthModalOpen(true);
  };

  const handlePaperUploaded = (newPaper: Paper) => {
    setPapers((prev) => [newPaper, ...prev]);
    setSelectedPaper(newPaper);
  };

  const handleDeletePaper = async (paperId: string) => {
    try {
      const headers: Record<string, string> = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const res = await fetch(`/api/papers/${paperId}`, {
        method: "DELETE",
        headers,
      });
      if (res.ok) {
        setPapers((prev) => prev.filter((p) => p.id !== paperId));
        if (selectedPaper?.id === paperId) {
          const remaining = papers.filter((p) => p.id !== paperId);
          setSelectedPaper(remaining.length > 0 ? remaining[0] : null);
        }
      }
    } catch (err) {
      console.error("Failed to delete paper:", err);
    }
  };

  const handleLoadSample = async () => {
    await loadPapers();
    const sample = papers.find((p) => p.id === "paper_attention_landmark");
    if (sample) {
      setSelectedPaper(sample);
      setCurrentView("dashboard");
    }
  };

  return (
    <div className="min-h-screen bg-white flex flex-col font-sans text-slate-900 dark:bg-slate-950 dark:text-slate-100 transition-colors">
      {/* Navigation */}
      <Navbar
        user={user}
        currentView={currentView}
        darkMode={darkMode}
        onToggleDarkMode={toggleDarkMode}
        onNavigate={(view) => setCurrentView(view)}
        onOpenAuth={handleOpenAuth}
        onLogout={handleLogout}
      />

      {/* Main View Router */}
      <div className="flex-1">
        {currentView === "landing" ? (
          <LandingPage
            onGetStarted={() => {
              if (user) {
                setCurrentView("dashboard");
              } else {
                handleOpenAuth("login");
              }
            }}
            onOpenAuth={handleOpenAuth}
            isLoggedIn={Boolean(user)}
          />
        ) : (
          <Dashboard
            papers={papers}
            selectedPaper={selectedPaper}
            onSelectPaper={(paper) => setSelectedPaper(paper)}
            onOpenUpload={() => setUploadModalOpen(true)}
            onOpenVoiceChat={() => setVoiceChatModalOpen(true)}
            onDeletePaper={handleDeletePaper}
            onLoadSample={handleLoadSample}
            token={token}
          />
        )}
      </div>

      {/* Modals */}
      <AuthModal
        isOpen={authModalOpen}
        initialMode={authMode}
        onClose={() => setAuthModalOpen(false)}
        onSuccess={handleLoginSuccess}
      />

      <UploadModal
        isOpen={uploadModalOpen}
        onClose={() => setUploadModalOpen(false)}
        token={token}
        onSuccess={handlePaperUploaded}
      />

      <VoiceChatModal
        isOpen={voiceChatModalOpen}
        onClose={() => setVoiceChatModalOpen(false)}
        paper={selectedPaper}
      />
    </div>
  );
}
