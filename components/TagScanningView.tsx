import React, { useState, useEffect, useMemo, useRef } from 'react';
import { db } from '../firebase';
import { 
  doc, 
  onSnapshot, 
  setDoc, 
  updateDoc, 
  deleteDoc
} from 'firebase/firestore';
import { Product, Store, Category, Seller } from '../types';
import { 
  CheckIcon, TagIcon, SparklesIcon, PackageIcon, AlertTriangleIcon, RefreshIcon, PlayIcon
} from './Icons';
import { formatCOP } from '../constants';
import { LabelPrintModal } from './LabelPrintModal';

interface TagScanningViewProps {
  inventory: Product[];
  store: Store;
  currentUser: Seller;
  categories: Category[];
  isAdmin: boolean;
}

interface RecentScan {
  id: string;
  productName: string;
  sku: string;
  timestamp: string;
  quantity: number;
}

export const TagScanningView: React.FC<TagScanningViewProps> = ({
  inventory,
  store,
  currentUser,
  categories,
  isAdmin
}) => {
  const [sessionData, setSessionData] = useState<{
    id: string;
    storeId: string;
    createdAt: string;
    updatedAt: string;
    scannedCounts: Record<string, number>;
  } | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [scanInput, setScanInput] = useState('');
  const [recentScans, setRecentScans] = useState<RecentScan[]>([]);
  const [scanStatus, setScanStatus] = useState<{ type: 'success' | 'error' | null; message: string }>({
    type: null,
    message: ''
  });

  // Label print state
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [productsToPrint, setProductsToPrint] = useState<Product[]>([]);
  const [printQuantities, setPrintQuantities] = useState<Record<string, number>>({});

  const inputRef = useRef<HTMLInputElement>(null);

  // Audio syntesizer for beeps (Web Audio API)
  const playBeep = (isSuccess: boolean) => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      if (isSuccess) {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, ctx.currentTime); // High pitch success beep
        gain.gain.setValueAtTime(0.08, ctx.currentTime);
        osc.start();
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.12);
        osc.stop(ctx.currentTime + 0.12);
      } else {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(130, ctx.currentTime); // Low pitch error buzz
        gain.gain.setValueAtTime(0.12, ctx.currentTime);
        osc.start();
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);
        osc.stop(ctx.currentTime + 0.35);
      }
    } catch (e) {
      console.warn('AudioContext not allowed or not supported:', e);
    }
  };

  // Subscribe to real-time scanning session
  useEffect(() => {
    setIsLoading(true);
    const sessionDocRef = doc(db, 'tagScanningSessions', `active_${store.id}`);
    
    const unsubscribe = onSnapshot(sessionDocRef, (snapshot) => {
      if (snapshot.exists()) {
        setSessionData(snapshot.data() as any);
      } else {
        setSessionData(null);
      }
      setIsLoading(false);
    }, (error) => {
      console.error("Error reading tag scanning session:", error);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [store.id]);

  // Auto focus input field on mount or when status changes
  useEffect(() => {
    if (sessionData && inputRef.current) {
      inputRef.current.focus();
    }
  }, [sessionData, scanStatus]);

  const handleStartSession = async () => {
    try {
      const sessionDocRef = doc(db, 'tagScanningSessions', `active_${store.id}`);
      const newSession = {
        id: `active_${store.id}`,
        storeId: store.id,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        scannedCounts: {}
      };
      await setDoc(sessionDocRef, newSession);
      setRecentScans([]);
      setScanStatus({ type: 'success', message: '¡Sesión de identificación de etiquetas iniciada con éxito!' });
    } catch (error) {
      console.error("Error starting session:", error);
      alert("Hubo un error al iniciar la sesión.");
    }
  };

  const handleResetSession = async () => {
    if (!window.confirm("¿Estás seguro de que deseas reiniciar la auditoría de etiquetas de esta tienda? Se perderán todos los escaneos actuales.")) {
      return;
    }
    try {
      const sessionDocRef = doc(db, 'tagScanningSessions', `active_${store.id}`);
      await deleteDoc(sessionDocRef);
      setSessionData(null);
      setRecentScans([]);
      setScanStatus({ type: null, message: '' });
    } catch (error) {
      console.error("Error resetting session:", error);
      alert("Hubo un error al reiniciar la sesión.");
    }
  };

  const handleScanSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!scanInput.trim() || !sessionData) return;

    const rawCode = scanInput.trim();
    const code = rawCode.toLowerCase();

    // Look up in inventory for matching SKU or product ID belonging to this store
    const product = inventory.find(p => 
      p.storeId === store.id && 
      ((p.sku && p.sku.toLowerCase() === code) || 
       p.id.toLowerCase() === code ||
       p.name.toLowerCase() === code)
    );

    if (!product) {
      playBeep(false);
      setScanStatus({ 
        type: 'error', 
        message: `No se encontró ningún producto con el código/SKU "${rawCode}"` 
      });
      setScanInput('');
      return;
    }

    const currentCount = sessionData.scannedCounts[product.id] || 0;
    const newCount = currentCount + 1;

    try {
      const sessionDocRef = doc(db, 'tagScanningSessions', `active_${store.id}`);
      await updateDoc(sessionDocRef, {
        [`scannedCounts.${product.id}`]: currentCount + 1,
        updatedAt: new Date().toISOString()
      });

      playBeep(true);
      setScanStatus({
        type: 'success',
        message: `✔ ${product.name} (SKU: ${product.sku}) descartado. Escaneado #${newCount}.`
      });

      // Add to local recent scans
      setRecentScans(prev => [
        {
          id: Date.now().toString(),
          productName: product.name,
          sku: product.sku || 'N/A',
          timestamp: new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
          quantity: newCount
        },
        ...prev.slice(0, 9)
      ]);
    } catch (error) {
      console.error("Error logging scan:", error);
      playBeep(false);
      setScanStatus({ type: 'error', message: "Error de red al actualizar base de datos." });
    }

    setScanInput('');
  };

  const getCategoryName = (catId: string) => {
    const cat = categories.find(c => c.id === catId);
    return cat ? cat.name : 'Sin Categoría';
  };

  // Calculations for Admin view
  const stats = useMemo(() => {
    if (!sessionData) return { totalSystemStock: 0, totalScanned: 0, totalMissing: 0, progressPercent: 0, missingProducts: [] };

    let totalSystemStock = 0;
    let totalScanned = 0;
    let totalMissing = 0;

    const missingProductsList: {
      product: Product;
      systemStock: number;
      scannedQty: number;
      missingTags: number;
    }[] = [];

    // Filter enabled products for this store
    const storeProducts = inventory.filter(p => !p.isDisabled && p.storeId === store.id);

    storeProducts.forEach(product => {
      const stock = product.stock > 0 ? product.stock : 0;
      const scanned = sessionData.scannedCounts[product.id] || 0;
      totalSystemStock += stock;
      totalScanned += scanned;

      if (scanned < stock) {
        const missing = stock - scanned;
        totalMissing += missing;
        missingProductsList.push({
          product,
          systemStock: stock,
          scannedQty: scanned,
          missingTags: missing
        });
      } else if (scanned > stock) {
        // Excedent
        missingProductsList.push({
          product,
          systemStock: stock,
          scannedQty: scanned,
          missingTags: 0 // No labels missing
        });
      }
    });

    const progressPercent = totalSystemStock > 0 
      ? Math.min(Math.round((totalScanned / totalSystemStock) * 100), 100) 
      : 0;

    return {
      totalSystemStock,
      totalScanned,
      totalMissing,
      progressPercent,
      missingProducts: missingProductsList
    };
  }, [inventory, sessionData]);

  // Open printing wizard for a single product
  const handlePrintSingle = (product: Product, missingQty: number) => {
    setProductsToPrint([product]);
    setPrintQuantities({ [product.id]: missingQty });
    setIsPrintModalOpen(true);
  };

  // Open printing wizard for ALL products with missing tags
  const handlePrintAllMissing = () => {
    const products = stats.missingProducts
      .filter(item => item.missingTags > 0)
      .map(item => item.product);

    if (products.length === 0) {
      alert("No hay etiquetas pendientes por imprimir.");
      return;
    }

    const quantities: Record<string, number> = {};
    stats.missingProducts.forEach(item => {
      if (item.missingTags > 0) {
        quantities[item.product.id] = item.missingTags;
      }
    });

    setProductsToPrint(products);
    setPrintQuantities(quantities);
    setIsPrintModalOpen(true);
  };

  return (
    <div className="space-y-6" id="tag-scanning-container">
      {/* Header section with status */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-800 p-6 rounded-3xl border border-slate-100 dark:border-slate-700/60 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 bg-accent/10 rounded-xl text-accent">
              <TagIcon className="w-6 h-6" />
            </span>
            <h2 className="text-xl font-black text-slate-800 dark:text-white uppercase tracking-tight">
              Identificación de Prendas sin Etiqueta
            </h2>
          </div>
          <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mt-2 leading-relaxed">
            Escanea las prendas físicas que sí tienen etiqueta. El sistema las descartará del inventario teórico para indicarte cuáles prendas se encuentran estancadas o perdidas por falta de etiqueta.
          </p>
        </div>

        {isAdmin && sessionData && (
          <button
            onClick={handleResetSession}
            className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border-2 border-red-200 hover:border-red-500 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 text-xs font-black uppercase tracking-wider transition-all self-start md:self-auto"
          >
            <RefreshIcon className="w-4 h-4" />
            Reiniciar Auditoría
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20 bg-white dark:bg-slate-800 rounded-3xl border border-slate-100 dark:border-slate-700/60 shadow-sm">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-accent"></div>
          <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mt-3">Cargando estado de la sesión...</p>
        </div>
      ) : !sessionData ? (
        /* Uninitialized Session View */
        <div className="flex flex-col items-center justify-center text-center p-12 bg-white dark:bg-slate-800 rounded-3xl border border-slate-100 dark:border-slate-700/60 shadow-md max-w-xl mx-auto space-y-4">
          <div className="w-16 h-16 bg-slate-50 dark:bg-slate-700/50 rounded-full flex items-center justify-center border-2 border-dashed border-slate-200 dark:border-slate-600">
            <TagIcon className="w-8 h-8 text-slate-400" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-black text-slate-800 dark:text-white uppercase tracking-tight">No hay auditoría activa</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm">
              Para comenzar a identificar prendas sin etiqueta en esta tienda, inicia una nueva sesión de escaneo presionando el botón a continuación.
            </p>
          </div>

          <button
            onClick={handleStartSession}
            className="flex items-center justify-center gap-2 w-full max-w-xs px-5 py-3 rounded-2xl bg-accent text-white hover:bg-accent-hover text-sm font-black uppercase tracking-wider shadow-lg shadow-accent/25 transition-all"
          >
            <PlayIcon className="w-4 h-4" />
            Iniciar Auditoría de Etiquetas
          </button>
        </div>
      ) : (
        /* Active Scanning Session View */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* LEFT AREA: Scanners / Form (All roles) */}
          <div className={`${isAdmin ? 'lg:col-span-5' : 'lg:col-span-12'} space-y-6`}>
            
            {/* Barcode scanner input card */}
            <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl border border-slate-100 dark:border-slate-700/60 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-slate-400 uppercase tracking-widest">
                  Escanear Mercancía
                </span>
                <span className="flex h-2.5 w-2.5 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                </span>
              </div>

              <form onSubmit={handleScanSubmit} className="space-y-3">
                <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Código de Barras / SKU / Referencia
                </label>
                <div className="relative">
                  <input
                    ref={inputRef}
                    type="text"
                    value={scanInput}
                    onChange={(e) => setScanInput(e.target.value)}
                    placeholder="Escanear o escribir código..."
                    autoFocus
                    className="w-full px-4 py-3.5 bg-slate-50 dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-700 rounded-2xl focus:border-accent dark:focus:border-accent text-slate-900 dark:text-white font-black text-sm uppercase placeholder-slate-400 outline-none transition-all pr-12"
                  />
                  <div className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400">
                    <TagIcon className="w-5 h-5" />
                  </div>
                </div>
                <button
                  type="submit"
                  className="w-full py-3 bg-slate-900 hover:bg-slate-850 dark:bg-slate-700 dark:hover:bg-slate-600 text-white font-black text-xs uppercase tracking-wider rounded-2xl transition-all shadow-sm"
                >
                  Registrar Escaneo
                </button>
              </form>

              {/* Real-time scanning feedback */}
              {scanStatus.type && (
                <div 
                  className={`p-4 rounded-2xl text-xs font-bold leading-relaxed border flex gap-3 items-start animate-fade-in
                    ${scanStatus.type === 'success' 
                      ? 'bg-emerald-50 dark:bg-emerald-950/20 text-emerald-800 dark:text-emerald-300 border-emerald-100 dark:border-emerald-900/50' 
                      : 'bg-rose-50 dark:bg-rose-950/20 text-rose-800 dark:text-rose-300 border-rose-100 dark:border-rose-900/50'}`}
                >
                  <span className="text-base mt-0.5">{scanStatus.type === 'success' ? '✔' : '❌'}</span>
                  <div>
                    <p className="font-black">{scanStatus.type === 'success' ? 'Escaneado Correctamente' : 'Fallo de Lectura'}</p>
                    <p className="opacity-90 mt-0.5">{scanStatus.message}</p>
                  </div>
                </div>
              )}
            </div>

            {/* List of recent scans */}
            <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl border border-slate-100 dark:border-slate-700/60 shadow-sm space-y-4">
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">
                Tus Escaneos Recientes
              </h3>
              
              {recentScans.length === 0 ? (
                <p className="text-xs font-bold text-slate-400 dark:text-slate-500 text-center py-6">
                  Aún no has escaneado ninguna prenda en esta sesión.
                </p>
              ) : (
                <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                  {recentScans.map((scan) => (
                    <div 
                      key={scan.id} 
                      className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-100 dark:border-slate-800 animate-slide-in-right"
                    >
                      <div className="min-w-0 pr-2">
                        <p className="text-xs font-black text-slate-700 dark:text-slate-300 truncate">{scan.productName}</p>
                        <p className="text-[10px] text-slate-400 font-bold mt-0.5">SKU: {scan.sku}</p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <span className="inline-block bg-accent/10 text-accent font-black text-[10px] px-2 py-0.5 rounded-full">
                          #{scan.quantity}
                        </span>
                        <p className="text-[9px] text-slate-400 font-bold mt-0.5">{scan.timestamp}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>

          {/* RIGHT AREA: Admin Stats & Table (Only shown for administrators) */}
          {isAdmin && (
            <div className="lg:col-span-7 space-y-6">
              {/* Admin Full Dashboard */}
              <div className="space-y-6">
                
                {/* Stats Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm flex flex-col justify-between">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Prendas en Sistema</p>
                    <div className="flex items-baseline gap-1 mt-2">
                      <span className="text-2xl font-black text-slate-800 dark:text-white">{stats.totalSystemStock}</span>
                      <span className="text-[9px] font-bold text-slate-400">teóricas</span>
                    </div>
                  </div>

                  <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm flex flex-col justify-between">
                    <p className="text-[10px] font-black text-indigo-500 uppercase tracking-widest">Prendas Escaneadas</p>
                    <div className="flex items-baseline gap-1 mt-2">
                      <span className="text-2xl font-black text-indigo-600 dark:text-indigo-400">{stats.totalScanned}</span>
                      <span className="text-[9px] font-bold text-indigo-500">físicas con etiqueta</span>
                    </div>
                  </div>

                  <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm flex flex-col justify-between">
                    <p className="text-[10px] font-black text-red-500 uppercase tracking-widest">Faltantes de Etiqueta</p>
                    <div className="flex items-baseline gap-1 mt-2">
                      <span className="text-2xl font-black text-red-500">{stats.totalMissing}</span>
                      <span className="text-[9px] font-bold text-red-500">sin etiqueta</span>
                    </div>
                  </div>
                </div>

                {/* Progress bar card */}
                <div className="bg-white dark:bg-slate-800 p-5 rounded-3xl border border-slate-100 dark:border-slate-700 shadow-sm space-y-3">
                  <div className="flex items-center justify-between text-xs font-black text-slate-700 dark:text-slate-200 uppercase tracking-tight">
                    <span>Avance de Identificación (Prendas Escaneadas)</span>
                    <span className="text-accent">{stats.progressPercent}%</span>
                  </div>
                  <div className="w-full bg-slate-100 dark:bg-slate-900 rounded-full h-3.5 overflow-hidden">
                    <div 
                      className="bg-accent h-full rounded-full transition-all duration-500 ease-out"
                      style={{ width: `${stats.progressPercent}%` }}
                    ></div>
                  </div>
                </div>

                {/* Main Table for administrators */}
                <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-100 dark:border-slate-700 shadow-sm overflow-hidden space-y-4 p-6">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-tight">
                        Prendas Pendientes de Etiqueta ({stats.missingProducts.filter(item => item.missingTags > 0).length})
                      </h3>
                      <p className="text-[10px] text-slate-400 font-bold mt-1">Prendas cuyo stock del sistema supera los escaneos físicos realizados.</p>
                    </div>

                    <button
                      onClick={handlePrintAllMissing}
                      disabled={stats.totalMissing === 0}
                      className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all
                        ${stats.totalMissing === 0
                          ? 'bg-slate-100 dark:bg-slate-700 text-slate-400 cursor-not-allowed'
                          : 'bg-accent hover:bg-accent-hover text-white shadow-md shadow-accent/20'}`}
                    >
                      🖨️ Imprimir Todas las Faltantes
                    </button>
                  </div>

                  {stats.missingProducts.length === 0 ? (
                    <div className="text-center py-12 text-slate-400 dark:text-slate-500 font-bold text-xs">
                      🎉 ¡Felicidades! Todo el inventario de esta sede ha sido escaneado. No hay prendas sin etiqueta pendientes.
                    </div>
                  ) : (
                    <div className="overflow-x-auto max-h-[450px] overflow-y-auto border border-slate-100 dark:border-slate-700 rounded-2xl">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-slate-50 dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                            <th className="p-3">SKU / Prenda</th>
                            <th className="p-3">Categoría</th>
                            <th className="p-3 text-center">Stock</th>
                            <th className="p-3 text-center">Escaneado</th>
                            <th className="p-3 text-center text-red-500">Faltante</th>
                            <th className="p-3 text-right">Acciones</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50 dark:divide-slate-800 text-xs">
                          {stats.missingProducts.map(({ product, systemStock, scannedQty, missingTags }) => (
                            <tr key={product.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-700/10">
                              <td className="p-3">
                                <p className="font-black text-slate-800 dark:text-white truncate max-w-[150px]">{product.name}</p>
                                <p className="text-[10px] text-slate-400 font-bold mt-0.5">{product.sku || 'Sin SKU'}</p>
                              </td>
                              <td className="p-3 text-slate-500 font-bold dark:text-slate-400">
                                {getCategoryName(product.categoryId)}
                              </td>
                              <td className="p-3 text-center font-black text-slate-700 dark:text-slate-300">
                                {systemStock}
                              </td>
                              <td className="p-3 text-center font-black text-indigo-500">
                                {scannedQty}
                              </td>
                              <td className="p-3 text-center font-black">
                                {scannedQty > systemStock ? (
                                  <span className="inline-block px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-500 text-[9px]">
                                    +{scannedQty - systemStock} Excedente
                                  </span>
                                ) : (
                                  <span className="text-red-500 font-black bg-red-500/10 px-1.5 py-0.5 rounded text-[10px]">
                                    {missingTags}
                                  </span>
                                )}
                              </td>
                              <td className="p-3 text-right">
                                {missingTags > 0 ? (
                                  <button
                                    onClick={() => handlePrintSingle(product, missingTags)}
                                    className="p-1.5 bg-accent/10 hover:bg-accent hover:text-white text-accent rounded-lg transition-all"
                                    title="Imprimir etiquetas faltantes"
                                  >
                                    🖨️ <span className="text-[9px] font-black uppercase ml-1">Imprimir ({missingTags})</span>
                                  </button>
                                ) : (
                                  <span className="text-[10px] text-slate-400 font-bold">Sin faltantes</span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                </div>

              </div>
            </div>
          )}

        </div>
      )}

      {/* Embedded LabelPrintModal for Admins */}
      {isAdmin && isPrintModalOpen && (
        <LabelPrintModal
          isOpen={isPrintModalOpen}
          onClose={() => setIsPrintModalOpen(false)}
          selectedProducts={productsToPrint}
          store={store}
          initialQuantities={printQuantities}
        />
      )}
    </div>
  );
};
