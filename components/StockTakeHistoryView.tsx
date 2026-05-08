
import React, { useState, useMemo } from 'react';
import { StockTake, Seller, Role } from '../types';
import { formatCOP } from '../constants';
import { TrashIcon, PlusCircleIcon, CheckIcon } from './Icons';

interface StockTakeHistoryViewProps {
  stockTakes: StockTake[];
  sellers: Seller[];
  onDeleteStockTake: (stockTakeId: string) => void;
  onAddNoteToStockTake: (stockTakeId: string, note: string) => void;
  onApplyStockTake: (stockTake: StockTake) => void;
  currentUser: Seller;
  roles: Role[];
}

const StockTakeHistoryView: React.FC<StockTakeHistoryViewProps> = ({ stockTakes, sellers, onDeleteStockTake, onAddNoteToStockTake, onApplyStockTake, currentUser, roles }) => {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [sellerFilter, setSellerFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [newNote, setNewNote] = useState('');

  const adminRole = useMemo(() => roles.find(r => r.name === 'Administrator'), [roles]);
  const isAdmin = useMemo(() => currentUser.roleId === adminRole?.id, [currentUser, adminRole]);

  const filteredStockTakes = useMemo(() => {
    return [...stockTakes].filter(st => {
      const stDate = new Date(st.createdAt);
      const start = startDate ? new Date(startDate + 'T00:00:00') : null;
      const end = endDate ? new Date(endDate + 'T23:59:59') : null;
      
      const matchesSeller = sellerFilter ? st.seller === sellerFilter : true;
      const matchesStartDate = start ? stDate >= start : true;
      const matchesEndDate = end ? stDate <= end : true;
      
      return matchesSeller && matchesStartDate && matchesEndDate;
    }).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [stockTakes, sellerFilter, startDate, endDate]);

  const handleAddNote = (stockTakeId: string) => {
    if (newNote.trim()) {
      onAddNoteToStockTake(stockTakeId, newNote.trim());
      setNewNote('');
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="bg-white dark:bg-secondary p-6 rounded-xl shadow-lg">
        <h2 className="text-2xl font-bold text-accent mb-6 border-b-2 border-accent/30 pb-2">Auditorías / Conteos</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <select value={sellerFilter} onChange={e => setSellerFilter(e.target.value)} className="w-full bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-md p-2">
              <option value="">Todos los Vendedores</option>
              {sellers.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
          </select>
          <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-md p-2"/>
          <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="w-full bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-md p-2"/>
        </div>

        {filteredStockTakes.length === 0 ? (
          <p className="text-center text-gray-500 dark:text-text-dark py-8">No hay verificaciones de inventario registradas con los filtros aplicados.</p>
        ) : (
          <div className="space-y-4">
            {filteredStockTakes.map(st => {
              const totalDifference = st.verification.reduce((sum, v) => sum + v.difference, 0);
              const hasDiscrepancy = totalDifference !== 0;

              return (
                <div key={st.id} className="bg-gray-100 dark:bg-gray-800 rounded-lg p-4 transition-all duration-300">
                  <div className="flex flex-col sm:flex-row justify-between sm:items-center cursor-pointer" onClick={() => setExpandedId(expandedId === st.id ? null : st.id)}>
                    <div className="flex-1 mb-2 sm:mb-0">
                      <div className="flex items-center space-x-3">
                        <span className={`px-2 py-1 text-xs font-bold rounded-full ${hasDiscrepancy ? 'bg-red-500/20 text-red-300' : 'bg-green-500/20 text-green-300'}`}>
                          {hasDiscrepancy ? 'CON DIFERENCIAS' : 'CUADRE OK'}
                        </span>
                        {st.isApplied ? (
                             <span className="px-2 py-1 text-xs font-bold rounded-full bg-green-600 text-white flex items-center gap-1">
                                 <CheckIcon className="w-3 h-3"/> APLICADO
                             </span>
                        ) : (
                            <span className="px-2 py-1 text-xs font-bold rounded-full bg-yellow-500/20 text-yellow-500">PENDIENTE</span>
                        )}
                        <h3 className="font-bold text-lg text-gray-900 dark:text-white">Vendedor: {st.seller}</h3>
                      </div>
                      <p className="text-xs text-gray-500 dark:text-text-dark mt-1">
                        Fecha: {new Date(st.createdAt).toLocaleString()}
                        {st.cashBase !== undefined && st.cashBase > 0 && (
                            <span className="ml-4">
                            Base de Caja: <span className="font-bold text-accent">{formatCOP(st.cashBase)}</span>
                            </span>
                        )}
                      </p>
                    </div>
                     <div className="flex-1 text-left sm:text-right">
                        <p className="text-lg font-bold text-gray-900 dark:text-white">
                            Diferencia Total: 
                            <span className={totalDifference > 0 ? 'text-green-500' : totalDifference < 0 ? 'text-red-500' : ''}>
                                {totalDifference > 0 ? ` +${totalDifference}` : ` ${totalDifference}`}
                            </span>
                        </p>
                    </div>
                  </div>

                  {expandedId === st.id && (
                    <div className="mt-4 pt-4 border-t border-gray-300 dark:border-gray-700">
                      <div className="overflow-x-auto mb-4">
                        <table className="w-full text-left">
                            <thead className="bg-gray-200 dark:bg-gray-700">
                                <tr>
                                    <th className="p-2 text-sm font-semibold">Categoría</th>
                                    <th className="p-2 text-sm font-semibold text-center">Stock Sistema</th>
                                    <th className="p-2 text-sm font-semibold text-center">Conteo Físico</th>
                                    <th className="p-2 text-sm font-semibold text-center">Diferencia</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200 dark:divide-gray-600">
                                {st.verification.map(v => (
                                    <tr key={v.categoryId}>
                                        <td className="p-2 font-semibold">{v.categoryName}</td>
                                        <td className="p-2 text-center">{v.systemStock}</td>
                                        <td className="p-2 text-center">{v.physicalCount}</td>
                                        <td className={`p-2 text-center font-bold ${v.difference > 0 ? 'text-green-500' : v.difference < 0 ? 'text-red-500' : ''}`}>
                                            {v.difference > 0 ? `+${v.difference}` : v.difference}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                      </div>

                       <div className="mt-4">
                        <h4 className="font-bold text-accent mb-2">Notas</h4>
                        <div className="space-y-2 mb-3 max-h-40 overflow-y-auto pr-2">
                          {(st.notes && st.notes.length > 0) ? (
                            [...st.notes].sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map((note, index) => (
                              <div key={index} className="bg-gray-200 dark:bg-gray-700 p-2 rounded-md text-sm">
                                <p className="text-gray-800 dark:text-text-light whitespace-pre-wrap">{note.content}</p>
                                <p className="text-xs text-gray-500 dark:text-text-dark mt-1">
                                  - {note.author} el {new Date(note.date).toLocaleString()}
                                </p>
                              </div>
                            ))
                          ) : (
                            <p className="text-sm text-gray-500 dark:text-text-dark">No hay notas para este conteo.</p>
                          )}
                        </div>
                        <div className="flex gap-2">
                          <textarea
                            value={newNote}
                            onChange={(e) => setNewNote(e.target.value)}
                            placeholder="Añadir una nota..."
                            rows={2}
                            className="w-full bg-white dark:bg-gray-900 p-2 rounded-md border border-gray-300 dark:border-gray-600 text-sm"
                          />
                          <button
                            onClick={() => handleAddNote(st.id)}
                            disabled={!newNote.trim()}
                            className="bg-accent text-white font-bold py-2 px-4 rounded-lg flex items-center justify-center space-x-2 transition-colors duration-300 hover:bg-accent-hover disabled:bg-gray-500"
                          >
                            <PlusCircleIcon />
                          </button>
                        </div>
                      </div>

                      <div className="mt-6 flex flex-wrap justify-end gap-3">
                         {isAdmin && !st.isApplied && st.productCounts && (
                            <button
                                onClick={() => onApplyStockTake(st)}
                                className="flex items-center space-x-2 px-6 py-2 bg-green-600 text-white rounded-md font-bold hover:bg-green-700 transition-colors shadow-md active:scale-95"
                            >
                                <CheckIcon className="w-5 h-5"/>
                                <span>Aplicar este conteo al Inventario</span>
                            </button>
                         )}
                        {isAdmin && (
                          <button
                            onClick={() => onDeleteStockTake(st.id)}
                            className="flex items-center space-x-2 px-4 py-2 bg-red-500/10 text-red-500 rounded-md font-medium hover:bg-red-500/20 transition-colors"
                          >
                            <TrashIcon />
                            <span>Eliminar Conteo</span>
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default StockTakeHistoryView;
