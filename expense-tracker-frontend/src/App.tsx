import React, { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './components/Login';
import Register from './components/Register';
import Dashboard from './components/Dashboard';
import './App.css';

function App() {
  const [token, setToken] = useState<string | null>(sessionStorage.getItem('token'));
  const [showRegister, setShowRegister] = useState(false);

  const handleLogin = (newToken: string) => {
    setToken(newToken);
  };

  const handleLogout = () => {
    setToken(null);
  };

  return (
    <BrowserRouter>
      <div className="App">
        <Routes>
          <Route
            path="/"
            element={
              token ? (
                <Dashboard onLogout={handleLogout} />
              ) : showRegister ? (
                <Register onSwitchToLogin={() => setShowRegister(false)} />
              ) : (
                <Login onLogin={handleLogin} onSwitchToRegister={() => setShowRegister(true)} />
              )
            }
          />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}

export default App;
