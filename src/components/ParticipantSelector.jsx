import { useEffect, useMemo, useRef, useState } from 'react';
import { Search, UserRound } from 'lucide-react';

const normalizeText = (value) =>
  String(value ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();

function ParticipantSelector({ participants, value, onChange }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const selectorRef = useRef(null);
  const selectedParticipant = participants.find((participant) => participant.id === value);
  const filteredParticipants = useMemo(() => {
    const normalizedQuery = normalizeText(query);
    return participants
      .filter((participant) => !normalizedQuery || normalizeText(participant.name).includes(normalizedQuery));
  }, [participants, query]);

  const chooseParticipant = (participantId) => {
    onChange(participantId);
    setOpen(false);
    setQuery('');
  };

  useEffect(() => {
    if (!open) return undefined;

    const closeOnOutsideClick = (event) => {
      if (selectorRef.current && !selectorRef.current.contains(event.target)) {
        setOpen(false);
        setQuery('');
      }
    };
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') {
        setOpen(false);
        setQuery('');
      }
    };

    document.addEventListener('mousedown', closeOnOutsideClick);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('mousedown', closeOnOutsideClick);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [open]);

  if (!participants.length) {
    return (
      <div className="participant-selector disabled">
        <UserRound size={18} />
        Sin participantes
      </div>
    );
  }

  return (
    <div className="participant-selector-wrap" ref={selectorRef}>
      <button className="participant-selector" onClick={() => setOpen((current) => !current)} type="button">
        <UserRound size={18} />
        <span>{selectedParticipant?.name ?? 'Seleccionar participante'}</span>
      </button>
      {open && (
        <div className="participant-selector-menu">
          <label className="participant-search">
            <Search size={16} />
            <input
              autoFocus
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar participante"
              value={query}
            />
          </label>
          <div className="participant-options">
            {filteredParticipants.map((participant) => (
              <button
                className={participant.id === value ? 'active' : ''}
                key={participant.id}
                onClick={() => chooseParticipant(participant.id)}
                type="button"
              >
                {participant.name}
              </button>
            ))}
            {!filteredParticipants.length && <p>No hay coincidencias.</p>}
          </div>
        </div>
      )}
    </div>
  );
}

export default ParticipantSelector;
