import { useState, useEffect, useCallback, useRef } from 'react';
import gsap from 'gsap';
import { EvaluationForm } from './components/EvaluationForm';
import { SimpleEvaluationForm } from './components/SimpleEvaluationForm';
import { AdminDashboard } from './components/AdminDashboard';
import { AuthModal } from './components/AuthModal';
import { QrCode, RefreshCw, FileText, SlidersHorizontal } from 'lucide-react';
import {
  syncPendingEvaluations,
  getPendingEvaluations,
  SYNC_EVENT_NAME
} from './lib/syncService';

export function App() {
  const [view, setView] = useState<'form' | 'admin'>('form');
  const [evaluationMode, setEvaluationMode] = useState<'simple' | 'avanzada'>('simple');
  const [currentUser, setCurrentUser] = useState<string | null>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [pendingCount, setPendingCount] = useState(() => getPendingEvaluations().length);
  const [isSyncingGlobal, setIsSyncingGlobal] = useState(false);
  const [isSwitchingMode, setIsSwitchingMode] = useState(false);
  const mainContainerRef = useRef<HTMLElement | null>(null);

  // Helper para verificar si la URL actual corresponde a /admin
  const checkIsAdminRoute = useCallback(() => {
    const path = window.location.pathname.toLowerCase().replace(/\/+$/, '');
    const hash = window.location.hash.toLowerCase();
    const search = window.location.search.toLowerCase();

    return (
      path.endsWith('/admin') ||
      path === '/admin' ||
      hash === '#admin' ||
      hash === '#/admin' ||
      search.includes('admin')
    );
  }, []);

  // Sincronizar ruta al cargar y escuchar navegación del navegador (atrás/adelante)
  useEffect(() => {
    const savedUser = localStorage.getItem('mg_sensorial_admin_user');
    const isValidUser = Boolean(savedUser && savedUser.endsWith('@migusto.com.ar'));
    if (isValidUser && savedUser) {
      setCurrentUser(savedUser);
    }

    if (checkIsAdminRoute()) {
      if (isValidUser) {
        setView('admin');
      } else {
        setView('form');
        setIsAuthModalOpen(true);
      }
    }

    const handleLocationChange = () => {
      const user = localStorage.getItem('mg_sensorial_admin_user');
      const hasAuth = Boolean(user && user.endsWith('@migusto.com.ar'));
      if (checkIsAdminRoute()) {
        if (hasAuth) {
          setView('admin');
        } else {
          setView('form');
          setIsAuthModalOpen(true);
        }
      } else {
        setView('form');
        setIsAuthModalOpen(false);
      }
    };

    window.addEventListener('popstate', handleLocationChange);
    window.addEventListener('hashchange', handleLocationChange);

    // Auto-sincronización inicial y al recuperar conectividad
    syncPendingEvaluations().catch(console.warn);

    const handleOnline = () => {
      syncPendingEvaluations().catch(console.warn);
    };
    const handleSyncUpdate = () => {
      setPendingCount(getPendingEvaluations().length);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener(SYNC_EVENT_NAME, handleSyncUpdate);

    return () => {
      window.removeEventListener('popstate', handleLocationChange);
      window.removeEventListener('hashchange', handleLocationChange);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener(SYNC_EVENT_NAME, handleSyncUpdate);
    };
  }, [checkIsAdminRoute]);

  const handleOpenAdmin = () => {
    if (currentUser) {
      setView('admin');
      const basePath = import.meta.env.BASE_URL.replace(/\/+$/, '');
      window.history.pushState({}, '', `${basePath}/admin`);
    } else {
      setIsAuthModalOpen(true);
    }
  };

  const handleAuthSuccess = (email: string) => {
    setCurrentUser(email);
    setView('admin');
    const basePath = import.meta.env.BASE_URL.replace(/\/+$/, '');
    window.history.replaceState({}, '', `${basePath}/admin`);
  };

  const handleBackToForm = () => {
    setView('form');
    window.history.replaceState({}, '', import.meta.env.BASE_URL);
  };

  const handleSwitchMode = (newMode: 'simple' | 'avanzada') => {
    if (newMode === evaluationMode || isSwitchingMode) return;
    setIsSwitchingMode(true);

    if (mainContainerRef.current) {
      gsap.to(mainContainerRef.current, {
        opacity: 0,
        y: 8,
        duration: 0.16,
        ease: 'power2.in',
        onComplete: () => {
          setEvaluationMode(newMode);
          window.scrollTo({ top: 0, behavior: 'instant' });
          gsap.fromTo(
            mainContainerRef.current,
            { opacity: 0, y: -8 },
            {
              opacity: 1,
              y: 0,
              duration: 0.26,
              ease: 'power2.out',
              onComplete: () => {
                setIsSwitchingMode(false);
              }
            }
          );
        }
      });
    } else {
      setEvaluationMode(newMode);
      setIsSwitchingMode(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('mg_sensorial_admin_user');
    setCurrentUser(null);
    setView('form');
    window.history.replaceState({}, '', import.meta.env.BASE_URL);
  };

  const handleCloseAuthModal = () => {
    setIsAuthModalOpen(false);
    if (view !== 'admin') {
      window.history.replaceState({}, '', import.meta.env.BASE_URL);
    }
  };

  return (
    <div className="min-h-screen bg-[#ebdccb] text-[#2c2724] flex flex-col selection:bg-[#4f46e5] selection:text-white font-sans">
      {/* Header Compacto - Rojo Coral (#FC7572) con CATA (#5969E6) */}
      <header className="border-b border-[#e86360] bg-[#FC7572] sticky top-0 z-40 px-3.5 py-2.5 shadow-md">
        <div className="w-full max-w-xl sm:max-w-3xl md:max-w-5xl lg:max-w-6xl xl:max-w-7xl mx-auto px-0 sm:px-2 flex items-center justify-between transition-all">
          <div
            onClick={handleBackToForm}
            className="flex items-center gap-3 cursor-pointer group active:scale-[0.98] transition-all"
          >
            <div className="relative flex items-center">
              <img
                src={`${import.meta.env.BASE_URL}logo-script.png`}
                alt="Mi Gusto"
                className="h-8 sm:h-9 w-auto max-w-[130px] object-contain brightness-0 invert drop-shadow-sm transition-transform group-hover:scale-105"
              />
            </div>
            <div className="h-6 w-px bg-white/30 hidden xs:block" />
            <div className="flex flex-col justify-center">
              <div className="flex items-center gap-1.5">
                <span className="font-extrabold text-xs sm:text-sm tracking-tight text-white block leading-none drop-shadow-sm">
                  SENSORIAL
                </span>
              </div>
              <span className="text-[9px] uppercase font-bold tracking-wider text-white/90 leading-none mt-1">
                Calidad & Desarrollo
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            {pendingCount > 0 && (
              <button
                onClick={async () => {
                  setIsSyncingGlobal(true);
                  await syncPendingEvaluations();
                  setIsSyncingGlobal(false);
                }}
                title="Sincronizar evaluaciones guardadas en este dispositivo con la base de datos"
                className="text-[11px] font-bold px-2.5 py-1.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-amber-950 active:scale-95 transition-all flex items-center gap-1.5 shadow-sm animate-pulse"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isSyncingGlobal ? 'animate-spin' : ''}`} />
                <span>Sincronizar ({pendingCount})</span>
              </button>
            )}

            {/* SWITCH MODO: SIMPLE / AVANZADA CON PASTILLA DESLIZANTE */}
            {view === 'form' && (
              <div className="relative bg-black/25 p-1 rounded-xl flex items-center shadow-inner backdrop-blur-sm border border-white/20 select-none min-w-[170px] sm:min-w-[185px]">
                {/* Pastilla indicadora animada que se desliza suavemente */}
                <div
                  className={`absolute top-1 bottom-1 rounded-lg transition-all duration-300 ease-out shadow-md pointer-events-none ${
                    evaluationMode === 'simple'
                      ? 'left-1 w-[calc(50%-4px)] bg-white'
                      : 'left-[50%] w-[calc(50%-4px)] bg-[#5969E6]'
                  }`}
                />

                <button
                  type="button"
                  onClick={() => handleSwitchMode('simple')}
                  className={`relative z-10 text-xs font-black px-2.5 sm:px-3 py-1 rounded-lg flex items-center justify-center gap-1.5 transition-colors duration-300 flex-1 ${
                    evaluationMode === 'simple'
                      ? 'text-[#FC7572]'
                      : 'text-white/80 hover:text-white'
                  }`}
                >
                  <FileText className="w-3.5 h-3.5 shrink-0" />
                  <span>Simple</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleSwitchMode('avanzada')}
                  className={`relative z-10 text-xs font-black px-2.5 sm:px-3 py-1 rounded-lg flex items-center justify-center gap-1.5 transition-colors duration-300 flex-1 ${
                    evaluationMode === 'avanzada'
                      ? 'text-white'
                      : 'text-white/80 hover:text-white'
                  }`}
                >
                  <SlidersHorizontal className="w-3.5 h-3.5 shrink-0" />
                  <span>Avanzada</span>
                </button>
              </div>
            )}
            {view === 'admin' && (
              <button
                onClick={handleBackToForm}
                className="text-[11px] font-bold px-3 py-1.5 rounded-xl border border-white/30 text-white bg-white/20 hover:bg-white/30 active:scale-95 transition-all flex items-center gap-1.5 shadow-sm"
              >
                <QrCode className="w-3.5 h-3.5 text-white" />
                <span>Cata Sensorial</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Banner de alerta de evaluaciones offline pendientes en este dispositivo */}
      {pendingCount > 0 && (
        <div className="bg-amber-500 text-white text-xs font-semibold px-4 py-2 flex items-center justify-between shadow-inner">
          <div className="flex items-center gap-2">
            <span className="text-sm">⚠️</span>
            <span>
              Tenés <strong>{pendingCount}</strong> evaluación/es guardadas en este dispositivo pendientes de sincronizar con Supabase.
            </span>
          </div>
          <button
            onClick={async () => {
              setIsSyncingGlobal(true);
              await syncPendingEvaluations();
              setIsSyncingGlobal(false);
            }}
            disabled={isSyncingGlobal}
            className="bg-white text-amber-950 font-bold px-3 py-1 rounded-lg text-[11px] uppercase tracking-wider hover:bg-amber-50 active:scale-95 transition-all disabled:opacity-50"
          >
            {isSyncingGlobal ? 'Sincronizando...' : 'Sincronizar Ahora'}
          </button>
        </div>
      )}

      {/* Vista activa con transición fluida GSAP */}
      <main ref={mainContainerRef} className="flex-1 flex flex-col">
        {view === 'form' ? (
          evaluationMode === 'simple' ? (
            <SimpleEvaluationForm onOpenAdmin={handleOpenAdmin} />
          ) : (
            <EvaluationForm onOpenAdmin={handleOpenAdmin} />
          )
        ) : (
          <AdminDashboard
            onBack={handleBackToForm}
            currentUser={currentUser || 'Auditor Calidad'}
            onLogout={handleLogout}
          />
        )}
      </main>

      {/* Modal de Autenticación */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={handleCloseAuthModal}
        onSuccess={handleAuthSuccess}
      />
    </div>
  );
}

export default App;
