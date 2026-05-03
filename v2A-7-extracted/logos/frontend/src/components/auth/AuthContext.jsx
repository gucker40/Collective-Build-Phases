// AuthContext.jsx - Global user session management
import React, { createContext, useContext, useState, useEffect } from "react";

import { API } from "../../api.js";
const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null);   // { username, display_name, role, token }
  const [loading, setLoading] = useState(true);   // checking stored token on boot

  useEffect(() => {
    const stored = localStorage.getItem("logos_token");
    const info   = localStorage.getItem("logos_user");
    if (stored && info) {
      try {
        const u = JSON.parse(info);
        // Quick verify with backend
        fetch(`${API}/users/me`, { headers: { Authorization: `Bearer ${stored}` } })
          .then(r => r.ok ? r.json() : null)
          .then(data => {
            if (data) setUser({ ...u, token: stored, ...data });
            else { localStorage.removeItem("logos_token"); localStorage.removeItem("logos_user"); }
          })
          .catch(() => {})
          .finally(() => setLoading(false));
      } catch { setLoading(false); }
    } else {
      setLoading(false);
    }
  }, []);

  function login(token, userInfo) {
    localStorage.setItem("logos_token", token);
    localStorage.setItem("logos_user", JSON.stringify(userInfo));
    setUser({ ...userInfo, token });
  }

  function logout() {
    localStorage.removeItem("logos_token");
    localStorage.removeItem("logos_user");
    setUser(null);
  }

  function isAdmin() { return user?.role === "admin"; }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, isAdmin }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() { return useContext(AuthContext); }
export { API };
