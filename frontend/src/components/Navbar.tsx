import { Link } from 'react-router-dom';
import { MessageCircle, Moon, Snowflake } from 'lucide-react';
import type { BaileysStatus, HealthResponse } from '../types';

interface NavbarProps {
  health: HealthResponse | null;
  baileys: BaileysStatus | null;
  baileysSupported: boolean;
  snowEnabled: boolean;
  onToggleSnow: () => void;
  onOpenWhatsAppModal: () => void;
}

export function Navbar({
  health,
  baileys,
  baileysSupported,
  snowEnabled,
  onToggleSnow,
  onOpenWhatsAppModal,
}: NavbarProps) {
  const waConnected = baileys?.state === 'connected';

  return (
    <header className="sticky top-0 z-30 border-b border-[#f2ead7]/15 bg-[#0b0a15]/88 backdrop-blur-md">
      <div className="burton-ribbon h-1 w-full opacity-75" />
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3.5 sm:px-6">
        <Link to="/" className="group flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#e3b25a]/45 bg-gradient-to-br from-[#231b38] via-[#171327] to-[#691326] shadow-lg shadow-black/60 transition group-hover:-rotate-6">
            <Moon className="h-5 w-5 text-[#f3e8c8]" />
          </div>
          <div>
            <span className="font-burton block text-2xl leading-none tracking-wide text-[#f7f0e0]">
              Amigo Invisible
            </span>
            <span className="font-gothic text-[10px] font-semibold uppercase tracking-[0.2em] text-[#e3b25a]/90">
              Noche de Navidad · WhatsApp
            </span>
          </div>
        </Link>

        <div className="flex flex-wrap items-center gap-2">
          {baileysSupported && (
            <button
              type="button"
              onClick={onOpenWhatsAppModal}
              className={`inline-flex cursor-pointer items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium ring-1 transition ${
                waConnected
                  ? 'bg-[#122622]/90 text-[#8de8b8] ring-[#4ade80]/35 hover:bg-[#19352f]'
                  : 'bg-[#19162b]/90 text-[#e7decb] ring-[#f2ead7]/15 hover:bg-[#262140]'
              }`}
            >
              <MessageCircle className="h-3.5 w-3.5" />
              <span>
                {waConnected
                  ? `WhatsApp QR (+${baileys?.phoneNumber || 'OK'})`
                  : 'Conectar WhatsApp QR'}
              </span>
            </button>
          )}

          <button
            type="button"
            onClick={onToggleSnow}
            title={snowEnabled ? 'Desactivar nieve nocturna' : 'Activar nieve nocturna'}
            className={`inline-flex cursor-pointer items-center justify-center rounded-full p-2 ring-1 transition ${
              snowEnabled
                ? 'bg-[#231e3d] text-[#f3e8c8] ring-[#e3b25a]/35'
                : 'bg-white/5 text-stone-400 ring-white/10 hover:text-[#f2ead7]'
            }`}
          >
            <Snowflake className="h-4 w-4" />
          </button>
        </div>
      </div>

      {health && !health.database.connected && (
        <div className="border-t border-[#e3b25a]/30 bg-[#2b151c]/90 px-4 py-2 text-center text-xs text-[#f8e6be]">
          <strong>⚠️ Base de datos sin conexión:</strong> Comprueba el servicio de base de datos.
        </div>
      )}
    </header>
  );
}
