import React, { useState } from 'react';
import { Seller, Store } from '../types';
import { PLATFORM_OWNER_USER_ID, type PlatformDeveloperGrant } from '../services/developerAccess';

interface Props {
  sellers: Seller[];
  stores: Store[];
  grants: PlatformDeveloperGrant[];
  onAssign: (userId: string, active: boolean) => Promise<void>;
  onCreate: (data: { name: string; username: string; password: string; storeId: string }) => Promise<void>;
}
export default function PlatformDevelopersPanel({ sellers, stores, grants, onAssign, onCreate }: Props) {
  const [selectedUser, setSelectedUser] = useState('');
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [form, setForm] = useState({ name: '', username: '', password: '', storeId: '' });
  const activeIds = new Set(grants.filter(grant => grant.active).map(grant => grant.userId));
  const available = sellers.filter(user => user.id !== PLATFORM_OWNER_USER_ID && !user.isDisabled && !activeIds.has(user.id));
  const developers = sellers.filter(user => user.id === PLATFORM_OWNER_USER_ID || activeIds.has(user.id));
  const perform = async (action: () => Promise<void>, success: string) => {
    setBusy(true); setMessage('');
    try { await action(); setMessage(success); }
    catch (error: any) { setMessage(error?.message || 'No se pudo guardar.'); }
    finally { setBusy(false); }
  };
  return <section className="rounded-2xl border border-indigo-300 dark:border-indigo-700 bg-white dark:bg-slate-900 p-5 space-y-4">
    <div>
      <h2 className="text-lg font-black text-indigo-700 dark:text-indigo-300">Developers de plataforma</h2>
      <p className="text-sm text-slate-500">Solo Carlos puede asignar o retirar este rol. Los demás developers no pueden autorizar nuevos developers.</p>
    </div>
    <div className="space-y-2">
      {developers.map(user => <div key={user.id} className="flex items-center justify-between gap-3 rounded-xl bg-slate-100 dark:bg-slate-800 p-3">
        <div><span className="font-bold">{user.name}</span><span className="ml-2 text-xs text-indigo-600 dark:text-indigo-300">{user.id === PLATFORM_OWNER_USER_ID ? 'Propietario · Carlos' : 'Developer'}{user.isDisabled ? ' · Inactivo' : ''}</span></div>
        {user.id !== PLATFORM_OWNER_USER_ID && <button disabled={busy} type="button" className="text-sm font-bold text-red-500 disabled:opacity-50" onClick={() => perform(() => onAssign(user.id, false), 'Acceso Developer retirado.')}>Retirar acceso</button>}
      </div>)}
    </div>
    <form className="flex flex-col sm:flex-row gap-2" onSubmit={event => { event.preventDefault(); if (selectedUser) perform(() => onAssign(selectedUser, true), 'Rol Developer asignado.').then(() => setSelectedUser('')); }}>
      <select aria-label="Usuario para asignar Developer" required value={selectedUser} onChange={event => setSelectedUser(event.target.value)} className="flex-1 min-w-0 rounded-xl border p-3 bg-white dark:bg-slate-800 dark:border-slate-700">
        <option value="">Selecciona un usuario existente</option>
        {available.map(user => <option key={user.id} value={user.id}>{user.name}{user.username ? ` (@${user.username})` : ''} · {stores.find(store => store.id === user.storeId)?.name || 'Sin sede'}</option>)}
      </select>
      <button disabled={busy || !selectedUser} className="rounded-xl bg-indigo-600 px-4 py-3 text-white font-bold disabled:opacity-50">Asignar Developer</button>
      <button disabled={busy} type="button" onClick={() => setCreating(!creating)} className="rounded-xl border border-indigo-400 px-4 py-3 font-bold text-indigo-600 dark:text-indigo-300">Crear usuario Developer</button>
    </form>
    {creating && <form className="grid grid-cols-1 sm:grid-cols-2 gap-3 border-t dark:border-slate-700 pt-4" onSubmit={event => { event.preventDefault(); perform(async () => { await onCreate(form); setForm({ name: '', username: '', password: '', storeId: '' }); setCreating(false); }, 'Usuario Developer creado.'); }}>
      <label className="text-sm font-bold">Nombre<input required value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} className="block w-full rounded-xl border p-3 bg-white dark:bg-slate-800 dark:border-slate-700" /></label>
      <label className="text-sm font-bold">Usuario<input required autoComplete="off" value={form.username} onChange={event => setForm({ ...form, username: event.target.value })} className="block w-full rounded-xl border p-3 bg-white dark:bg-slate-800 dark:border-slate-700" /></label>
      <label className="text-sm font-bold">Contraseña<input required type="password" autoComplete="new-password" value={form.password} onChange={event => setForm({ ...form, password: event.target.value })} className="block w-full rounded-xl border p-3 bg-white dark:bg-slate-800 dark:border-slate-700" /></label>
      <label className="text-sm font-bold">Sede de inicio<select required value={form.storeId} onChange={event => setForm({ ...form, storeId: event.target.value })} className="block w-full rounded-xl border p-3 bg-white dark:bg-slate-800 dark:border-slate-700"><option value="">Selecciona sede</option>{stores.map(store => <option key={store.id} value={store.id}>{store.name}</option>)}</select></label>
      <button disabled={busy} className="rounded-xl bg-indigo-600 px-4 py-3 text-white font-bold disabled:opacity-50">Guardar nuevo Developer</button>
    </form>}
    {message && <p role="status" className="text-sm font-bold text-indigo-700 dark:text-indigo-300">{message}</p>}
  </section>;
}
