import { useSession } from '../context/SessionContext';

export function PunishmentFlash() {
  const { state } = useSession();
  const { punishmentFlash } = state;

  if (!punishmentFlash) return null;

  const isShock = punishmentFlash.type === 'shock';
  const isWarning = punishmentFlash.isWarning;

  return (
    <div className={`punishment-flash ${isShock ? 'shock' : ''} ${isWarning ? 'warning' : ''}`}>
      <div className="punishment-flash-text">
        {isWarning ? 'WARNING' : punishmentFlash.type.toUpperCase()}
      </div>
    </div>
  );
}
