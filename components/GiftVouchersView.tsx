
import React, { useState, useMemo } from 'react';
import { GiftVoucher, Seller, Store } from '../types';
import { formatCOP, toTitleCase } from '../constants';
import { SearchIcon, HistoryIcon, UsersIcon, CalendarIcon, CheckIcon, CrossIcon, TagIcon, FilterIcon } from './Icons';

interface GiftVouchersViewProps {
  vouchers: GiftVoucher[];
  sellers: Seller[];
  stores: Store[];
  currentUser: Seller;
  onUpdateVoucherStatus: (voucherId: string, status: 'active' | 'redeemed' | 'cancelled') => Promise<void>;
}

const GiftVouchersView: React.FC<GiftVouchersViewProps> = ({ vouchers, sellers, stores, currentUser, onUpdateVoucherStatus }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'redeemed' | 'cancelled'>('all');

  const filteredVouchers = useMemo(() => {
    return vouchers.filter(v => {
      const matchesSearch = 
        v.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (v.customerName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (v.customerPhone || '').includes(searchTerm);
      
      const matchesStatus = statusFilter === 'all' || v.status === statusFilter;

      return matchesSearch && matchesStatus;
    }).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [vouchers, searchTerm, statusFilter]);

  const stats = useMemo(() => {
    const active = vouchers.filter(v => v.status === 'active');
    return {
      totalActive: active.length,
      totalValue: active.reduce((sum, v) => sum + v.currentValue, 0),
      redeemedCount: vouchers.filter(v => v.status === 'redeemed').length
    };
  }, [vouchers]);

  const getDaysSinceCreation = (dateStr: string) => {
    const created = new Date(dateStr);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - created.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-fade-in px-4 sm:px-0">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white dark:bg-secondary p-6 rounded-2xl shadow-lg border-b-8 border-pink-500">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-pink-100 dark:bg-pink-900/30 rounded-2xl text-pink-600 shadow-inner">
            <TagIcon className="w-10 h-10" />
          </div>
          <div>
            <h2 className="text-3xl font-black text-gray-800 dark:text-white tracking-tight uppercase">Administración de Bonos</h2>
            <p className="text-sm font-black text-pink-500 uppercase tracking-widest mt-1">Gestión y Seguimiento de Gift Cards</p>
          </div>
        </div>
        
        <div className="grid grid-cols-3 gap-4 w-full md:w-auto">
          <div className="bg-pink-50 dark:bg-pink-900/10 p-3 rounded-xl border border-pink-100 dark:border-pink-800/30 text-center">
            <p className="text-[10px] font-black text-pink-400 uppercase">Activos</p>
            <p className="text-xl font-black text-pink-600">{stats.totalActive}</p>
          </div>
          <div className="bg-green-50 dark:bg-green-900/10 p-3 rounded-xl border border-green-100 dark:border-green-800/30 text-center">
            <p className="text-[10px] font-black text-green-400 uppercase">Redimidos</p>
            <p className="text-xl font-black text-green-600">{stats.redeemedCount}</p>
          </div>
          <div className="bg-blue-50 dark:bg-blue-900/10 p-3 rounded-xl border border-blue-100 dark:border-blue-800/30 text-center">
            <p className="text-[10px] font-black text-blue-400 uppercase">Saldo Total</p>
            <p className="text-xl font-black text-blue-600">{formatCOP(stats.totalValue)}</p>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-secondary p-4 rounded-2xl shadow-md border border-slate-200 dark:border-slate-800">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-grow relative">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar por código, cliente o teléfono..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-3 bg-slate-100 dark:bg-slate-800 border-none rounded-xl focus:ring-2 focus:ring-pink-500 font-medium"
            />
          </div>
          <div className="flex gap-2">
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value as any)}
              className="bg-slate-100 dark:bg-slate-800 px-4 py-3 rounded-xl font-bold text-xs uppercase outline-none focus:ring-2 focus:ring-pink-500"
            >
              <option value="all">Todos los Estados</option>
              <option value="active">Activos</option>
              <option value="redeemed">Redimidos</option>
              <option value="cancelled">Cancelados</option>
            </select>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-secondary rounded-2xl shadow-xl overflow-hidden border border-slate-200 dark:border-slate-800">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/50 border-b dark:border-slate-700">
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Bono / Código</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Cliente</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Valor</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Info / Creado por</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Estado</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y dark:divide-slate-800">
              {filteredVouchers.map(voucher => {
                const days = getDaysSinceCreation(voucher.createdAt);
                const store = stores.find(s => s.id === voucher.storeId);
                
                return (
                  <tr key={voucher.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-pink-100 dark:bg-pink-900/30 rounded-lg flex items-center justify-center text-pink-600">
                          <TagIcon className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="font-black text-slate-800 dark:text-white">{voucher.code}</p>
                          <p className="text-[10px] font-bold text-slate-400 uppercase flex items-center gap-1">
                            <CalendarIcon className="w-3 h-3" /> {new Date(voucher.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <p className="font-bold text-slate-700 dark:text-slate-200">{toTitleCase(voucher.customerName || 'Cliente Mostrador')}</p>
                      <p className="text-xs text-slate-400">{voucher.customerPhone || 'N/A'}</p>
                    </td>
                    <td className="px-6 py-4">
                      <p className="font-black text-pink-600">{formatCOP(voucher.currentValue)}</p>
                      {voucher.initialValue !== voucher.currentValue && (
                        <p className="text-[10px] text-slate-400 line-through">Inicial: {formatCOP(voucher.initialValue)}</p>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="space-y-1">
                        <p className="text-xs font-bold text-slate-600 dark:text-slate-400 flex items-center gap-1">
                          <UsersIcon className="w-3 h-3" /> {voucher.createdBy}
                        </p>
                        <p className="text-[10px] font-black text-accent uppercase tracking-tighter">
                          {store?.name || 'Sede Desconocida'}
                        </p>
                        <p className="text-[10px] font-bold text-slate-400 italic">
                          Hace {days} {days === 1 ? 'día' : 'días'}
                        </p>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
                        voucher.status === 'active' ? 'bg-green-100 text-green-600 dark:bg-green-900/30' :
                        voucher.status === 'redeemed' ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/30' :
                        'bg-slate-100 text-slate-600 dark:bg-slate-900/30'
                      }`}>
                        {voucher.status === 'active' ? 'Activo' : 
                         voucher.status === 'redeemed' ? 'Redimido' : 'Cancelado'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-all">
                        {voucher.status === 'active' && (
                          <>
                            <button 
                              onClick={() => onUpdateVoucherStatus(voucher.id, 'redeemed')}
                              className="p-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-600 hover:text-white transition-all"
                              title="Marcar como Redimido"
                            >
                              <CheckIcon className="w-5 h-5" />
                            </button>
                            <button 
                              onClick={() => onUpdateVoucherStatus(voucher.id, 'cancelled')}
                              className="p-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-600 hover:text-white transition-all"
                              title="Cancelar Bono"
                            >
                              <CrossIcon className="w-5 h-5" />
                            </button>
                          </>
                        )}
                        {voucher.status !== 'active' && (
                          <button 
                            onClick={() => onUpdateVoucherStatus(voucher.id, 'active')}
                            className="p-2 bg-slate-100 text-slate-600 rounded-lg hover:bg-pink-500 hover:text-white transition-all"
                            title="Reactivar Bono"
                          >
                            <HistoryIcon className="w-5 h-5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filteredVouchers.length === 0 && (
            <div className="py-20 text-center space-y-4">
              <TagIcon className="w-16 h-16 mx-auto text-slate-200" />
              <p className="text-slate-400 font-bold italic">No se encontraron bonos con los filtros aplicados.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default GiftVouchersView;
