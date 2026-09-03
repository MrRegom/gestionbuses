import { useState, useEffect, useCallback } from 'react';
import axios from '../api';
import DialogoForm, { mensajeError } from '../components/DialogoForm';
import { useAuth } from '../context/AuthContext';
import { hace } from '../utils/formato';
import {
  SlidersHorizontal, Route, ClipboardList, Plus, Edit, Trash2,
  AlertCircle, RefreshCw, Check, Save, Eye, EyeOff, MapPin, Info,
} from 'lucide-react';

/**
 * Configuración del sistema.
 *
 * Todo lo que aquí se edita vivía antes escrito en el código: la
 * dotación de cada servicio, el tope de horas al volante, las rutas con
 * su duración y los ítems del checklist. Cambiar cualquiera de esas
 * cosas exigía un programador y un despliegue, y ninguna es una
 * decisión de ingeniería.
 */
const TABS = [
  { id: 'parametros', label: 'Reglas', Icon: SlidersHorizontal },
  { id: 'rutas', label: 'Rutas y ciudades', Icon: Route },
  { id: 'checklist', label: 'Checklist', Icon: ClipboardList },
];

export default function Configuracion() {
  const [tab, setTab] = useState('parametros');

  return (
    <>
      <div className="page-header">
        <div className="page-heading">
          <h1 className="page-title">Configuración</h1>
          <p className="page-subtitle">
            Las reglas con las que opera el sistema, sin tocar código
          </p>
        </div>
      </div>

      <div className="card mb-4">
        <div className="tabs">
          {TABS.map(({ id, label, Icon }) => (
            <button
              key={id}
              className={`tab ${tab === id ? 'active' : ''}`}
              onClick={() => setTab(id)}
            >
              <Icon size={15} style={{ verticalAlign: '-2px', marginRight: 6 }} />
              {label}
            </button>
          ))}
        </div>
      </div>

      {tab === 'parametros' && <PanelReglas />}
      {tab === 'rutas' && <PanelRutas />}
      {tab === 'checklist' && <PanelChecklist />}
    </>
  );
}

/* ═══════════════════════════════════════════════════════════
   REGLAS · dotación y tope de horas
   ═══════════════════════════════════════════════════════════ */
