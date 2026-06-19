import { useState } from 'react';
import { Edit2, Plus, Save, Trash2, X } from 'lucide-react';
import { Avatar, SportBadge } from './ui';

const emptyForm = { name: '', email: '', phone: '', paid: false, paymentMethod: '' };

function ParticipantPanel({ deleteParticipant, isAdmin, participants, updateParticipants }) {
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [activeView, setActiveView] = useState('list');

  const submitParticipant = (event) => {
    event.preventDefault();
    if (!form.name.trim()) return;

    if (editingId) {
      updateParticipants(
        participants.map((participant) =>
          participant.id === editingId ? { ...participant, ...form, name: form.name.trim() } : participant
        )
      );
    } else {
      updateParticipants([...participants, { ...form, name: form.name.trim() }]);
    }

    setForm(emptyForm);
    setEditingId(null);
    setActiveView('list');
  };

  const editParticipant = (participant) => {
    setEditingId(participant.id);
    setActiveView('form');
    setForm({
      name: participant.name,
      email: participant.email,
      phone: participant.phone,
      paid: Boolean(participant.paid),
      paymentMethod: participant.paymentMethod ?? ''
    });
  };

  const updatePayment = (participantId, changes) => {
    updateParticipants(
      participants.map((participant) =>
        participant.id === participantId ? { ...participant, ...changes } : participant
      )
    );
  };

  const removeParticipant = (participant) => {
    if (!window.confirm('¿Seguro que deseas eliminar este participante?')) return;
    console.log('Eliminando participante', participant.id);
    deleteParticipant(participant.id);
  };

  return (
    <section className="participants-page stack-list">
      <div className="panel participant-tabs-panel">
        <div className="panel-heading">
          <div>
            <h3>Gestión de participantes</h3>
            <p className="muted">Consulta pagos, edita datos o crea un participante desde una pestaña separada.</p>
          </div>
          <span className="counter">{participants.length}</span>
        </div>
        <div className="tab-strip">
          <button
            className={activeView === 'list' ? 'tab-button active' : 'tab-button'}
            onClick={() => setActiveView('list')}
            type="button"
          >
            Participantes
          </button>
          <button
            className={activeView === 'form' ? 'tab-button active' : 'tab-button'}
            onClick={() => setActiveView('form')}
            type="button"
          >
            {editingId ? 'Editar participante' : 'Crear participante'}
          </button>
        </div>
      </div>

      {activeView === 'form' && (
      <form className="panel participant-form-panel" onSubmit={submitParticipant}>
        <div className="panel-heading">
          <h3>{editingId ? 'Editar participante' : 'Crear participante'}</h3>
          {editingId && (
            <button
              className="icon-button"
              onClick={() => {
                setEditingId(null);
                setForm(emptyForm);
                setActiveView('list');
              }}
              type="button"
              title="Cancelar"
            >
              <X size={18} />
            </button>
          )}
        </div>
        <label>
          Nombre
          <input
            disabled={!isAdmin}
            onChange={(event) => setForm({ ...form, name: event.target.value })}
            placeholder="Nombre completo"
            required
            value={form.name}
          />
        </label>
        <label>
          Correo opcional
          <input
            disabled={!isAdmin}
            onChange={(event) => setForm({ ...form, email: event.target.value })}
            placeholder="correo@ejemplo.com"
            type="email"
            value={form.email}
          />
        </label>
        <label>
          Telefono opcional
          <input
            disabled={!isAdmin}
            onChange={(event) => setForm({ ...form, phone: event.target.value })}
            placeholder="3001234567"
            value={form.phone}
          />
        </label>
        <div className="form-grid">
          <label className="checkbox-label">
            <input
              checked={form.paid}
              disabled={!isAdmin}
              onChange={(event) => setForm({ ...form, paid: event.target.checked })}
              type="checkbox"
            />
            Pago confirmado
          </label>
          <label>
            Medio de pago
            <select
              disabled={!isAdmin || !form.paid}
              onChange={(event) => setForm({ ...form, paymentMethod: event.target.value })}
              value={form.paymentMethod}
            >
              <option value="">Sin definir</option>
              <option value="efectivo">Efectivo</option>
              <option value="Nequi">Nequi</option>
              <option value="otro">Otro</option>
            </select>
          </label>
        </div>
        <button className="primary-button" disabled={!isAdmin} type="submit">
          {editingId ? <Save size={18} /> : <Plus size={18} />}
          {editingId ? 'Guardar' : 'Crear'}
        </button>
        {!isAdmin && <p className="muted">Entra como administrador para crear, editar o eliminar participantes.</p>}
      </form>
      )}

      {activeView === 'list' && (
      <div className="panel participants-list-panel">
        <div className="panel-heading">
          <h3>Participantes</h3>
          <span className="counter">{participants.length}</span>
        </div>
        <div className="participants-list-grid">
          {participants.map((participant) => (
            <article className="list-item participant-card" key={participant.id ?? participant.name}>
              <Avatar name={participant.name} variant="ball" />
              <div>
                <strong>{participant.name}</strong>
                <span>{participant.email || 'Sin correo'}</span>
                <span>{participant.phone || 'Sin telefono'}</span>
                <SportBadge tone={participant.paid ? 'green' : 'warning'}>
                  {participant.paid ? `🟢 Pagado · ${participant.paymentMethod || 'medio sin definir'}` : '🟡 Pendiente'}
                </SportBadge>
              </div>
              <div className="row-actions">
                <button
                  className={participant.paid ? 'payment-toggle paid' : 'payment-toggle pending'}
                  disabled={!isAdmin || !participant.id}
                  aria-label={participant.paid ? 'Marcar pago como pendiente' : 'Marcar pago como pagado'}
                  onClick={() =>
                    updatePayment(participant.id, {
                      paid: !participant.paid,
                      paymentMethod: participant.paid ? '' : participant.paymentMethod || 'Nequi'
                    })
                  }
                  type="button"
                >
                  {participant.paid ? 'Pagado' : 'Pendiente'}
                </button>
                <button
                  className="icon-button"
                  disabled={!isAdmin || !participant.id}
                  onClick={() => editParticipant(participant)}
                  type="button"
                  title="Editar participante"
                >
                  <Edit2 size={18} />
                </button>
                <button
                  className="icon-button danger"
                  disabled={!isAdmin || !participant.id}
                  onClick={() => removeParticipant(participant)}
                  type="button"
                  title="Eliminar participante"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            </article>
          ))}
        </div>
      </div>
      )}
    </section>
  );
}

export default ParticipantPanel;
