import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import Layout from './components/Layout';
import Dashboard from './views/Dashboard';
import Members from './views/Members';
import Teams from './views/Teams';
import TeamDetail from './views/TeamDetail';
import MemberProfile from './views/MemberProfile';
import MemberFormPage from './views/MemberFormPage';
import SettingsView from './views/Settings';
import UserManagement from './views/UserManagement';
import MyTeamView from './views/MyTeam';
import FinanceView from './views/Finance';
import GeneralLedger from './views/GeneralLedger';
import EventsView from './views/Events';
import Login from './views/Login';
import Reports from './views/Reports';
import DailyEntries from './views/DailyEntries';
import EncontroNoivos from './views/EncontroNoivos';
import BridalCoupleDetail from './views/BridalCoupleDetail';
import BridalPublicForm from './views/BridalPublicForm';
import Nucleacao from './views/Nucleacao';
import { User as UserType } from './types';

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<UserType | null>(null);

  useEffect(() => {
    const storedUser = localStorage.getItem('mfc.currentUser');
    if (storedUser) {
      try {
        setCurrentUser(JSON.parse(storedUser) as UserType);
      } catch {
        localStorage.removeItem('mfc.currentUser');
      }
    }
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('mfc.currentUser');
    setCurrentUser(null);
  };

  return (
    <>
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 3000,
          style: {
            background: '#363636',
            color: '#fff',
            fontWeight: 600,
          },
          success: {
            iconTheme: {
              primary: '#10b981',
              secondary: '#fff',
            },
          },
          error: {
            iconTheme: {
              primary: '#ef4444',
              secondary: '#fff',
            },
          },
        }}
      />
      <BrowserRouter>
        <Routes>
          {/* Rota pública — sem login, sem sidebar */}
          <Route path="/noivos/form/:token" element={<BridalPublicForm />} />

          {!currentUser ? (
            <Route
              path="*"
              element={
                <Login
                  onLogin={(user) => {
                    localStorage.setItem('mfc.currentUser', JSON.stringify(user));
                    setCurrentUser(user);
                  }}
                />
              }
            />
          ) : (
            <Route path="/" element={<Layout currentUser={currentUser} onLogout={handleLogout} />}>
              <Route index element={<Dashboard />} />
              <Route path="relatorios" element={<Reports />} />
              <Route path="mfcistas" element={<Members />} />
              <Route path="mfcistas/novo" element={<MemberFormPage />} />
              <Route path="mfcistas/:memberId/editar" element={<MemberFormPage />} />
              <Route path="mfcistas/:memberId" element={<MemberProfile />} />
              <Route path="equipes" element={<Teams />} />
              <Route path="equipes/:teamSlug" element={<TeamDetail />} />
              <Route path="minha-equipe" element={<MyTeamView teamId={currentUser.teamId || 't1'} userId={currentUser.id} userRole={currentUser.role} />} />
              <Route path="eventos" element={<EventsView />} />
              <Route path="financeiro" element={<FinanceView cityId={currentUser.cityId} userId={currentUser.id} />} />
              <Route path="financeiro/:teamSlug" element={<FinanceView cityId={currentUser.cityId} userId={currentUser.id} />} />
              <Route path="livro-caixa" element={<GeneralLedger />} />
              <Route path="lancamentos" element={<DailyEntries />} />
              <Route path="encontro-noivos" element={<EncontroNoivos />} />
              <Route path="encontro-noivos/casais" element={<EncontroNoivos />} />
              <Route path="encontro-noivos/encontro/:meetingSlug" element={<EncontroNoivos />} />
              <Route path="encontro-noivos/:coupleSlug" element={<BridalCoupleDetail />} />
              <Route path="nucleacao" element={<Nucleacao />} />
              <Route path="usuarios" element={<UserManagement />} />
              <Route path="configuracoes" element={<SettingsView />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          )}
        </Routes>
      </BrowserRouter>
    </>
  );
};

export default App;