function PanelReglas() {
  const { recargar } = useAuth();
  const [form, setForm] = useState(null);
  const [guardado, setGuardado] = useState(null);
  const [error, setError] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [aviso, setAviso] = useState(null);

  const cargar = useCallback(async () => {
    setError(null);
    try {
      const { data } = await axios.get('/api/operaciones/parametros/');
      setForm(data);
      setGuardado(data);
    } catch {
      setError('No se pudieron cargar las reglas.');
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const guardar = async () => {
    setGuardando(true);
    setError(null);
    setAviso(null);
    try {
      const { data } = await axios.put('/api/operaciones/parametros/', form);
      setForm(data);
      setGuardado(data);
      setAviso('Reglas guardadas. Se aplican de inmediato a toda la operación.');
      // La sesión lleva las reglas: sin recargarla, las pantallas
      // seguirían midiendo contra los valores anteriores.
      await recargar();
    } catch (err) {
      setError(mensajeError(err, 'No se pudieron guardar las reglas.'));
    }
    setGuardando(false);
  };

  if (error && !form) return <Fallo texto={error} onReintentar={cargar} />;
  if (!form) return <div className="skeleton" style={{ height: 300 }} />;

  const cambiado = JSON.stringify(form) !== JSON.stringify(guardado);
  const total = Number(form.conductores_por_servicio) +
    Number(form.asistentes_por_servicio);

  return (
    <div className="stack">
      <div className="card">
        <div className="card-header">
          <span className="card-title">Dotación de cada servicio</span>
        </div>
        <div className="card-body">
          <p className="empty-sub mb-4">
            Cuánta gente lleva un servicio. El sistema no deja salir una
            postura sin esta dotación completa, y tampoco deja asignar a
            nadie de más.
          </p>
          <div className="grid-2">
            <Campo
              label="Conductores" id="cfg-cond" min={1}
              valor={form.conductores_por_servicio}
              onChange={v => setForm({ ...form, conductores_por_servicio: v })}
            />
            <Campo
              label="Asistentes" id="cfg-asist" min={0}
              valor={form.asistentes_por_servicio}
              onChange={v => setForm({ ...form, asistentes_por_servicio: v })}
            />
          </div>
          <div className="info-box mt-4">
            Cada servicio va con <strong>{total}</strong>{' '}
            {total === 1 ? 'persona' : 'personas'} a bordo.
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <span className="card-title">Control de fatiga</span>
        </div>
        <div className="card-body">
          <p className="empty-sub mb-4">
            El máximo de horas continuas al volante. Al alcanzarlo, el
            conductor queda en rojo y el sistema no lo deja tomar servicio;
            el aviso lo pone en amarillo antes, para alcanzar a mover a
            alguien.
          </p>
          <div className="grid-2">
            <Campo
              label="Máximo de horas continuas" id="cfg-max"
              valor={form.horas_conduccion_max} paso="0.5" min={0.5}
              onChange={v => setForm({ ...form, horas_conduccion_max: v })}
            />
            <Campo
              label="Avisar a partir de" id="cfg-aviso"
              valor={form.horas_conduccion_aviso} paso="0.5" min={0}
              onChange={v => setForm({ ...form, horas_conduccion_aviso: v })}
            />
          </div>
          <div className="notice info mt-4">
            <span className="notice-icon"><Info size={16} /></span>
            <div className="notice-content">
              <div className="notice-desc">
                Un viaje más largo que este tope obliga a que los conductores
                se releven: por eso van más de uno. Si cambias el tope,
                revisa también la dotación.
              </div>
            </div>
          </div>
        </div>
        <div className="card-footer flex items-center gap-3">
          <button className="btn btn-primary" onClick={guardar}
                  disabled={guardando || !cambiado}>
            {guardando ? <><span className="spinner" /> Guardando…</>
                       : <><Save size={15} /> Guardar reglas</>}
          </button>
          {guardado.actualizado_en && (
            <span className="empty-sub">
              Último cambio {hace(guardado.actualizado_en)}
              {guardado.actualizado_por_nombre
                ? ` por ${guardado.actualizado_por_nombre}` : ''}
            </span>
          )}
        </div>
      </div>

      {error && <Notice tono="danger" texto={error} />}
      {aviso && <Notice tono="ok" texto={aviso} />}
    </div>
  );
}

function Campo({ label, id, valor, onChange, paso = '1', min = 0 }) {
  return (
    <div className="form-group">
      <label className="form-label" htmlFor={id}>{label}</label>
      <input
        id={id} type="number" className="form-input"
        step={paso} min={min}
        value={valor}
        onChange={e => onChange(e.target.value)}
      />
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   RUTAS Y CIUDADES
   ═══════════════════════════════════════════════════════════ */
const RUTA_VACIA = { origen_id: '', destino_id: '', duracion_estimada: '' };

function PanelRutas() {
  const [ciudades, setCiudades] = useState([]);
  const [rutas, setRutas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);

  const [dlgRuta, setDlgRuta] = useState(null);   // null | 'crear' | {id}
  const [formRuta, setFormRuta] = useState(RUTA_VACIA);
  const [dlgCiudad, setDlgCiudad] = useState(false);
  const [nombreCiudad, setNombreCiudad] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [dlgError, setDlgError] = useState(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      const [c, r] = await Promise.all([
        axios.get('/api/operaciones/ciudades/'),
        axios.get('/api/operaciones/rutas/'),
      ]);
      setCiudades(c.data);
      setRutas(r.data);
    } catch {
      setError('No se pudo cargar el catálogo.');
    }
    setCargando(false);
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const guardarRuta = async () => {
    setGuardando(true);
    setDlgError(null);
    try {
      if (dlgRuta === 'crear') {
        await axios.post('/api/operaciones/rutas/crear/', formRuta);
      } else {
        await axios.put(`/api/operaciones/rutas/${dlgRuta.id}/`, formRuta);
      }
      setDlgRuta(null);
      await cargar();
    } catch (err) {
      setDlgError(mensajeError(err, 'No se pudo guardar la ruta.'));
    }
    setGuardando(false);
  };

  const guardarCiudad = async () => {
    setGuardando(true);
    setDlgError(null);
    try {
      await axios.post('/api/operaciones/ciudades/', { nombre: nombreCiudad });
      setDlgCiudad(false);
      setNombreCiudad('');
      await cargar();
    } catch (err) {
      setDlgError(mensajeError(err, 'No se pudo guardar la ciudad.'));
    }
    setGuardando(false);
  };

  const borrar = async (url, confirmacion) => {
    if (!window.confirm(confirmacion)) return;
    try {
      await axios.delete(url);
      await cargar();
    } catch (err) {
      alert(mensajeError(err, 'No se pudo eliminar.'));
    }
  };

  if (cargando) return <div className="skeleton" style={{ height: 320 }} />;
  if (error) return <Fallo texto={error} onReintentar={cargar} />;

  return (
    <div className="stack">
      <div className="card">
        <div className="card-header">
          <span className="card-title">Rutas</span>
          <button className="btn btn-primary btn-sm ml-auto"
                  onClick={() => { setFormRuta(RUTA_VACIA); setDlgError(null); setDlgRuta('crear'); }}>
            <Plus size={14} /> Nueva ruta
          </button>
        </div>
        <div className="card-body" style={{ padding: 0 }}>
          <p className="empty-sub p-3">
            La duración es el dato con el que el sistema decide si dos
            servicios se pisan y hasta cuándo queda ocupada una máquina o
            su tripulación. Un viaje de 32 horas bloquea a su gente por
            más de un día.
          </p>
          {rutas.length === 0 ? (
            <Vacio icono={Route} titulo="Sin rutas cargadas"
                   sub="Agrega las que opera la empresa." />
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Origen</th>
                    <th>Destino</th>
                    <th>Duración</th>
                    <th>Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {rutas.map(r => (
                    <tr key={r.id}>
                      <td data-label="Origen">{r.origen.nombre}</td>
                      <td data-label="Destino">
                        <span className="td-ruta-main">{r.destino.nombre}</span>
                      </td>
                      <td data-label="Duración">
                        <span className="mono">
                          {parseFloat(r.duracion_estimada)} h
                        </span>
                      </td>
                      <td data-label="Acción">
                        <div className="flex gap-2 justify-center">
                          <button className="btn-icon" title="Editar"
                                  aria-label={`Editar ruta ${r.origen.nombre} a ${r.destino.nombre}`}
                                  onClick={() => {
                                    setFormRuta({
                                      origen_id: r.origen.id,
                                      destino_id: r.destino.id,
                                      duracion_estimada: r.duracion_estimada,
                                    });
                                    setDlgError(null);
                                    setDlgRuta({ id: r.id });
                                  }}>
                            <Edit size={15} />
                          </button>
                          <button className="btn-icon" title="Eliminar"
                                  aria-label={`Eliminar ruta ${r.origen.nombre} a ${r.destino.nombre}`}
                                  style={{ color: 'var(--danger)' }}
                                  onClick={() => borrar(
                                    `/api/operaciones/rutas/${r.id}/`,
                                    `¿Eliminar la ruta ${r.origen.nombre} → ${r.destino.nombre}?`)}>
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <span className="card-title">Ciudades</span>
          <button className="btn btn-secondary btn-sm ml-auto"
                  onClick={() => { setNombreCiudad(''); setDlgError(null); setDlgCiudad(true); }}>
            <Plus size={14} /> Nueva ciudad
          </button>
        </div>
        <div className="card-body">
          {ciudades.length === 0 ? (
            <Vacio icono={MapPin} titulo="Sin ciudades" sub="Agrega los destinos." />
          ) : (
            <div className="flex flex-wrap gap-2">
              {ciudades.map(c => (
                <span className="tag" key={c.id}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  {c.nombre}
                  <button className="btn-icon" style={{ width: 20, height: 20, color: 'var(--danger)' }}
                          title={`Eliminar ${c.nombre}`}
                          aria-label={`Eliminar ${c.nombre}`}
                          onClick={() => borrar(
                            `/api/operaciones/ciudades/${c.id}/`,
                            `¿Eliminar ${c.nombre}?`)}>
                    <Trash2 size={12} />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      <DialogoForm
        abierto={Boolean(dlgRuta)}
        titulo={dlgRuta === 'crear' ? 'Nueva ruta' : 'Editar ruta'}
        onCerrar={() => setDlgRuta(null)}
        onGuardar={guardarRuta}
        guardando={guardando}
        error={dlgError}
        disabled={!formRuta.origen_id || !formRuta.destino_id || !formRuta.duracion_estimada}
      >
        <div className="grid-2">
          <div className="form-group">
            <label className="form-label" htmlFor="ruta-origen">Origen</label>
            <select id="ruta-origen" className="form-input form-select"
                    value={formRuta.origen_id}
                    onChange={e => setFormRuta({ ...formRuta, origen_id: e.target.value })}>
              <option value="">Elige…</option>
              {ciudades.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="ruta-destino">Destino</label>
            <select id="ruta-destino" className="form-input form-select"
                    value={formRuta.destino_id}
                    onChange={e => setFormRuta({ ...formRuta, destino_id: e.target.value })}>
              <option value="">Elige…</option>
              {ciudades.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
          </div>
        </div>
        <div className="form-group">
          <label className="form-label" htmlFor="ruta-dur">Duración estimada (horas)</label>
          <input id="ruta-dur" type="number" className="form-input"
                 step="0.5" min="0.5" placeholder="32"
                 value={formRuta.duracion_estimada}
                 onChange={e => setFormRuta({ ...formRuta, duracion_estimada: e.target.value })} />
        </div>
      </DialogoForm>

      <DialogoForm
        abierto={dlgCiudad} titulo="Nueva ciudad"
        onCerrar={() => setDlgCiudad(false)}
        onGuardar={guardarCiudad}
        guardando={guardando}
        error={dlgError}
        disabled={!nombreCiudad.trim()}
      >
        <div className="form-group">
          <label className="form-label" htmlFor="ciudad-nom">Nombre</label>
          <input id="ciudad-nom" type="text" className="form-input"
                 placeholder="Arica" value={nombreCiudad}
                 onChange={e => setNombreCiudad(e.target.value)} />
        </div>
      </DialogoForm>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   CHECKLIST · la plantilla que responde la tripulación
   ═══════════════════════════════════════════════════════════ */
function PanelChecklist() {
  const [categorias, setCategorias] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);

  const [dlg, setDlg] = useState(null);   // {tipo, modo, datos}
  const [form, setForm] = useState({});
  const [guardando, setGuardando] = useState(false);
  const [dlgError, setDlgError] = useState(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      const { data } = await axios.get('/api/mantencion/plantilla/');
      setCategorias(data);
    } catch {
      setError('No se pudo cargar la plantilla.');
    }
    setCargando(false);
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const abrir = (tipo, modo, datos = {}) => {
    setForm(datos);
    setDlgError(null);
    setDlg({ tipo, modo });
  };

  const guardar = async () => {
    setGuardando(true);
    setDlgError(null);
    const { tipo, modo } = dlg;
    try {
      if (tipo === 'categoria') {
        if (modo === 'crear') await axios.post('/api/mantencion/plantilla/', form);
        else await axios.put(`/api/mantencion/plantilla/categorias/${form.id}/`, form);
      } else if (modo === 'crear') {
        await axios.post('/api/mantencion/plantilla/items/', form);
      } else {
        await axios.put(`/api/mantencion/plantilla/items/${form.id}/`, form);
      }
      setDlg(null);
      await cargar();
    } catch (err) {
      setDlgError(mensajeError(err, 'No se pudo guardar.'));
    }
    setGuardando(false);
  };

  const alternar = async (item) => {
    try {
      await axios.put(`/api/mantencion/plantilla/items/${item.id}/`,
                      { activo: !item.activo });
      await cargar();
    } catch (err) {
      alert(mensajeError(err, 'No se pudo cambiar el ítem.'));
    }
  };

  const borrar = async (url, confirmacion) => {
    if (!window.confirm(confirmacion)) return;
    try {
      await axios.delete(url);
      await cargar();
    } catch (err) {
      alert(mensajeError(err, 'No se pudo eliminar.'));
    }
  };

  if (cargando) return <div className="skeleton" style={{ height: 360 }} />;
  if (error) return <Fallo texto={error} onReintentar={cargar} />;

  const activos = categorias.flatMap(c => c.items).filter(i => i.activo).length;
  const criticos = categorias.flatMap(c => c.items)
    .filter(i => i.activo && i.critico).length;

  return (
    <div className="stack">
      <div className="notice info">
        <span className="notice-icon"><Info size={16} /></span>
        <div className="notice-content">
          <div className="notice-title">
            {activos} ítems se piden hoy, {criticos} de ellos críticos
          </div>
          <div className="notice-desc">
            Un ítem <strong>crítico</strong> que falla deja el bus fuera de
            servicio de inmediato; el resto lo manda a mantenimiento. Lo que
            ya se respondió alguna vez no se puede borrar: se desactiva, y
            así deja de pedirse sin tocar las revisiones antiguas.
          </div>
        </div>
        <button className="btn btn-primary btn-sm ml-auto"
                onClick={() => abrir('categoria', 'crear', { nombre: '', orden: 0, activa: true })}>
          <Plus size={14} /> Categoría
        </button>
      </div>

      {categorias.map(cat => (
        <div className="card" key={cat.id}>
          <div className="card-header">
            <span className="card-title">{cat.nombre}</span>
            {!cat.activa && <span className="badge neutral">Desactivada</span>}
            <div className="flex gap-2 ml-auto">
              <button className="btn btn-ghost btn-sm"
                      onClick={() => abrir('item', 'crear',
                        { categoria_id: cat.id, descripcion: '', orden: 0, critico: false, activo: true })}>
                <Plus size={14} /> Ítem
              </button>
              <button className="btn-icon" title="Editar categoría"
                      aria-label={`Editar ${cat.nombre}`}
                      onClick={() => abrir('categoria', 'editar', { ...cat })}>
                <Edit size={15} />
              </button>
              <button className="btn-icon" title="Eliminar categoría"
                      aria-label={`Eliminar ${cat.nombre}`}
                      style={{ color: 'var(--danger)' }}
                      onClick={() => borrar(
                        `/api/mantencion/plantilla/categorias/${cat.id}/`,
                        `¿Eliminar la categoría ${cat.nombre} y sus ítems?`)}>
                <Trash2 size={15} />
              </button>
            </div>
          </div>
          <div className="card-body" style={{ padding: 0 }}>
            {cat.items.length === 0 ? (
              <Vacio icono={ClipboardList} titulo="Sin ítems"
                     sub="Agrega lo que hay que revisar en esta categoría." />
            ) : cat.items.map(item => (
              <div className="chk-item" key={item.id}
                   style={{ opacity: item.activo ? 1 : 0.55 }}>
                <div className="chk-item-head">
                  <span className="chk-item-label">
                    {item.descripcion}
                    {item.critico && <span className="chk-critico">Crítico</span>}
                    {!item.activo && <span className="tag ml-auto">No se pide</span>}
                  </span>
                  <div className="flex gap-2">
                    <button className="btn-icon"
                            title={item.activo ? 'Dejar de pedirlo' : 'Volver a pedirlo'}
                            aria-label={`${item.activo ? 'Desactivar' : 'Activar'} ${item.descripcion}`}
                            onClick={() => alternar(item)}>
                      {item.activo ? <Eye size={15} /> : <EyeOff size={15} />}
                    </button>
                    <button className="btn-icon" title="Editar"
                            aria-label={`Editar ${item.descripcion}`}
                            onClick={() => abrir('item', 'editar', { ...item })}>
                      <Edit size={15} />
                    </button>
                    <button className="btn-icon" title="Eliminar"
                            aria-label={`Eliminar ${item.descripcion}`}
                            style={{ color: 'var(--danger)' }}
                            onClick={() => borrar(
                              `/api/mantencion/plantilla/items/${item.id}/`,
                              `¿Eliminar "${item.descripcion}"?`)}>
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      <DialogoForm
        abierto={Boolean(dlg)}
        titulo={dlg?.tipo === 'categoria'
          ? (dlg.modo === 'crear' ? 'Nueva categoría' : 'Editar categoría')
          : (dlg?.modo === 'crear' ? 'Nuevo ítem' : 'Editar ítem')}
        onCerrar={() => setDlg(null)}
        onGuardar={guardar}
        guardando={guardando}
        error={dlgError}
        disabled={dlg?.tipo === 'categoria'
          ? !form.nombre?.trim()
          : !form.descripcion?.trim()}
      >
        {dlg?.tipo === 'categoria' ? (
          <>
            <div className="form-group">
              <label className="form-label" htmlFor="cat-nom">Nombre</label>
              <input id="cat-nom" type="text" className="form-input"
                     placeholder="Motor y Mecánica"
                     value={form.nombre ?? ''}
                     onChange={e => setForm({ ...form, nombre: e.target.value })} />
            </div>
            <div className="grid-2">
              <div className="form-group">
                <label className="form-label" htmlFor="cat-orden">Orden</label>
                <input id="cat-orden" type="number" className="form-input" min="0"
                       value={form.orden ?? 0}
                       onChange={e => setForm({ ...form, orden: e.target.value })} />
              </div>
              <Interruptor
                id="cat-activa" label="Se pide en el checklist"
                valor={form.activa ?? true}
                onChange={v => setForm({ ...form, activa: v })}
              />
            </div>
          </>
        ) : (
          <>
            <div className="form-group">
              <label className="form-label" htmlFor="item-desc">Qué se revisa</label>
              <input id="item-desc" type="text" className="form-input"
                     placeholder="Nivel de aceite motor"
                     value={form.descripcion ?? ''}
                     onChange={e => setForm({ ...form, descripcion: e.target.value })} />
            </div>
            <div className="grid-2">
              <div className="form-group">
                <label className="form-label" htmlFor="item-orden">Orden</label>
                <input id="item-orden" type="number" className="form-input" min="0"
                       value={form.orden ?? 0}
                       onChange={e => setForm({ ...form, orden: e.target.value })} />
              </div>
              <Interruptor
                id="item-activo" label="Se pide en el checklist"
                valor={form.activo ?? true}
                onChange={v => setForm({ ...form, activo: v })}
              />
            </div>
            <Interruptor
              id="item-critico"
              label="Crítico — si falla, el bus queda fuera de servicio"
              valor={form.critico ?? false}
              onChange={v => setForm({ ...form, critico: v })}
            />
          </>
        )}
      </DialogoForm>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   Piezas compartidas
   ═══════════════════════════════════════════════════════════ */
function Interruptor({ id, label, valor, onChange }) {
  return (
    <div className="form-group">
      <label className="form-label" htmlFor={id}>{label}</label>
      <button
        id={id} type="button"
        className={`btn ${valor ? 'btn-ok' : 'btn-secondary'} w-full`}
        aria-pressed={valor}
        onClick={() => onChange(!valor)}
      >
        {valor ? <><Check size={15} /> Sí</> : 'No'}
      </button>
    </div>
  );
}

function Vacio({ icono: Icono, titulo, sub }) {
  return (
    <div className="empty-state" style={{ padding: 'var(--sp-8) var(--sp-4)' }}>
      <span className="empty-icon"><Icono size={30} strokeWidth={1.5} /></span>
      <div className="empty-title">{titulo}</div>
      <p className="empty-sub">{sub}</p>
    </div>
  );
}

function Notice({ tono, texto }) {
  return (
    <div className={`notice ${tono}`}>
      <span className="notice-icon">
        {tono === 'ok' ? <Check size={16} /> : <AlertCircle size={16} />}
      </span>
      <div className="notice-content"><div className="notice-desc">{texto}</div></div>
    </div>
  );
}

function Fallo({ texto, onReintentar }) {
  return (
    <div className="card">
      <div className="empty-state">
        <span className="empty-icon"><AlertCircle size={36} strokeWidth={1.5} /></span>
        <div className="empty-title">{texto}</div>
        <button className="btn btn-secondary mt-4" onClick={onReintentar}>
          <RefreshCw size={15} /> Reintentar
        </button>
      </div>
    </div>
  );
}
