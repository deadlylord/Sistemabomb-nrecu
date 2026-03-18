import React, { useState, useMemo } from 'react';
import { Sale, Product, Store, Category, CartItem } from '../types';
import { analyzeSalesData, generateStrategicReport } from '../services/geminiService';
import { SparklesIcon, CrossIcon, FileTextIcon } from './Icons';

interface ReportsModalProps {
  isOpen: boolean;
  onClose: () => void;
  allSales: Sale[];
  allInventory: Product[];
  stores: Store[];
  categories: Category[];
}

// A simple markdown to HTML renderer
const SimpleMarkdownRenderer: React.FC<{ content: string }> = ({ content }) => {
    const htmlContent = useMemo(() => {
        return content
            .replace(/^### (.*$)/gim, '<h3 class="text-lg font-bold text-gray-800 dark:text-text-light mt-4 mb-2">$1</h3>')
            .replace(/^## (.*$)/gim, '<h2 class="text-xl font-bold text-accent mt-6 mb-3 border-b-2 border-accent/30 pb-1">$1</h2>')
            .replace(/^\* (.*$)/gim, '<li class="ml-5 list-disc">$1</li>')
            .replace(/\*\*(.*?)\*\*/g, '<strong class="font-bold text-accent">$1</strong>')
            .replace(/\n/g, '<br />')
            .replace(/<br \/><li>/g, '<li>') // Fix extra space before list items
            .replace(/<\/li><br \/>/g, '</li>');
    }, [content]);

    return <div className="prose dark:prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: htmlContent }} />;
};


const ReportsModal: React.FC<ReportsModalProps> = ({ isOpen, onClose, allSales, allInventory, stores, categories }) => {
    const [startDate, setStartDate] = useState(new Date(new Date().setDate(new Date().getDate() - 6)).toISOString().split('T')[0]);
    const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
    const [selectedStoreIds, setSelectedStoreIds] = useState<string[]>(() => stores.map(s => s.id));
    const [customQuery, setCustomQuery] = useState('');
    const [analysis, setAnalysis] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isStrategicLoading, setIsStrategicLoading] = useState(false);
    const [error, setError] = useState('');

    if (!isOpen) return null;

    const handleStoreSelection = (storeId: string) => {
        setSelectedStoreIds(prev =>
            prev.includes(storeId)
                ? prev.filter(id => id !== storeId)
                : [...prev, storeId]
        );
    };

    const handleGenerateAnalysis = async (query: string, isStrategic: boolean = false) => {
        if (isStrategic) setIsStrategicLoading(true);
        else setIsLoading(true);
        setError('');
        setAnalysis('');

        if (selectedStoreIds.length === 0) {
            setError('Por favor, selecciona al menos una tienda para analizar.');
            setIsLoading(false);
            setIsStrategicLoading(false);
            return;
        }

        try {
            const start = new Date(startDate + 'T00:00:00');
            const end = new Date(endDate + 'T23:59:59');

            const salesInRange = allSales.filter(s => {
                const saleDate = new Date(s.createdAt);
                return selectedStoreIds.includes(s.storeId) && saleDate >= start && saleDate <= end;
            });

            const inventoryInStores = allInventory.filter(p => selectedStoreIds.includes(p.storeId));

            const dataForAI = {
                periodo: {
                    inicio: startDate,
                    fin: endDate,
                },
                tiendasAnalizadas: stores.filter(s => selectedStoreIds.includes(s.id)).map(s => s.name),
                resumenPorTienda: selectedStoreIds.map(storeId => {
                    const store = stores.find(s => s.id === storeId);
                    const storeSales = salesInRange.filter(s => s.storeId === storeId);
                    const storeInventory = inventoryInStores.filter(p => p.storeId === storeId);
                    
                    const productsSold = new Map<string, { name: string, quantity: number, revenue: number }>();
                    storeSales.forEach(sale => {
                        const items = (Array.isArray(sale.items) ? sale.items : Object.values(sale.items || {})) as CartItem[];
                        items.forEach(item => {
                            if(!item || item.id.startsWith('voucher-')) return;
                            const existing = productsSold.get(item.id);
                            if (existing) {
                                existing.quantity += item.quantity;
                                existing.revenue += item.price * item.quantity;
                            } else {
                                productsSold.set(item.id, { name: item.name, quantity: item.quantity, revenue: item.price * item.quantity });
                            }
                        });
                    });

                    const stagnantProducts = storeInventory
                        .filter(p => p.stock > 0 && !productsSold.has(p.id))
                        .map(p => ({ name: p.name, stock: p.stock, cost: p.cost }));

                    const totalVentas = Array.from(productsSold.values()).reduce((sum, p) => sum + p.revenue, 0);

                    return {
                        nombreTienda: store?.name,
                        totalVentas,
                        productosVendidos: Array.from(productsSold.values()).sort((a,b) => b.revenue - a.revenue).slice(0, 20),
                        productosEstancados: stagnantProducts.slice(0, 15),
                    };
                })
            };

            const result = isStrategic 
                ? await generateStrategicReport(dataForAI)
                : await analyzeSalesData(dataForAI, query);
            setAnalysis(result);
        } catch (e: any) {
            setError(e.message || 'Ocurrió un error desconocido al generar el análisis.');
        } finally {
            setIsLoading(false);
            setIsStrategicLoading(false);
        }
    };

    const quickQueries = [
        "Análisis General del Periodo",
        "Top 5 Productos Más Vendidos",
        "Productos con Peor Rendimiento (Estancados)",
        "Comparativa de Ventas Entre Tiendas",
    ];

    return (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-secondary rounded-lg shadow-xl p-6 w-full max-w-4xl max-h-[90vh] flex flex-col">
                <div className="flex justify-between items-center mb-4 border-b-2 border-accent/30 pb-2">
                    <h2 className="text-2xl font-bold text-accent">Análisis de Ventas con IA</h2>
                    <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700">
                        <CrossIcon />
                    </button>
                </div>
                
                <div className="flex-grow overflow-y-auto pr-2 space-y-6">
                    <div className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-500 dark:text-text-dark mb-1">Desde</label>
                                <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full bg-gray-100 dark:bg-gray-800 p-2 rounded-md"/>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-500 dark:text-text-dark mb-1">Hasta</label>
                                <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="w-full bg-gray-100 dark:bg-gray-800 p-2 rounded-md"/>
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-500 dark:text-text-dark mb-2">Tiendas a Analizar</label>
                            <div className="flex flex-wrap gap-3">
                                {stores.map(store => (
                                    <label key={store.id} className="flex items-center space-x-2 cursor-pointer">
                                        <input type="checkbox" checked={selectedStoreIds.includes(store.id)} onChange={() => handleStoreSelection(store.id)} className="h-5 w-5 rounded border-gray-300 text-accent focus:ring-accent"/>
                                        <span>{store.name}</span>
                                    </label>
                                ))}
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-500 dark:text-text-dark mb-2">Análisis Rápidos</label>
                            <div className="flex flex-wrap gap-2">
                                {quickQueries.map(q => (
                                    <button key={q} onClick={() => handleGenerateAnalysis(q)} className="px-3 py-1.5 text-sm bg-accent/20 text-accent rounded-full hover:bg-accent/30 transition-colors">
                                        {q}
                                    </button>
                                ))}
                            </div>
                        </div>
                        
                        <div>
                            <label htmlFor="customQuery" className="block text-sm font-medium text-gray-500 dark:text-text-dark mb-1">O haz tu propia pregunta</label>
                            <textarea id="customQuery" value={customQuery} onChange={e => setCustomQuery(e.target.value)} rows={2} className="w-full bg-gray-100 dark:bg-gray-800 p-2 rounded-md" placeholder="Ej: ¿Qué categoría se vendió más en Divino la semana pasada?"/>
                        </div>
                        <div className="flex flex-col sm:flex-row justify-end gap-2">
                            <button 
                                onClick={() => handleGenerateAnalysis('', true)} 
                                disabled={isLoading || isStrategicLoading} 
                                className="bg-gradient-to-r from-purple-600 to-accent text-white font-bold py-2 px-6 rounded-lg flex items-center justify-center space-x-2 hover:opacity-90 disabled:bg-gray-500 transition-all active:scale-95"
                            >
                                <FileTextIcon className="w-5 h-5" />
                                <span>{isStrategicLoading ? 'Generando Reporte...' : 'Reporte Estratégico'}</span>
                            </button>
                            <button 
                                onClick={() => handleGenerateAnalysis(customQuery || 'Análisis General del Periodo')} 
                                disabled={isLoading || isStrategicLoading} 
                                className="bg-accent text-white font-bold py-2 px-6 rounded-lg flex items-center justify-center space-x-2 hover:bg-accent-hover disabled:bg-gray-500 transition-all active:scale-95"
                            >
                                <SparklesIcon />
                                <span>{isLoading ? 'Analizando...' : 'Análisis Personalizado'}</span>
                            </button>
                        </div>
                    </div>

                    {(isLoading || isStrategicLoading || analysis || error) && (
                        <div className="bg-gray-100 dark:bg-gray-800/50 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="text-xl font-bold text-accent">Resultado del Análisis</h3>
                                {analysis && (
                                    <button 
                                        onClick={() => {
                                            navigator.clipboard.writeText(analysis);
                                            alert('Copiado al portapapeles');
                                        }}
                                        className="text-xs bg-white dark:bg-gray-800 px-3 py-1 rounded-full border border-gray-200 dark:border-gray-700 hover:bg-gray-50 flex items-center gap-1 font-bold"
                                    >
                                        Copiar
                                    </button>
                                )}
                            </div>
                            {(isLoading || isStrategicLoading) && (
                                <div className="flex items-center justify-center py-10">
                                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent"></div>
                                    <p className="ml-4 text-gray-500 dark:text-text-dark">Generando insights estratégicos...</p>
                                </div>
                            )}
                            {error && <p className="text-red-500 bg-red-500/10 p-3 rounded-md">{error}</p>}
                            {analysis && <SimpleMarkdownRenderer content={analysis} />}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ReportsModal;
