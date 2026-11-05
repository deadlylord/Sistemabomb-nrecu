import { useViewFilter } from '../services/viewFilters';


import React, { useState, useMemo, useEffect } from 'react';
import { Layaway, PaymentMethod, Seller, Role, Product, Store } from '../types';
import { formatCOP, normalizeText } from '../constants';
import { SearchIcon, TrashIcon, CrossIcon, EditIcon } from './Icons';
import { isTenantAdministrator, resolveTenantRole } from '../services/tenantIdentity';
import EditLayawayModal from './EditLayawayModal';
import { getLayawayTiming } from '../services/layawayTiming';

interface LayawayViewProps {
  readOnly?: boolean;
  layaways: Layaway[];
  sellers: Seller[];
  inventory: Product[];
  onAddPayment: (layawayId: string, amount: number, method: PaymentMethod, seller: string) => void;
  onFulfillPreOrder: (layawayId: string) => void;
  onDeleteLayaway: (layawayId: string) => void;
  onUpdateLayaway: (updatedLayaway: Layaway, originalLayaway: Layaway) => void;
  currentUser: Seller;
  roles: Role[];
  stores: Store[];
}

const LayawayCard: React.FC<{
  readOnly?: boolean;
  layout: 'list' | 'grid';
  now: Date;
  layaway: Layaway, 
  sellers: Seller[], 
  inventory: Product[],
  onAddPayment: (layawayId: string, amount: number, method: PaymentMethod, seller: string) => void, 
  onFulfillPreOrder: (layawayId: string) => void;
  onDeleteLayaway: (layawayId: string) => void;
  onUpdateLayaway: (updatedLayaway: Layaway, originalLayaway: Layaway) => void;
  canManage: boolean;
}> = ({ readOnly = false, layout, now, layaway, sellers, inventory, onAddPayment, onFulfillPreOrder, onDeleteLayaway, onUpdateLayaway, canManage }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isFulfilling, setIsFulfilling] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | ''>('');
  const [paymentSeller, setPaymentSeller] = useState<string>('');

  const isAdmin = !readOnly && canManage;

  const balance = layaway.totalAmount - layaway.paidAmount;
  const progress = layaway.totalAmount > 0 ? Math.min(100, Math.max(0, (layaway.paidAmount / layaway.totalAmount) * 100)) : 0;
  const timing = getLayawayTiming(layaway, now);
  const isPending = layaway.status === 'active' || layaway.status === 'pre-order';

  const handleAddPayment = () => {
    const amount = parseFloat(paymentAmount);
    if (isNaN(amount) || amount <= 0) {
      alert("Por favor, ingresa un monto válido.");
      return;
    }
    if (!paymentMethod) {
      alert("Por favor, selecciona un método de pago.");
      return;
    }
    if (!paymentSeller) {
      alert("Por favor, selecciona un vendedor.");
      return;
    }
    onAddPayment(layaway.id, amount, paymentMethod, paymentSeller);
    setIsPaymentModalOpen(false);
    setPaymentAmount('');
    setPaymentMethod('');
    setPaymentSeller('');
  }

  const statusClasses = {
    active: 'bg-blue-500/20 text-blue-300',
    completed: 'bg-green-500/20 text-green-300',
    cancelled: 'bg-red-500/20 text-red-300',
    'pre-order': 'bg-yellow-500/20 text-yellow-300',
  };

  const statusTexts = {
    active: 'ACTIVO',
    completed: 'COMPLETADO',
    cancelled: 'CANCELADO',
    'pre-order': 'POR TRAER',
  }

  return (
    <>
      <div className="min-w-0 bg-gray-100 dark:bg-gray-800 rounded-lg p-3 transition-all duration-300">
        <button type="button" aria-expanded={isExpanded} aria-label={`Ver detalle del apartado ${layaway.invoiceNumber}`} className={`w-full text-left flex gap-3 ${layout === 'grid' ? 'flex-col' : 'flex-col sm:flex-row sm:items-center'} justify-between`} onClick={() => setIsExpanded(!isExpanded)}>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`px-2 py-1 text-xs font-bold rounded-full ${statusClasses[layaway.status]}`}>{statusTexts[layaway.status]}</span>
              <h3 className="font-bold text-base break-words text-gray-900 dark:text-white">{layaway.customerName}</h3>
            </div>
             <p className="text-sm text-gray-500 dark:text-text-dark">{layaway.customerPhone} | Fact: #{layaway.invoiceNumber}</p>
          </div>
        </button>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-sm">
          <p className="text-gray-600 dark:text-gray-300"><span data-testid="layaway-age" title={timing.explanation} className={`font-bold ${timing.isOverdue ? 'text-red-600 dark:text-red-400' : 'text-accent'}`}>{timing.ageLabel}</span> {timing.sinceLabel}</p>
          <p className="font-semibold">{isPending ? 'Saldo pendiente' : 'Saldo'}: <span className="text-accent">{formatCOP(balance)}</span></p>
        </div>
        {layout === 'grid' && (
          <div className="mt-2 text-sm space-y-1">
            <ul className="space-y-1 text-gray-600 dark:text-gray-300">
              {layaway.items.slice(0, 2).map(item => <li key={item.id} className="break-words">{item.quantity} × {item.name}</li>)}
            </ul>
            {layaway.items.length > 2 && <p className="text-xs text-gray-500">+{layaway.items.length - 2} productos en el detalle</p>}
            {layaway.status === 'pre-order' && layaway.description && <p className="text-xs text-gray-600 dark:text-gray-300 line-clamp-2 break-words">Por traer: {layaway.description}</p>}
          </div>
        )}
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
          <button type="button" className="text-xs font-semibold text-accent" aria-expanded={isExpanded} onClick={() => setIsExpanded(!isExpanded)}>{isExpanded ? 'Ocultar detalle' : 'Ver detalle'}</button>
          <div className="flex items-center gap-1">
            {isAdmin && (
                <button
                  type="button"
                  aria-label="Editar apartado"
                  onClick={() => setIsEditModalOpen(true)}
                  className="bg-blue-500/10 text-blue-500 font-semibold inline-flex items-center gap-1 px-2 py-1.5 text-xs rounded-lg hover:bg-blue-500/20 transition-colors"
                  title="Editar Abono"
                >
                    <EditIcon className="w-4 h-4" /> Editar
                </button>
            )}
            {isAdmin && (
                <button
                  type="button"
                  aria-label="Eliminar apartado"
                  onClick={() => onDeleteLayaway(layaway.id)}
                  className="bg-red-500/10 text-red-500 font-semibold inline-flex items-center gap-1 px-2 py-1.5 text-xs rounded-lg hover:bg-red-500/20 transition-colors"
                  title="Eliminar Abono Permanentemente"
                >
                    <TrashIcon className="w-4 h-4" /> Eliminar
                </button>
            )}
          </div>
        </div>
        {isExpanded && (
           <div className="mt-3 pt-3 border-t border-gray-300 dark:border-gray-700">
              <div className="mb-3 text-sm space-y-1">
                <p className="text-gray-500 dark:text-text-dark">Apartado el {timing.createdLabel}</p>
                <p>Total: <strong>{formatCOP(layaway.totalAmount)}</strong> · Abonado: <strong>{formatCOP(layaway.paidAmount)}</strong></p>
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
                  <div className="bg-accent h-1.5 rounded-full" style={{ width: `${progress}%` }}></div>
                </div>
              </div>
              {layaway.status === 'pre-order' && layaway.description && (
                  <div className="mb-4 p-3 bg-yellow-500/10 rounded-lg">
                      <h4 className="font-bold text-yellow-400 mb-1">Descripción del Pedido</h4>
                      <p className="text-sm whitespace-pre-wrap">{layaway.description}</p>
                  </div>
              )}
              <h4 className="font-bold text-accent mb-2">Productos</h4>
              <ul className="list-disc list-inside text-sm space-y-1 mb-4">
                  {layaway.items.map(item => (
                      <li key={item.id}>
                        {item.name} <span className="text-gray-400 text-xs">({item.supplier || 'N/A'})</span> (x{item.quantity}) - { formatCOP(item.price * item.quantity) }
                      </li>
                  ))}
              </ul>
              <h4 className="font-bold text-accent mb-2">Historial de Pagos</h4>
              {layaway.payments.length > 0 ? (
                <ul className="list-disc list-inside text-sm space-y-1">
                  {layaway.payments.map((p, i) => (
                    <li key={i}>{new Date(p.date).toLocaleString()}: <span className="font-semibold">{formatCOP(p.amount)}</span> ({p.method}) - Vendedor: {p.seller}</li>
                  ))}
                </ul>
              ) : <p className="text-sm text-gray-500 dark:text-text-dark">No hay pagos registrados.</p>}
               <div className="mt-4 flex flex-wrap justify-end gap-2">
                  {!readOnly && layaway.status === 'pre-order' && (
                      <button 
                        onClick={async () => {
                          if (isFulfilling) return;
                          setIsFulfilling(true);
                          try {
                            await onFulfillPreOrder(layaway.id);
                          } finally {
                            setIsFulfilling(false);
                          }
                        }} 
                        disabled={isFulfilling}
                        className="bg-green-500 text-white font-bold py-2 px-4 rounded-lg hover:bg-green-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                          {isFulfilling ? 'Procesando...' : 'Marcar Recibido'}
                      </button>
                  )}
                  {!readOnly && (layaway.status === 'active' || layaway.status === 'pre-order') && balance > 0 && (
                      <button onClick={() => setIsPaymentModalOpen(true)} className="bg-accent text-white font-bold py-2 px-4 rounded-lg hover:bg-accent-hover transition-colors">
                          Registrar Abono
                      </button>
                  )}
               </div>
           </div>
        )}
      </div>

      {/* Payment Modal */}
      {isPaymentModalOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-secondary rounded-lg shadow-xl p-6 w-full max-w-sm">
                <h3 className="text-xl font-bold text-accent mb-4">Registrar Abono para {layaway.customerName}</h3>
                <p className="text-gray-500 dark:text-text-dark mb-4">Saldo pendiente: <span className="font-bold">{formatCOP(balance)}</span></p>
                <div className="space-y-4">
                    <div>
                        <label htmlFor="paymentAmount" className="block text-sm font-medium text-gray-500 dark:text-text-dark mb-1">Monto a Abonar</label>
                        <input
                            type="number"
                            id="paymentAmount"
                            value={paymentAmount}
                            onChange={e => setPaymentAmount(e.target.value)}
                            className="w-full bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-md p-2 focus:ring-2 focus:ring-accent focus:border-accent outline-none"
                            placeholder="0"
                            min="0"
                            step="1000"
                            required
                        />
                    </div>
                     <div>
                        {/* FIX: Corrected a closing </e-l> tag to </label> to fix a JSX parsing error. */}
                        <label htmlFor="paymentSeller" className="block text-sm font-medium text-gray-500 dark:text-text-dark mb-1">Vendedor</label>
                        <select
                            id="paymentSeller"
                            value={paymentSeller}
                            onChange={e => setPaymentSeller(e.target.value)}
                            className="w-full bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-md p-2"
                            required
                        >
                            <option value="" disabled>Selecciona un vendedor</option>
                            {sellers.filter(seller => !seller.isDisabled).map(seller => <option key={seller.id} value={seller.name}>{seller.name}</option>)}
                        </select>
                    </div>
                    <div>
                        <label htmlFor="paymentMethod" className="block text-sm font-medium text-gray-500 dark:text-text-dark mb-1">Método de Pago</label>
                        <select
                            id="paymentMethod"
                            value={paymentMethod}
                            onChange={e => setPaymentMethod(e.target.value as PaymentMethod)}
                            className="w-full bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-md p-2"
                            required
                        >
                            <option value="" disabled>Selecciona un método</option>
                            {Object.values(PaymentMethod).map(method => <option key={method} value={method}>{method}</option>)}
                        </select>
                    </div>
                </div>
                <div className="mt-6 flex justify-end space-x-3">
                    <button type="button" onClick={() => setIsPaymentModalOpen(false)} className="px-4 py-2 bg-gray-200 dark:bg-gray-700 rounded-md">Cancelar</button>
                    <button onClick={handleAddPayment} className="px-4 py-2 bg-accent text-white rounded-md">Confirmar</button>
                </div>
            </div>
        </div>
      )}

      {isEditModalOpen && (
        <EditLayawayModal
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          layaway={layaway}
          sellers={sellers}
          inventory={inventory}
          onUpdateLayaway={onUpdateLayaway}
        />
      )}
    </>
  );
};


