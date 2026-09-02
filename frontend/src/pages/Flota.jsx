import { useState, useEffect, useCallback } from 'react';
import axios from '../api';
import DialogoForm, { mensajeError } from '../components/DialogoForm';
import {
  Bus, Plus, ShieldCheck,
  Wrench, AlertCircle, Search, RefreshCw, Edit, Trash2,
} from 'lucide-react';

const ESTADOS = {
  DISPONIBLE:     { badge: 'ok',      label: 'Disponible',     Icon: ShieldCheck },
  EN_SERVICIO:    { badge: 'info',    label: 'En servicio',    Icon: Bus },
  MANTENIMIENTO:  { badge: 'warn',    label: 'Mantenimiento',  Icon: Wrench },
  FUERA_SERVICIO: { badge: 'danger',  label: 'Fuera servicio', Icon: AlertCircle },
};

export default function Flota() {
  const [buses, setBuses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [busqueda, setBusqueda] = useState('');

  const [dialogo, setDialogo] = useState(null);   // null | 'crear' | {id}
  const [form, setForm] = useState({});
  const [guardando, setGuardando] = useState(false);
  const [dlgError, setDlgError] = useState(null);

  const fetchBuses = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await axios.get('/api/flota/buses/');
      setBuses(res.data);
    } catch (err) {
      console.error(err);
      setError('No se pudo cargar la flota.');
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchBuses(); }, [fetchBuses]);

  const FORM_VACIO = {
    numero: '', patente: '', modelo: '', kilometraje: 0,
    servicio: 'SC', estado: 'DISPONIBLE', pozo: '',
  };

  const abrirCrear = () => { setForm(FORM_VACIO); setDlgError(null); setDialogo('crear'); };
  const abrirEditar = bus => {
    setForm({ ...bus, pozo: bus.pozo ?? '' });
    setDlgError(null);
    setDialogo({ id: bus.id });
  };
  const cerrar = () => { setDialogo(null); setDlgError(null); };

  const guardar = async () => {
    setGuardando(true);
    setDlgError(null);
    try {
      if (dialogo === 'crear') {
        await axios.post('/api/flota/buses/', form);
      } else {
        await axios.put(`/api/flota/buses/${dialogo.id}/`, form);
      }
      cerrar();
      await fetchBuses();
    } catch (err) {
      setDlgError(mensajeError(err, 'No se pudo guardar el bus.'));
    }
    setGuardando(false);
  };

  const eliminar = async bus => {
    if (!window.confirm(`¿Eliminar ${bus.numero}? La acción no se puede deshacer.`)) return;
    try {
      await axios.delete(`/api/flota/buses/${bus.id}/`);
      await fetchBuses();
    } catch (err) {
      alert(mensajeError(err, 'No se pudo eliminar el bus.'));
    }
  };

  const filtrados = buses.filter(b => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return true;
    return (
      b.numero.toLowerCase().includes(q) ||
      b.patente.toLowerCase().includes(q) ||
      b.modelo.toLowerCase().includes(q)
    );
  });

  const disponibles   = buses.filter(b => b.estado === 'DISPONIBLE').length;
  const mantenimiento = buses.filter(b => b.estado === 'MANTENIMIENTO').length;

  return (
    <>
      <div className="page-header">
        <div className="page-heading">
          <h1 className="page-title">Gestión de Flota</h1>
          <p className="page-subtitle">Inventario de buses y mantenimiento</p>
        </div>
        <div className="page-actions">
          <button className="btn btn-primary" onClick={abrirCrear}><Plus size={15} /> Ingresar bus</button>
        </div>
      </div>

      <div className="kpi-row">
        <div className="kpi-card">
          <span className="kpi-icon-wrap info"><Bus size={18} /></span>
          <div className="kpi-body">
            <div className="kpi-value">{loading || error ? '—' : buses.length}</div>
            <div className="kpi-label">Total flota</div>
          </div>
        </div>
        <div className="kpi-card">
          <span className="kpi-icon-wrap ok"><ShieldCheck size={18} /></span>
          <div className="kpi-body">
            <div className="kpi-value">{loading || error ? '—' : disponibles}</div>
            <div className="kpi-label">Disponibles</div>
          </div>
        </div>
        <div className="kpi-card">
          <span className="kpi-icon-wrap warn"><Wrench size={18} /></span>
          <div className="kpi-body">
            <div className="kpi-value">{loading || error ? '—' : mantenimiento}</div>
            <div className="kpi-label">En mantenimiento</div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <span className="card-title">Listado maestro</span>
          <div className="search-box">
            <Search size={15} className="search-icon" />
            <input
              type="text"
              placeholder="Buscar bus, patente o modelo…"
              value={busqueda}
              onChange={e => setBusqueda(e.target.value)}
              aria-label="Buscar en la flota"
            />
          </div>
        </div>

        <div className="card-body" style={{ padding: 0 }}>
          {loading && (
            <div className="p-5 flex flex-col gap-3">
              {[0, 1, 2, 3].map(i => (
                <div key={i} className="skeleton" style={{ height: 44 }} />
              ))}
            </div>
          )}

          {!loading && error && (
            <div className="empty-state">
              <span className="empty-icon"><AlertCircle size={36} strokeWidth={1.5} /></span>
              <div className="empty-title">{error}</div>
              <p className="empty-sub">Revisa que el servidor de Django esté corriendo.</p>
              <button className="btn btn-secondary mt-4" onClick={fetchBuses}>
                <RefreshCw size={15} /> Reintentar
              </button>
            </div>
          )}

          {!loading && !error && filtrados.length === 0 && (
            <div className="empty-state">
              <span className="empty-icon"><Bus size={36} strokeWidth={1.5} /></span>
              <div className="empty-title">Sin resultados</div>
              <p className="empty-sub">
                {busqueda ? 'Ningún bus coincide con la búsqueda.' : 'Aún no hay buses registrados.'}
              </p>
            </div>
          )}

          {!loading && !error && filtrados.length > 0 && (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Nº interno</th>
                    <th>Patente</th>
                    <th>Modelo</th>
                    <th>Kilometraje</th>
                    <th>Servicio</th>
                    <th>Estado</th>
                    <th>Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {filtrados.map(bus => {
                    const est = ESTADOS[bus.estado] ?? { badge: 'neutral', label: bus.estado, Icon: Bus };
                    const { Icon } = est;
                    return (
                      <tr key={bus.id}>
                        <td data-label="Nº interno">
                          <div className="flex items-center gap-3">
                            <span className={`kpi-icon-wrap ${est.badge}`} style={{ width: 32, height: 32 }}>
                              <Icon size={16} />
                            </span>
                            <span className="td-bus-num">{bus.numero}</span>
                          </div>
                        </td>
                        <td data-label="Patente"><span className="td-bus-plate">{bus.patente}</span></td>
                        <td data-label="Modelo">{bus.modelo}</td>
                        <td data-label="Kilometraje">{bus.kilometraje.toLocaleString('es-CL')} km</td>
                        <td data-label="Servicio"><span className="tag">{bus.servicio}</span></td>
                        <td data-label="Estado">
                          <span className={`badge ${est.badge}`}>
                            <span className={`badge-dot ${est.badge}`} />{est.label}
                          </span>
                        </td>
                        <td data-label="Acción">
                          <div className="flex gap-2 justify-center">
                            <button
                              className="btn-icon" title="Editar"
                              aria-label={`Editar ${bus.numero}`}
                              onClick={() => abrirEditar(bus)}
                            >
                              <Edit size={15} />
                            </button>
                            <button
                              className="btn-icon" title="Eliminar"
                              aria-label={`Eliminar ${bus.numero}`}
                              style={{ color: 'var(--danger)' }}
                              onClick={() => eliminar(bus)}
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <DialogoForm
        abierto={Boolean(dialogo)}
        titulo={dialogo === 'crear' ? 'Ingresar bus' : 'Editar bus'}
        onCerrar={cerrar}
        onGuardar={guardar}
        guardando={guardando}
        error={dlgError}
        disabled={!form.numero || !form.patente || !form.modelo}
      >
        <div className="grid-2">
          <div className="form-group">
            <label className="form-label" htmlFor="bus-num">Nº interno</label>
            <input
              id="bus-num" type="text" className="form-input" required
              value={form.numero ?? ''}
              onChange={e => setForm({ ...form, numero: e.target.value })}
              placeholder="BUS 110"
            />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="bus-pat">Patente</label>
            <input
              id="bus-pat" type="text" className="form-input mono" required
              value={form.patente ?? ''}
              onChange={e => setForm({ ...form, patente: e.target.value.toUpperCase() })}
              placeholder="BCLK45"
            />
          </div>
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="bus-mod">Modelo</label>
          <input
            id="bus-mod" type="text" className="form-input" required
            value={form.modelo ?? ''}
            onChange={e => setForm({ ...form, modelo: e.target.value })}
            placeholder="Volvo 9800"
          />
        </div>

        <div className="grid-2">
          <div className="form-group">
            <label className="form-label" htmlFor="bus-km">Kilometraje</label>
            <input
              id="bus-km" type="number" min="0" className="form-input"
              value={form.kilometraje ?? 0}
              onChange={e => setForm({ ...form, kilometraje: e.target.value })}
            />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="bus-serv">Servicio</label>
            <select
              id="bus-serv" className="form-input form-select"
              value={form.servicio ?? 'SC'}
              onChange={e => setForm({ ...form, servicio: e.target.value })}
            >
              <option value="SC">Semi Cama</option>
              <option value="SLC">Salón Cama</option>
              <option value="CP">Cama Premium</option>
              <option value="MIN">Minero</option>
            </select>
          </div>
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="bus-est">Estado</label>
          <select
            id="bus-est" className="form-input form-select"
            value={form.estado ?? 'DISPONIBLE'}
            onChange={e => setForm({ ...form, estado: e.target.value })}
          >
            {Object.entries(ESTADOS).map(([v, e]) => (
              <option key={v} value={v}>{e.label}</option>
            ))}
          </select>
        </div>
      </DialogoForm>
    </>
  );
}
