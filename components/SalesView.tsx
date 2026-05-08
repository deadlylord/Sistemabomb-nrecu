
import React, { useState, useMemo } from 'react';
import { Sale, Seller, Product, Role, Category, CartItem, PaymentMethod, Payment } from '../types';
import { SearchIcon, EditIcon, TrashIcon, ChevronDownIcon, PrintIcon, CrossIcon, ChevronLeftIcon, ChevronRightIcon } from './Icons';
import { formatCOP, COMMISSION_RATES, normalizeText } from '../constants';
// FIX: Changed to a named import for EditSaleModal to resolve module loading error.
import { EditSaleModal } from './EditSaleModal';

interface SalesViewProps {
  sales: Sale[];
  sellers: Seller[];
  inventory: Product[];
  categories: Category[];
  onUpdateSale: (updatedSale: Sale, originalSale: Sale) => void;
  onDeleteSale: (saleId: string) => void;
  onReprintSale: (sale: Sale) => void;
  currentUser: Seller;
  roles: Role[];
}

const toYYYYMMDD = (date: Date) => {
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const SalesView: React.FC<SalesViewProps> = ({ sales, sellers, inventory, categories, onUpdateSale, onDeleteSale, onReprintSale, currentUser, roles }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [sellerFilter, setSellerFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [startDate, setStartDate] = useState(toYYYYMMDD(new Date()));
  const [endDate, setEndDate] = useState(toYYYYMMDD(new Date()));
  const [editingSale, setEditingSale] = useState<Sale | null>(null);
  const [expandedSaleId, setExpandedSaleId] = useState<string | null>(null);
  const [isSummaryExpanded, setIsSummaryExpanded] = useState(true);

  const adminRole = useMemo(() => roles.find(r => r.name === 'Administrator'), [roles]);
  const isAdmin = useMemo(() => currentUser.roleId === adminRole?.id, [currentUser, adminRole]);
  
  const setDateRange = (start: Date, end: Date) => {
    setStartDate(toYYYYMMDD(start));
    setEndDate(toYYYYMMDD(end));
  };
  const setToday = () => setDateRange(new Date(), new Date());
  const setYesterday = () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    setDateRange(yesterday, yesterday);
  };
  const setLast7Days = () => {
      const end = new Date();
      const start = new Date();
      start.setDate(end.getDate() - 6);
      setDateRange(start, end);
  };
  const setThisMonth = () => {
      const end = new Date();
      const start = new Date(end.getFullYear(), end.getMonth(), 1);
      setDateRange(start, end);
  };
  const handlePreviousDay = () => {
    const currentDate = new Date(startDate + 'T12:00:00');
    currentDate.setDate(currentDate.getDate() - 1);
    setDateRange(currentDate, currentDate);
  };
  const handleNextDay = () => {
    const currentDate = new Date(endDate + 'T12:00:00');
    currentDate.setDate(currentDate.getDate() + 1);
    setDateRange(currentDate, currentDate);
  };
  const isNextDayDisabled = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const currentSelectionEnd = new Date(endDate + 'T12:00:00');
    currentSelectionEnd.setHours(0, 0, 0, 0);
    return currentSelectionEnd >= today;
  }, [endDate]);


  const sortedSales = useMemo(() => {
    return [...sales].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [sales]);

  const filteredSales = useMemo(() => {
    return sortedSales.filter(sale => {
      const saleDate = new Date(sale.createdAt);
      const normalizedSearch = normalizeText(searchTerm);
      // FIX: Explicitly cast to CartItem[] to handle cases where `sale.items` might be an object from Firebase.
      const itemsArray: CartItem[] = (Array.isArray(sale.items) ? sale.items : Object.values(sale.items || {}) as any[]).filter(Boolean) as CartItem[];

      const matchesSearch =
        sale.invoiceNumber.toString().includes(searchTerm) ||
        // FIX: Add guards for potentially missing properties from Firestore data to prevent runtime errors.
        normalizeText(sale.customerName || '').includes(normalizedSearch) ||
        (sale.customerPhone || '').includes(searchTerm) ||
        // FIX: Explicitly type the 'item' parameter to ensure correct type inference within the callback, resolving a 'type unknown' error.
        itemsArray.some((item: CartItem) =>
            item && (
                normalizeText(item.name).includes(normalizedSearch) ||
                (item.supplier && normalizeText(item.supplier).includes(normalizedSearch))
            )
        );
      
      const matchesSeller = sellerFilter ? sale.seller === sellerFilter : true;

      const matchesCategory = categoryFilter
        // FIX: Explicitly type the 'item' parameter to ensure correct type inference within the callback, resolving a potential 'type unknown' error.
        ? itemsArray.some((item: CartItem) => item && item.categoryId === categoryFilter)
        : true;

      const start = startDate ? new Date(startDate + 'T00:00:00') : null;
      const end = endDate ? new Date(endDate + 'T23:59:59') : null;
      const matchesStartDate = start ? saleDate >= start : true;
      const matchesEndDate = end ? saleDate <= end : true;

      return matchesSearch && matchesSeller && matchesStartDate && matchesEndDate && matchesCategory;
    });
  }, [sortedSales, searchTerm, sellerFilter, startDate, endDate, categoryFilter]);

  const categorySummary = useMemo(() => {
    const summary = new Map<string, { categoryId: string, categoryName: string, units: number, total: number }>();
    const categoryMap = new Map(categories.map(c => [c.id, c.name]));

    filteredSales.forEach(sale => {
        const itemsArray: CartItem[] = (Array.isArray(sale.items) ? sale.items : Object.values(sale.items || {}) as any[]).filter(Boolean) as CartItem[];
        for (const item of itemsArray) {
            const categoryId = item.categoryId;
            // FIX: Explicitly cast categoryName to string to resolve TypeScript error.
            const categoryName = (categoryMap.get(categoryId) || 'Sin Categoría') as string;
            const existing = summary.get(categoryId);
            
            if (existing) {
                existing.units += item.quantity;
                existing.total += item.price * item.quantity;
            } else {
                summary.set(categoryId, {
                    categoryId: categoryId,
                    categoryName: categoryName,
                    units: item.quantity,
                    total: item.price * item.quantity,
                });
            }
        }
    });

    return Array.from(summary.values()).sort((a, b) => b.total - a.total);
  }, [filteredSales, categories]);

  const calculateSaleProfit = (sale: Sale): number => {
    if (!sale?.items) return 0;
    
    const itemsArray: CartItem[] = (Array.isArray(sale.items) ? sale.items : Object.values(sale.items || {}) as any[]).filter(Boolean) as CartItem[];
    
    const rawProfit = itemsArray.reduce((profit, item: CartItem) => {
      if (!item || item.cost === undefined) return profit;
      const itemProfit = (item.price - item.cost) * item.quantity;
      return profit + itemProfit;
    }, 0);

    let totalCommission = 0;
    // FIX: Handle cases where sale.payments is an object from Firebase instead of an array.
    // @FIX: Switched to a for...of loop to ensure correct type inference for payment objects from Firestore. This resolves an error where 'payment' was treated as 'unknown'.
    const paymentsArray: Payment[] = (Array.isArray(sale.payments) ? sale.payments : Object.values(sale.payments || {}) as any[]).filter(Boolean) as Payment[];
    if (paymentsArray && paymentsArray.length > 0) {
      for (const payment of paymentsArray) {
        const rate = COMMISSION_RATES[payment.method as PaymentMethod];
        if (rate) {
          totalCommission += payment.amount * rate;
        }
      }
    } else if (sale.paymentMethod) { // Legacy support for single payment method
      const rate = COMMISSION_RATES[sale.paymentMethod as PaymentMethod];
      if (rate) {
        totalCommission += sale.totalAmount * rate;
      }
    }

    return rawProfit - totalCommission;
  };
  
  const renderPaymentMethods = (sale: Sale) => {
    // FIX: Handle cases where sale.payments is an object from Firebase instead of an array.
    const paymentsArray: Payment[] = (Array.isArray(sale.payments) ? sale.payments : Object.values(sale.payments || {}) as any[]).filter(Boolean) as Payment[];
    // FIX: Explicitly type `methods` as `string[]` to ensure type safety. `Object.values` can infer `unknown[]`, causing errors when `method` is used as a key.
    const methods: string[] = (paymentsArray && paymentsArray.length > 0
      ? [...new Set(paymentsArray.map((p: Payment) => String(p.method)))]
      : (sale.paymentMethod ? [String(sale.paymentMethod)] : []));

    if (methods.length === 0) {
      return <span className="text-gray-500 dark:text-text-dark text-xs">N/A</span>;
    }

    return (
      <div className="flex flex-wrap gap-1 justify-start">
        {methods.map((method: string) => (
          <span key={method} className="px-2 py-1 text-xs font-semibold rounded-full bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-text-light whitespace-nowrap">
            {method}
          </span>
        ))}
      </div>
    );
  };
  
  return (
    <>
      <div className="max-w-7xl mx-auto">
        <div className="bg-white dark:bg-secondary p-6 rounded-xl shadow-lg">
          <h2 className="text-2xl font-bold text-accent mb-6 border-b-2 border-accent/30 pb-2">Operaciones de Venta</h2>
          
          <div className="bg-gray-100 dark:bg-gray-800 p-4 rounded-lg mb-6 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="relative lg:col-span-1">
                <input
                  type="text"
                  placeholder="Buscar por # Factura, cliente, etc..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="w-full bg-white dark:bg-primary border border-gray-300 dark:border-gray-700 rounded-md p-2 pl-10 pr-10 focus:ring-2 focus:ring-accent focus:border-accent outline-none"
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
              <select
                value={sellerFilter}
                onChange={e => setSellerFilter(e.target.value)}
                className="w-full bg-white dark:bg-primary border border-gray-300 dark:border-gray-700 rounded-md p-2 focus:ring-2 focus:ring-accent focus:border-accent outline-none"
              >
                <option value="">Todos los vendedores</option>
                {sellers.filter(s => !s.isDisabled).map(seller => (
                  <option key={seller.id} value={seller.name}>{seller.name}</option>
                ))}
              </select>
               <select
                value={categoryFilter}
                onChange={e => setCategoryFilter(e.target.value)}
                className="w-full bg-white dark:bg-primary border border-gray-300 dark:border-gray-700 rounded-md p-2 focus:ring-2 focus:ring-accent focus:border-accent outline-none"
              >
                <option value="">Todas las categorías</option>
                {categories.map(category => (
                  <option key={category.id} value={category.id}>{category.name}</option>
                ))}
              </select>
            </div>
             <div className="flex flex-wrap items-center justify-between gap-x-8 gap-y-4">
                <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-gray-500 dark:text-text-dark mr-2">Filtros Rápidos:</span>
                    <button onClick={setToday} className="px-3 py-1 text-sm bg-accent/20 text-accent rounded-full hover:bg-accent/30 transition-colors">Hoy</button>
                    <button onClick={setYesterday} className="px-3 py-1 text-sm bg-accent/20 text-accent rounded-full hover:bg-accent/30 transition-colors">Ayer</button>
                    <button onClick={setLast7Days} className="px-3 py-1 text-sm bg-accent/20 text-accent rounded-full hover:bg-accent/30 transition-colors">Últimos 7 días</button>
                    <button onClick={setThisMonth} className="px-3 py-1 text-sm bg-accent/20 text-accent rounded-full hover:bg-accent/30 transition-colors">Este Mes</button>
                </div>
                
                <div className="flex items-end gap-2 flex-wrap">
                    <button
                        onClick={handlePreviousDay}
                        className="p-2 rounded-md bg-white dark:bg-primary border border-gray-300 dark:border-gray-700 hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        aria-label="Día anterior"
                    >
                        <ChevronLeftIcon className="w-5 h-5" />
                    </button>
                    <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="bg-white dark:bg-primary p-2 rounded-md border border-gray-300 dark:border-gray-700 h-10"/>
                    <span className="text-gray-500">a</span>
                    <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="bg-white dark:bg-primary p-2 rounded-md border border-gray-300 dark:border-gray-700 h-10"/>
                    <button
                        onClick={handleNextDay}
                        disabled={isNextDayDisabled}
                        className="p-2 rounded-md bg-white dark:bg-primary border border-gray-300 dark:border-gray-700 hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        aria-label="Día siguiente"
                    >
                        <ChevronRightIcon className="w-5 h-5" />
                    </button>
                </div>
            </div>
          </div>

          <div className="bg-gray-100 dark:bg-gray-800 p-4 rounded-lg mb-6">
            <div className="flex justify-between items-center cursor-pointer" onClick={() => setIsSummaryExpanded(!isSummaryExpanded)}>
                <h3 className="text-lg font-bold text-gray-800 dark:text-text-light">Resumen de Ventas por Categoría</h3>
                <ChevronDownIcon className={`w-6 h-6 transition-transform ${isSummaryExpanded ? 'rotate-180' : ''}`} />
            </div>
            {isSummaryExpanded && (
                <div className="mt-4 overflow-y-auto max-h-[300px] pr-2">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-gray-200 dark:bg-gray-700 sticky top-0 z-10">
                            <tr>
                                <th className="p-2 font-semibold">Categoría</th>
                                <th className="p-2 font-semibold text-center">Unidades Vendidas</th>
                                <th className="p-2 font-semibold text-right">Total Vendido</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 dark:divide-gray-600">
                            {categorySummary.map((category) => (
                                <tr key={category.categoryId}>
                                    <td className="p-2 font-semibold">{category.categoryName}</td>
                                    <td className="p-2 text-center font-bold">{category.units}</td>
                                    <td className="p-2 text-right font-semibold text-accent">{formatCOP(category.total)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {categorySummary.length === 0 && <p className="text-center text-gray-500 py-4">No hay datos de ventas para esta selección.</p>}
                </div>
            )}
          </div>

          {filteredSales.length === 0 ? (
            <p className="text-center text-gray-500 dark:text-text-dark py-8">No se encontraron ventas con los filtros aplicados.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-gray-100 dark:bg-gray-800">
                  <tr>
                    <th className="p-3 text-sm font-semibold tracking-wide">Factura</th>
                    <th className="p-3 text-sm font-semibold tracking-wide">Fecha</th>
                    <th className="p-3 text-sm font-semibold tracking-wide">Cliente</th>
                    <th className="p-3 text-sm font-semibold tracking-wide text-center">Items</th>
                    <th className="p-3 text-sm font-semibold tracking-wide text-right">Total Venta</th>
                    <th className="p-3 text-sm font-semibold tracking-wide text-right">Ganancia</th>
                    <th className="p-3 text-sm font-semibold tracking-wide">Medio de Pago</th>
                    <th className="p-3 text-sm font-semibold tracking-wide">Vendedor</th>
                    <th className="p-3 text-sm font-semibold tracking-wide text-center">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {filteredSales.map((sale) => {
                      const profit = calculateSaleProfit(sale);
                      const profitColor = profit >= 0 ? 'text-green-500' : 'text-red-500';
                      const isExpanded = expandedSaleId === sale.id;
                      const itemsArray: CartItem[] = (Array.isArray(sale.items) ? sale.items : Object.values(sale.items || {}) as any[]).filter(Boolean) as CartItem[];
                      // FIX: Handle cases where sale.payments is an object from Firebase instead of an array.
                      const paymentsArray: Payment[] = (Array.isArray(sale.payments) ? sale.payments : Object.values(sale.payments || {}) as any[]).filter(Boolean) as Payment[];
                      return (
                          <React.Fragment key={sale.id}>
                            <tr 
                                className="hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors cursor-pointer"
                                onClick={() => setExpandedSaleId(isExpanded ? null : sale.id)}
                            >
                              <td className="p-3 font-mono text-accent">
                                <div className="flex items-center space-x-2">
                                    <ChevronDownIcon className={`w-5 h-5 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                                    <span>#{sale.invoiceNumber}</span>
                                    {sale.layawayId && (
                                        <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-blue-500/80 text-white">
                                            ABONO
                                        </span>
                                    )}
                                </div>
                              </td>
                              <td className="p-3 text-sm whitespace-nowrap">{new Date(sale.createdAt).toLocaleString()}</td>
                              <td className="p-3">
                                  <div>{sale.customerName}</div>
                                  <div className="text-xs text-gray-500 dark:text-text-dark">{sale.customerPhone}</div>
                              </td>
                              <td className="p-3 text-center">{itemsArray.reduce((acc, item) => acc + (item?.quantity || 0), 0)}</td>
                              <td className="p-3 text-right font-semibold text-accent">{formatCOP(sale.totalAmount)}</td>
                              <td className={`p-3 text-right font-bold ${profitColor}`}>{formatCOP(profit)}</td>
                              <td className="p-3">
                                {renderPaymentMethods(sale)}
                              </td>
                              <td className="p-3">{sale.seller}</td>
                              <td className="p-3 text-center">
                                <div className="flex justify-center items-center space-x-1">
                                  <button onClick={(e) => { e.stopPropagation(); onReprintSale(sale); }} className="text-gray-500 dark:text-text-dark hover:text-blue-500 p-2 rounded-full hover:bg-blue-500/10 transition-colors" title="Reimprimir Factura">
                                    <PrintIcon className="w-5 h-5" />
                                  </button>
                                  <button 
                                    onClick={(e) => { e.stopPropagation(); setEditingSale(sale); }} 
                                    className="text-gray-500 dark:text-text-dark hover:text-accent p-2 rounded-full hover:bg-accent/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed" 
                                    title={sale.layawayId ? "Editar desde la pestaña Abonos" : "Editar Venta"}
                                    disabled={!!sale.layawayId}
                                >
                                    <EditIcon className="w-5 h-5" />
                                  </button>
                                  {isAdmin && (
                                    <button onClick={(e) => { e.stopPropagation(); onDeleteSale(sale.id); }} className="text-gray-500 dark:text-text-dark hover:text-red-500 p-2 rounded-full hover:bg-red-500/10 transition-colors" title="Eliminar Venta">
                                      <TrashIcon className="w-5 h-5" />
                                    </button>
                                  )}
                                </div>
                              </td>
                          </tr>
                          {isExpanded && (
                            <tr className="bg-gray-100/50 dark:bg-gray-800/50">
                                <td colSpan={9} className="p-4">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                            <h4 className="font-bold text-accent mb-2">Productos</h4>
                                            <table className="w-full text-sm">
                                                <thead className="border-b dark:border-gray-600">
                                                    <tr>
                                                        <th className="text-left pb-1 font-semibold">Nombre</th>
                                                        <th className="text-center pb-1 font-semibold">Cant.</th>
                                                        <th className="text-right pb-1 font-semibold">P. Unit</th>
                                                        <th className="text-right pb-1 font-semibold">Subtotal</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-gray-200/50 dark:divide-gray-700/50">
                                                    {itemsArray.map((item: CartItem, index) => item && (
                                                        <tr key={index}>
                                                            <td className="py-1">{item.name}</td>
                                                            <td className="text-center py-1">{item.quantity}</td>
                                                            <td className="text-right py-1">{formatCOP(item.price)}</td>
                                                            <td className="text-right py-1 font-semibold">{formatCOP(item.price * item.quantity)}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                        <div>
                                            <h4 className="font-bold text-accent mb-2">Detalles de Pago</h4>
                                            <div className="bg-white dark:bg-secondary p-3 rounded-md space-y-2 text-sm">
                                                {paymentsArray.length > 0 ? paymentsArray.map((p, index) => (
                                                        <div key={index} className="flex justify-between">
                                                            <span>{p.method}:</span>
                                                            <span className="font-bold">{formatCOP(p.amount)}</span>
                                                        </div>
                                                    ))
                                                 : sale.paymentMethod ? (
                                                    <div className="flex justify-between">
                                                        <span>Método de Pago:</span>
                                                        <span className="font-bold">{sale.paymentMethod}</span>
                                                    </div>
                                                ) : null}
                                                <div className="flex justify-between font-bold pt-2 border-t border-dashed">
                                                    <span>Total Pagado:</span>
                                                    <span>{formatCOP(paymentsArray.length > 0 ? paymentsArray.reduce((sum,p) => sum + p.amount, 0) : sale.totalAmount)}</span>
                                                </div>
                                                 <div className="flex justify-between">
                                                    <span>Ganancia:</span>
                                                    <span className={`font-bold ${profitColor}`}>{formatCOP(profit)}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
      {editingSale && (
        <EditSaleModal
          isOpen={!!editingSale}
          onClose={() => setEditingSale(null)}
          sale={editingSale}
          sellers={sellers}
          inventory={inventory}
          onUpdateSale={onUpdateSale}
        />
      )}
    </>
  );
};

export default SalesView;
