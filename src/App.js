import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './components/Login';
import SupervisorChecklist from './components/SupervisorChecklist';
import JefeDashboard from './components/JefeDashboard';
import PrivateRoute from './components/PrivateRoute';
import Administrador from './components/Administrador';
import Footer from './components/Footer';
import './App.css';

function App() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    }
  }, []);

  const getDashboard = () => {
    if (!user) return <Navigate to="/login" />;
    if (user.role === 'SUPERVISOR') return <SupervisorChecklist />;
    return <JefeDashboard />;
  };

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login setUser={setUser} />} />
        <Route path="/" element={<PrivateRoute>{getDashboard()}</PrivateRoute>} />
        <Route path="/adminUsuarios" element={<PrivateRoute><Administrador /></PrivateRoute>} />
      </Routes>
      <div>
        <Footer />
      </div>
    </BrowserRouter>
  );
}

export default App;