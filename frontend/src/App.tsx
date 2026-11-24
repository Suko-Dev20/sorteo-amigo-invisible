import { useEffect, useState } from 'react';
import { BrowserRouter, Route, Routes, useLocation } from 'react-router-dom';
import { api } from './api/client';
import { BurtonBackdrop } from './components/BurtonBackdrop';
import { Navbar } from './components/Navbar';
import { WhatsAppQrModal } from './components/WhatsAppQrModal';
import { DrawDetailPage } from './pages/DrawDetailPage';
import { HomePage } from './pages/HomePage';
import { RevealPage } from './pages/RevealPage';
import type { BaileysStatus, HealthResponse } from './types';

function AppShell() {
  const location = useLocation();
  const isRevealPage = location.pathname.startsWith('/revelar/');

  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [baileys, setBaileys] = useState<BaileysStatus | null>(null);
  const [baileysSupported, setBaileysSupported] = useState(false);
  const [metaConfigured, setMetaConfigured] = useState(false);
  const [snowEnabled, setSnowEnabled] = useState(true);
  const [waModalOpen, setWaModalOpen] = useState(false);

  useEffect(() => {
    if (isRevealPage) return;

    const fetchStatus = async () => {
      try {
        const [h, w] = await Promise.all([api.getHealth(), api.getWhatsAppStatus()]);
        setHealth(h);
        setBaileys(w.baileys);
        setBaileysSupported(Boolean(w.baileysSupported));
        setMetaConfigured(w.metaCloud.configured);
      } catch {
        // Servidor arrancando o sin conexión
      }
    };

    fetchStatus();
    const timer = setInterval(fetchStatus, 15000);
    return () => clearInterval(timer);
  }, [isRevealPage]);

  return (
    <div className="relative min-h-screen">
      <BurtonBackdrop snowEnabled={snowEnabled} />

      <div className="relative z-10">
        {!isRevealPage && (
          <Navbar
            health={health}
            baileys={baileys}
            baileysSupported={baileysSupported}
            snowEnabled={snowEnabled}
            onToggleSnow={() => setSnowEnabled((v) => !v)}
            onOpenWhatsAppModal={() => setWaModalOpen(true)}
          />
        )}

        <main>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route
              path="/sorteos/:id"
              element={
                <DrawDetailPage
                  baileys={baileys}
                  baileysSupported={baileysSupported}
                  metaConfigured={metaConfigured}
                  onOpenWhatsAppModal={() => setWaModalOpen(true)}
                />
              }
            />
            <Route
              path="/panel/:id"
              element={
                <DrawDetailPage
                  baileys={baileys}
                  baileysSupported={baileysSupported}
                  metaConfigured={metaConfigured}
                  onOpenWhatsAppModal={() => setWaModalOpen(true)}
                />
              }
            />
            <Route path="/revelar/:token" element={<RevealPage />} />
          </Routes>
        </main>
      </div>

      {baileysSupported && (
        <WhatsAppQrModal
          open={waModalOpen}
          onClose={() => setWaModalOpen(false)}
          baileys={baileys}
          onStatusChange={setBaileys}
        />
      )}
    </div>
  );
}

export function App() {
  return (
    <BrowserRouter>
      <AppShell />
    </BrowserRouter>
  );
}

export default App;