export const LayawayView: React.FC<LayawayViewProps> = ({ readOnly = false, layaways, sellers, inventory, onAddPayment, onFulfillPreOrder, onDeleteLayaway, onUpdateLayaway, currentUser, roles, stores = [] }) => {
    const canManage = isTenantAdministrator(resolveTenantRole(currentUser, roles, stores));
    const [searchTerm, setSearchTerm] = useViewFilter('LayawayView:searchTerm', '');
    const [layout, setLayout] = useViewFilter<'list' | 'grid'>('LayawayView:layout', 'grid');
    const [sort, setSort] = useViewFilter<'newest' | 'oldest'>('LayawayView:sort', 'newest');
    const [now, setNow] = useState(() => new Date());
    useEffect(() => {
        const timer = window.setInterval(() => setNow(new Date()), 60_000);
        return () => window.clearInterval(timer);
    }, []);
    const [filter, setFilter] = useViewFilter<Layaway['status'] | 'all'>('LayawayView:filter', 'all');

    const filteredLayaways = useMemo(() => {
        const normalizedSearch = normalizeText(searchTerm);

        return layaways.filter(l => {
            const matchesFilter = filter === 'all' ? true : l.status === filter;

            const matchesSearch = normalizedSearch ?
                normalizeText(l.customerName).includes(normalizedSearch) ||
                l.customerPhone.includes(normalizedSearch) ||
                normalizeText(l.invoiceNumber).includes(normalizedSearch)
                : true;
            return matchesFilter && matchesSearch;
        }).sort((a,b) => {
            const difference = new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
            return sort === 'oldest' ? -difference : difference;
        });
    }, [layaways, searchTerm, filter, sort]);

    const filterOptions: { value: Layaway['status'] | 'all', label: string }[] = [
        { value: 'all', label: 'Todos' },
        { value: 'active', label: 'Activos' },
        { value: 'pre-order', label: 'Por Traer' },
        { value: 'completed', label: 'Completados' },
        { value: 'cancelled', label: 'Cancelados' },
    ];

    return (
        <div className={`${layout === 'grid' ? 'max-w-7xl' : 'max-w-4xl'} mx-auto`}>
            <div className="bg-white dark:bg-secondary p-3 sm:p-6 rounded-xl shadow-lg">
                <h2 className="text-2xl font-bold text-accent mb-6 border-b-2 border-accent/30 pb-2">Apartados y Abonos</h2>
                <div className="flex flex-col xl:flex-row gap-4 mb-4">
                    <div className="relative flex-grow">
                        <input
                            type="text"
                            placeholder="Buscar por cliente, celular o # factura..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="w-full bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-md p-2 pl-10 pr-10 focus:ring-2 focus:ring-accent focus:border-accent outline-none"
                        />
                        <div className="absolute top-0 left-0 inline-flex items-center justify-center h-full w-10 text-gray-400">
                            <SearchIcon />
                        </div>
                        {searchTerm && (
                            <button
                                onClick={() => setSearchTerm('')}
                                className="absolute top-0 right-0 inline-flex items-center justify-center h-full w-10 text-gray-500 hover:text-gray-800 dark:hover:text-white"
                                aria-label="Limpiar búsqueda"
                            >
                                <CrossIcon className="w-5 h-5" />
                            </button>
                        )}
                    </div>
                     <div className="flex-shrink-0 flex items-center gap-2 overflow-x-auto pb-2">
                        {filterOptions.map(opt => (
                            <button
                                key={opt.value}
                                onClick={() => setFilter(opt.value)}
                                className={`px-3 py-1.5 text-sm font-bold rounded-full whitespace-nowrap ${filter === opt.value ? 'bg-accent text-white shadow-accent' : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-text-dark'}`}
                            >
                                {opt.label}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                    <div role="group" aria-label="Vista de apartados" className="flex gap-1 rounded-lg bg-gray-100 dark:bg-gray-800 p-1">
                        {(['grid', 'list'] as const).map(value => <button key={value} type="button" aria-pressed={layout === value} onClick={() => setLayout(value)} className={`rounded-md px-3 py-2 text-sm font-semibold ${layout === value ? 'bg-accent text-white' : 'text-gray-600 dark:text-gray-300'}`}>{value === 'grid' ? 'Cuadrícula' : 'Lista'}</button>)}
                    </div>
                    <label className="text-sm flex flex-wrap items-center gap-2">Ordenar
                        <select value={sort} onChange={event => setSort(event.target.value as 'newest' | 'oldest')} className="rounded-md border border-gray-300 dark:border-gray-700 bg-gray-100 dark:bg-gray-800 p-2">
                            <option value="newest">Más recientes primero</option>
                            <option value="oldest">Más antiguos primero</option>
                        </select>
                    </label>
                </div>
                <div className={layout === 'grid' ? 'grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 items-start' : 'space-y-4'}>
                    {filteredLayaways.length > 0 ? (
                        filteredLayaways.map(layaway => (
                            <LayawayCard
                                key={layaway.id}
                                layout={layout}
                                now={now}
                                readOnly={readOnly}
                                layaway={layaway}
                                sellers={sellers}
                                inventory={inventory}
                                onAddPayment={onAddPayment}
                                onFulfillPreOrder={onFulfillPreOrder}
                                onDeleteLayaway={onDeleteLayaway}
                                onUpdateLayaway={onUpdateLayaway}
                                canManage={canManage}
                            />
                        ))
                    ) : (
                        <p className="text-center text-gray-500 dark:text-text-dark py-8">No se encontraron abonos con los filtros aplicados.</p>
                    )}
                </div>
            </div>
        </div>
    );
};
