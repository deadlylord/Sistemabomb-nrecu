
import React, { useMemo } from 'react';
import { Product, Sale, Purchase } from '../types';
import { CrossIcon, ChartBarIcon, TrendingUpIcon, TrendingDownIcon, DollarIcon, PackageIcon, HistoryIcon } from './Icons';
import { formatCOP } from '../constants';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

interface ProductPerformanceModalProps {
    isOpen: boolean;
    onClose: () => void;
    product: Product;
    sales: Sale[];
    purchases: Purchase[];
    onUpdateProduct: (product: Product) => Promise<void>;
    isAdmin: boolean;
}

const ProductPerformanceModal: React.FC<ProductPerformanceModalProps> = ({ isOpen, onClose, product, sales, purchases, onUpdateProduct, isAdmin }) => {
    const [discountValue, setDiscountValue] = React.useState<number>(product.discountPrice || product.price);
    const [isApplying, setIsApplying] = React.useState(false);

    const performance = useMemo(() => {
        const productSales = sales.filter(sale => sale.items.some(item => item.id === product.id));
        
        let totalUnitsSold = 0;
        let totalRevenue = 0;
        let totalProfit = 0;
        let lastSaleDate: string | null = null;

        productSales.forEach(sale => {
            const item = sale.items.find(i => i.id === product.id);
            if (item) {
                totalUnitsSold += item.quantity;
                totalRevenue += item.price * item.quantity;
                totalProfit += (item.price - item.cost) * item.quantity;
                
                if (!lastSaleDate || new Date(sale.createdAt) > new Date(lastSaleDate)) {
                    lastSaleDate = sale.createdAt;
                }
            }
        });

        const productPurchases = purchases.filter(p => p.productId === product.id);
        const totalUnitsPurchased = productPurchases.reduce((acc, p) => acc + p.quantity, 0);
        const totalCost = productPurchases.reduce((acc, p) => acc + p.totalCost, 0);
        const avgCost = totalUnitsPurchased > 0 ? totalCost / totalUnitsPurchased : product.cost;
        
        let lastPurchaseDate: string | null = null;
        productPurchases.forEach(p => {
            if (!lastPurchaseDate || new Date(p.createdAt) > new Date(lastPurchaseDate)) {
                lastPurchaseDate = p.createdAt;
            }
        });

        // Rendimiento en los últimos 30 días
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        
        const recentSales = productSales.filter(sale => new Date(sale.createdAt) >= thirtyDaysAgo);
        const recentUnitsSold = recentSales.reduce((acc, sale) => {
            const item = sale.items.find(i => i.id === product.id);
            return acc + (item?.quantity || 0);
        }, 0);

        // Ventas mes a mes (últimos 6 meses)
        const monthlyData: { month: string; units: number; revenue: number }[] = [];
        const monthNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
        
        for (let i = 5; i >= 0; i--) {
            const d = new Date();
            d.setMonth(d.getMonth() - i);
            const month = d.getMonth();
            const year = d.getFullYear();
            const monthLabel = `${monthNames[month]} ${year.toString().slice(-2)}`;
            
            const monthSales = productSales.filter(sale => {
                const saleDate = new Date(sale.createdAt);
                return saleDate.getMonth() === month && saleDate.getFullYear() === year;
            });
            
            const units = monthSales.reduce((acc, sale) => {
                const item = sale.items.find(i => i.id === product.id);
                return acc + (item?.quantity || 0);
            }, 0);

            const revenue = monthSales.reduce((acc, sale) => {
                const item = sale.items.find(i => i.id === product.id);
                return acc + ((item?.quantity || 0) * (item?.price || 0));
            }, 0);
            
            monthlyData.push({ month: monthLabel, units, revenue });
        }

        return {
            totalUnitsSold,
            totalRevenue,
            totalProfit,
            lastSaleDate,
            totalUnitsPurchased,
            avgCost,
            recentUnitsSold,
            lastPurchaseDate,
            monthlyData,
            margin: totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0
        };
    }, [product, sales, purchases]);

    const supplyRecommendation = useMemo(() => {
        const stock = product.stock;
        const recent = performance.recentUnitsSold;
        
        if (recent > 0 && stock < recent) {
            const recommendedQty = Math.max(Math.round(recent * 2 - stock), 5);
            return {
                type: 'warning',
                title: '🚨 Reabastecimiento Urgente',
                message: `Quedan solo ${stock} unidades de este producto y has vendido ${recent} en los últimos 30 días. Te recomendamos pedir un lote de ${recommendedQty} unidades para reabastecer.`,
                color: 'bg-rose-50 dark:bg-rose-950/10 border-rose-200/50 dark:border-rose-800/40 text-rose-800 dark:text-rose-300'
            };
        } else if (recent === 0 && stock > 5) {
            return {
                type: 'overstock',
                title: '⚠️ Exceso de Existencias / Estancado',
                message: `Este producto no ha registrado ventas en los últimos 30 días y tienes un inventario de ${stock} unidades. Te sugerimos activar una promoción de descuento para incentivar su rotación.`,
                color: 'bg-amber-50 dark:bg-amber-950/10 border-amber-200/50 dark:border-amber-800/40 text-amber-800 dark:text-amber-300'
            };
        } else if (recent > 0 && stock >= recent * 3) {
            return {
                type: 'overstock',
                title: '📈 Rotación Baja (Overstock)',
                message: `El ritmo de venta es bajo comparado con las existencias actuales (has vendido ${recent} unidades en los últimos 30 días pero tienes ${stock} en inventario). Te recomendamos una rebaja o promoción de liquidación.`,
                color: 'bg-orange-50 dark:bg-orange-950/10 border-orange-200/50 dark:border-orange-800/40 text-orange-800 dark:text-orange-300'
            };
        } else {
            return {
                type: 'healthy',
                title: '✅ Inventario Saludable',
                message: `El nivel de existencias es saludable en relación con la demanda de los últimos 30 días (has vendido ${recent} unidades y te quedan ${stock}). Monitorea el flujo normal antes de realizar un nuevo pedido.`,
                color: 'bg-emerald-50 dark:bg-emerald-950/10 border-emerald-200/50 dark:border-emerald-800/40 text-emerald-800 dark:text-emerald-300'
            };
        }
    }, [product.stock, performance.recentUnitsSold]);

    const handleApplyDiscount = async () => {
        setIsApplying(true);
        try {
            const updatedProduct: Product = {
                ...product,
                discountPrice: discountValue
            };
            await onUpdateProduct(updatedProduct);
            onClose();
        } catch (error) {
            console.error("Error applying discount:", error);
            alert("Error al aplicar el descuento.");
        } finally {
            setIsApplying(false);
        }
    };

    const handleRemoveDiscount = async () => {
        setIsApplying(true);
        try {
            const updatedProduct: Product = {
                ...product
            };
            delete updatedProduct.discountPrice;
            
            await onUpdateProduct(updatedProduct);
            onClose();
        } catch (error) {
            console.error("Error removing discount:", error);
            alert("Error al quitar el descuento.");
        } finally {
            setIsApplying(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
            <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-800">
                {/* Header */}
                <div className="p-6 border-b dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-800/50">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-accent/10 rounded-xl">
                            <ChartBarIcon className="w-6 h-6 text-accent" />
                        </div>
                        <div>
                            <h3 className="text-lg font-black text-slate-800 dark:text-white uppercase tracking-tight">Rendimiento del Producto</h3>
                            <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">{product.sku}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 text-slate-400 hover:text-red-500 transition-colors">
                        <CrossIcon className="w-6 h-6" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto custom-scrollbar">
                    {/* Product Info Brief */}
                    <div className="flex items-center gap-4 p-4 bg-slate-100 dark:bg-slate-800/50 rounded-2xl">
                        <div className="w-16 h-16 rounded-xl overflow-hidden bg-white dark:bg-slate-800 border dark:border-slate-700 flex-shrink-0">
                            {product.imageUrl ? (
                                <img src={product.imageUrl} alt="" className="w-full h-full object-cover" />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center">
                                    <PackageIcon className="w-8 h-8 text-slate-300" />
                                </div>
                            )}
                        </div>
                        <div>
                            <h4 className="font-black text-slate-800 dark:text-white uppercase leading-tight">{product.name}</h4>
                            <p className="text-xs font-bold text-slate-500 dark:text-slate-400">{product.supplier || 'Sin proveedor'}</p>
                        </div>
                    </div>

                    {/* Stats Grid */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="p-4 bg-emerald-50 dark:bg-emerald-900/20 rounded-2xl border border-emerald-100 dark:border-emerald-800/30">
                            <p className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest mb-1">Unidades Vendidas</p>
                            <div className="flex items-baseline gap-2">
                                <span className="text-2xl font-black text-emerald-700 dark:text-emerald-300">{performance.totalUnitsSold}</span>
                                <span className="text-[10px] font-bold text-emerald-600/60 dark:text-emerald-400/60 uppercase">Total</span>
                            </div>
                        </div>
                        <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-2xl border border-blue-100 dark:border-blue-800/30">
                            <p className="text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest mb-1">Stock Actual</p>
                            <div className="flex items-baseline gap-2">
                                <span className="text-2xl font-black text-blue-700 dark:text-blue-300">{product.stock}</span>
                                <span className="text-[10px] font-bold text-blue-600/60 dark:text-blue-400/60 uppercase">Unidades</span>
                            </div>
                        </div>
                    </div>

                    {/* Financial Stats */}
                    {isAdmin && (
                        <div className="space-y-3">
                            <div className="flex justify-between items-center p-4 bg-slate-50 dark:bg-slate-800/30 rounded-2xl">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-slate-200 dark:bg-slate-700 rounded-lg">
                                        <DollarIcon className="w-4 h-4 text-slate-600 dark:text-slate-300" />
                                    </div>
                                    <span className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">Ingresos Totales</span>
                                </div>
                                <span className="font-black text-slate-800 dark:text-white">{formatCOP(performance.totalRevenue)}</span>
                            </div>

                            <div className="flex justify-between items-center p-4 bg-slate-50 dark:bg-slate-800/30 rounded-2xl">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-emerald-100 dark:bg-emerald-900/40 rounded-lg">
                                        <TrendingUpIcon className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                                    </div>
                                    <span className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">Utilidad Bruta</span>
                                </div>
                                <span className="font-black text-emerald-600 dark:text-emerald-400">{formatCOP(performance.totalProfit)}</span>
                            </div>

                            <div className="flex justify-between items-center p-4 bg-slate-50 dark:bg-slate-800/30 rounded-2xl">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-purple-100 dark:bg-purple-900/40 rounded-lg">
                                        <TrendingUpIcon className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                                    </div>
                                    <span className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">Margen de Utilidad</span>
                                </div>
                                <span className="font-black text-purple-600 dark:text-purple-400">{performance.margin.toFixed(1)}%</span>
                             </div>
                        </div>
                    )}

                    {/* Asistente de Abastecimiento Inteligente */}
                    {isAdmin && (
                        <div className={`p-5 rounded-3xl border ${supplyRecommendation.color} space-y-2 shadow-sm`}>
                            <h4 className="text-xs font-black uppercase tracking-wider flex items-center gap-1.5 opacity-80">
                                📊 Asistente de Abastecimiento Inteligente
                            </h4>
                            <div className="border-t border-current opacity-10 my-1"></div>
                            <h5 className="text-xs font-black uppercase tracking-wider flex items-center gap-1.5">
                                {supplyRecommendation.title}
                            </h5>
                            <p className="text-xs leading-relaxed font-bold">
                                {supplyRecommendation.message}
                            </p>
                        </div>
                    )}

                    {/* Additional Info */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="p-4 bg-slate-50 dark:bg-slate-800/30 rounded-2xl border border-slate-100 dark:border-slate-800">
                            <div className="flex items-center gap-2 mb-2">
                                <HistoryIcon className="w-3 h-3 text-slate-400" />
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Última Venta</p>
                            </div>
                            <p className="text-xs font-black text-slate-700 dark:text-slate-300">
                                {performance.lastSaleDate ? new Date(performance.lastSaleDate).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Sin ventas'}
                            </p>
                        </div>
                        <div className="p-4 bg-slate-50 dark:bg-slate-800/30 rounded-2xl border border-slate-100 dark:border-slate-800">
                            <div className="flex items-center gap-2 mb-2">
                                <HistoryIcon className="w-3 h-3 text-slate-400" />
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Última Compra</p>
                            </div>
                            <p className="text-xs font-black text-slate-700 dark:text-slate-300">
                                {performance.lastPurchaseDate ? new Date(performance.lastPurchaseDate).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Sin compras'}
                            </p>
                        </div>
                    </div>

                    {/* Monthly Sales Chart */}
                    <div className="p-6 bg-slate-50 dark:bg-slate-800/30 rounded-3xl border border-slate-100 dark:border-slate-800">
                        <div className="flex items-center gap-2 mb-4">
                            <TrendingUpIcon className="w-5 h-5 text-accent" />
                            <h4 className="text-xs font-black text-slate-800 dark:text-white uppercase tracking-widest">Ventas Mes a Mes (Unidades)</h4>
                        </div>
                        <div className="h-48 w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={performance.monthlyData}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                    <XAxis 
                                        dataKey="month" 
                                        axisLine={false} 
                                        tickLine={false} 
                                        tick={{ fontSize: 10, fontWeight: 'bold' }} 
                                        stroke="#94a3b8"
                                    />
                                    <YAxis 
                                        axisLine={false} 
                                        tickLine={false} 
                                        tick={{ fontSize: 10, fontWeight: 'bold' }} 
                                        stroke="#94a3b8"
                                    />
                                    <Tooltip 
                                        cursor={{ fill: 'rgba(0,0,0,0.05)' }}
                                        contentStyle={{ 
                                            borderRadius: '12px', 
                                            border: 'none', 
                                            boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)',
                                            fontSize: '12px',
                                            fontWeight: 'bold'
                                        }}
                                    />
                                    <Bar dataKey="units" radius={[4, 4, 0, 0]}>
                                        {performance.monthlyData.map((entry, index) => (
                                            <Cell 
                                                key={`cell-${index}`} 
                                                fill={index === performance.monthlyData.length - 1 ? '#f43f5e' : '#94a3b8'} 
                                            />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* Discount Section */}
                    {isAdmin && (
                        <div className="p-6 bg-orange-50 dark:bg-orange-900/10 rounded-3xl border border-orange-100 dark:border-orange-800/30 space-y-4">
                            <div className="flex items-center gap-2">
                                <TrendingDownIcon className="w-5 h-5 text-orange-500" />
                                <h4 className="text-xs font-black text-orange-600 dark:text-orange-400 uppercase tracking-widest">Gestionar Descuento (Liquidación)</h4>
                            </div>
                            
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Nuevo Precio de Venta</label>
                                <div className="flex gap-2">
                                    <input 
                                        type="number" 
                                        value={discountValue}
                                        onChange={(e) => setDiscountValue(Number(e.target.value))}
                                        className="flex-grow bg-white dark:bg-slate-800 border border-orange-200 dark:border-orange-800 rounded-xl px-4 py-2 font-black text-orange-600 outline-none focus:ring-2 focus:ring-orange-500"
                                        placeholder="Precio rebajado..."
                                    />
                                    <button 
                                        onClick={handleApplyDiscount}
                                        disabled={isApplying}
                                        className="bg-orange-500 hover:bg-orange-600 text-white px-6 py-2 rounded-xl font-black text-[10px] uppercase tracking-widest disabled:opacity-50 transition-all"
                                    >
                                        {isApplying ? '...' : 'Aplicar'}
                                    </button>
                                </div>
                                {discountValue < product.price && (
                                    <p className="text-[10px] font-bold text-orange-600">
                                        Descuento del {Math.round((1 - discountValue / product.price) * 100)}% ({formatCOP(product.price - discountValue)} menos)
                                    </p>
                                )}
                            </div>

                            {product.discountPrice && (
                                <div className="flex justify-between items-center pt-2 border-t border-orange-100 dark:border-orange-800/30">
                                    <div className="text-[10px] font-bold text-orange-600/60 dark:text-orange-400/60">
                                        Precio Original: <span>{formatCOP(product.price)}</span>
                                    </div>
                                    <button 
                                        onClick={handleRemoveDiscount}
                                        disabled={isApplying}
                                        className="text-[10px] font-black text-slate-400 hover:text-red-500 uppercase tracking-widest transition-colors"
                                    >
                                        Quitar Descuento
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-6 bg-slate-50 dark:bg-slate-800/50 border-t dark:border-slate-800">
                    <button 
                        onClick={onClose}
                        className="w-full py-4 bg-slate-800 dark:bg-slate-700 text-white rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-slate-700 dark:hover:bg-slate-600 transition-all shadow-lg shadow-slate-200 dark:shadow-none"
                    >
                        Cerrar Panel
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ProductPerformanceModal;
