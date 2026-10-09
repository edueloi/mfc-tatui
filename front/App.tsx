import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { ToastProvider } from './components/ui/Toast';
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
import EventDetail from './views/EventDetail';
import EventFormPage from './views/EventFormPage';
import EventPublicForm from './views/EventPublicForm';
import Nucleacao from './views/Nucleacao';
import NucleationDetail from './views/NucleationDetail';
import BlogManagement from './views/BlogManagement';
import { User as UserType } from './types';

// Lido já na primeira renderização: se esperasse um efeito, quem está logado seria mandado para o login ao atualizar a página.
const readStoredUser = (): UserType | null => {
  try {
    const stored = localStorage.getItem('mfc.currentUser');
    return stored ? JSON.parse(stored) as UserType : null;
  } catch {
    localStorage.removeItem('mfc.currentUser');
    return null;
  }
};

/** Sem login: a página inicial é o site público (/site/); qualquer outro endereço vai para o login e volta depois. */
const EntryRedirect: React.FC = () => {
  const location = useLocation();
  useEffect(() => { if (location.pathname === '/') window.location.replace('/site/'); }, [location.pathname]);
  if (location.pathname === '/') return null;
  return <Navigate to={`/entrar?next=${encodeURIComponent(location.pathname + location.search)}`} replace />;
};

const LoginRoute: React.FC<{ onLogin: (user: UserType) => void }> = ({ onLogin }) => {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = params.get('next');
  // Só volta para caminhos do próprio sistema.
  const destination = next && next.startsWith('/') && !next.startsWith('//') ? next : '/';
  return <Login onLogin={user => { onLogin(user); navigate(destination, { replace: true }); }} />;
};

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<UserType | null>(readStoredUser);

  const handleLogout = () => {
    localStorage.removeItem('mfc.currentUser');
    setCurrentUser(null);
    window.location.replace('/site/');
  };

  return (
    <ToastProvider>
      <BrowserRouter>
        <Routes>
          {/* Rota pública — sem login, sem sidebar */}
          <Route path="/noivos/form/:token" element={<BridalPublicForm />} />
          <Route path="/eventos/inscricao/:token" element={<EventPublicForm />} />

          {!currentUser ? (
            <>
              <Route
                path="/entrar"
                element={
                  <LoginRoute
                    onLogin={(user) => {
                      localStorage.setItem('mfc.currentUser', JSON.stringify(user));
                      setCurrentUser(user);
                    }}
                  />
                }
              />
              <Route path="*" element={<EntryRedirect />} />
            </>
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
              <Route path="eventos/novo" element={<EventFormPage />} />
              <Route path="eventos/:eventSlug/editar" element={<EventFormPage />} />
              <Route path="eventos/:eventSlug" element={<EventDetail />} />
              <Route path="financeiro" element={<FinanceView cityId={currentUser.cityId} userId={currentUser.id} />} />
              <Route path="financeiro/:teamSlug" element={<FinanceView cityId={currentUser.cityId} userId={currentUser.id} />} />
              <Route path="livro-caixa" element={<GeneralLedger />} />
              <Route path="livro-caixa/:bookSlug" element={<GeneralLedger />} />
              <Route path="lancamentos" element={<DailyEntries />} />
              <Route path="encontro-noivos" element={<EncontroNoivos />} />
              <Route path="encontro-noivos/casais" element={<EncontroNoivos />} />
              <Route path="encontro-noivos/encontro/:meetingSlug" element={<EncontroNoivos />} />
              <Route path="encontro-noivos/:coupleSlug" element={<BridalCoupleDetail />} />
              <Route path="nucleacao" element={<Nucleacao />} />
              <Route path="nucleacao/:contactSlug" element={<NucleationDetail />} />
              <Route path="historias" element={<BlogManagement />} />
              <Route path="usuarios" element={<UserManagement />} />
              <Route path="configuracoes" element={<Navigate to="/configuracoes/acessos" replace />} />
              <Route path="configuracoes/:tab" element={<SettingsView />} />
              <Route path="entrar" element={<Navigate to="/" replace />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          )}
        </Routes>
      </BrowserRouter>
    </ToastProvider>
  );
};

export default App;
