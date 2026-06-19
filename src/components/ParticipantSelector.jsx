import { useMemo, useState } from 'react';
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
  const selectedParticipant = participants.find((participant) => participant.id === value);
  const filteredParticipants = useMemo(() => {
    const normalizedQuery = normalizeText(query);
    return participants
      .filter((participant) => !normalizedQuery || normalizeText(participant.name).includes(normalizedQuery))
      .slice(0, 8);
  }, [participants, query]);

  const chooseParticipant = (participantId) => {
    onChange(participantId);
    setOpen(false);
    setQuery('');
  };

  if (!participants.length) {
    return (
      <div className="participant-selector disabled">
        <UserRound size={18} />
        Sin participantes
      </div>
    );
  }

  return (
    <div className="participant-selector-wrap">
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
