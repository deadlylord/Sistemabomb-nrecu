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
  CheckIcon, TagIcon, SparklesIcon, PackageIcon, AlertTriangleIcon, RefreshIcon, PlayIcon, CameraIcon, SearchIcon, CrossIcon, TrashIcon
} from './Icons';
import { formatCOP } from '../constants';
import { LabelPrintModal } from './LabelPrintModal';
import { Html5Qrcode } from 'html5-qrcode';

interface TagScanningViewProps {
  inventory: Product[];
  store: Store;
  currentUser: Seller;
  categories: Category[];
  isAdmin: boolean;
}

interface RecentScan {
  id: string;
  productId?: string;
  productName: string;
  sku: string;
  timestamp: string;
  quantity: number;
}

export interface LooseTagCheckResult {
  id: string;
  scannedCode: string;
  timestamp: string;
  status: 'NOT_IN_SYSTEM' | 'NEEDED' | 'SURPLUS';
  productName?: string;
  sku?: string;
  systemStock?: number;
  scannedQty?: number;
  missingTags?: number;
  notes?: string;
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
    pendingTagCounts?: Record<string, number>;
    scanHistory?: RecentScan[];
  } | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [scanInput, setScanInput] = useState('');
  const [recentScans, setRecentScans] = useState<RecentScan[]>([]);
  const [scanStatus, setScanStatus] = useState<{ type: 'success' | 'error' | null; message: string }>({
    type: null,
    message: ''
  });

  // Unknown Code Alert state
  const [unknownCodeAlert, setUnknownCodeAlert] = useState<string | null>(null);

  // Loose Tag Inspector state
  const [isLooseTagsModalOpen, setIsLooseTagsModalOpen] = useState(false);
  const [looseTagInput, setLooseTagInput] = useState('');
  const [looseTagChecks, setLooseTagChecks] = useState<LooseTagCheckResult[]>([]);
  const [lastLooseTagResult, setLastLooseTagResult] = useState<LooseTagCheckResult | null>(null);
  const [looseTagFilter, setLooseTagFilter] = useState<'ALL' | 'NEEDED' | 'SURPLUS' | 'NOT_IN_SYSTEM'>('ALL');
  const looseTagInputRef = useRef<HTMLInputElement>(null);

  // Filter by category state
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('all');

  // Wrong Tag Modal state
  const [isWrongTagModalOpen, setIsWrongTagModalOpen] = useState(false);
  const [wrongTagProductId, setWrongTagProductId] = useState<string>('');
  const [correctTagSearch, setCorrectTagSearch] = useState<string>('');
  const [selectedCorrectProduct, setSelectedCorrectProduct] = useState<Product | null>(null);
  const [wrongTagQty, setWrongTagQty] = useState<number>(1);

  // Camera Scanner State
  const [scanQuantity, setScanQuantity] = useState<number>(1);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const lastScannedCodeRef = useRef<{ code: string; time: number }>({ code: '', time: 0 });
  const html5QrcodeRef = useRef<Html5Qrcode | null>(null);

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
        const data = snapshot.data() as any;
        setSessionData(data);
        if (data.scanHistory && Array.isArray(data.scanHistory)) {
          setRecentScans(data.scanHistory);
          try {
            localStorage.setItem(`tag_scans_${store.id}`, JSON.stringify(data.scanHistory));
          } catch (e) {}
        } else {
          const saved = localStorage.getItem(`tag_scans_${store.id}`);
          if (saved) {
            try { setRecentScans(JSON.parse(saved)); } catch (e) {}
          }
        }
      } else {
        setSessionData(null);
        setRecentScans([]);
        localStorage.removeItem(`tag_scans_${store.id}`);
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
    if (sessionData && inputRef.current && !isCameraActive) {
      inputRef.current.focus();
    }
  }, [sessionData, scanStatus, isCameraActive]);

  const handleStartSession = async () => {
    try {
      const sessionDocRef = doc(db, 'tagScanningSessions', `active_${store.id}`);
      const newSession = {
        id: `active_${store.id}`,
        storeId: store.id,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        scannedCounts: {},
        pendingTagCounts: {},
        scanHistory: []
      };
      await setDoc(sessionDocRef, newSession);
      setRecentScans([]);
      localStorage.removeItem(`tag_scans_${store.id}`);
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
      localStorage.removeItem(`tag_scans_${store.id}`);
      setIsCameraActive(false);
      setScanStatus({ type: null, message: '' });
    } catch (error) {
      console.error("Error resetting session:", error);
      alert("Hubo un error al reiniciar la sesión.");
    }
  };

  // Core code processing logic (used both by manual input, barcode gun, and camera scan)
  const processCode = async (rawCode: string, overrideQty?: number) => {
    if (!rawCode.trim() || !sessionData) return;

    let qtyToAdd = overrideQty ?? scanQuantity;
    let cleanCode = rawCode.trim();

    // Support multiplier notation directly in text input (e.g. "5*SKU123", "SKU123*5", "5xSKU123")
    if (cleanCode.includes('*')) {
      const parts = cleanCode.split('*');
      if (parts.length === 2) {
        if (!isNaN(Number(parts[0])) && Number(parts[0]) > 0) {
          qtyToAdd = Math.floor(Number(parts[0]));
          cleanCode = parts[1].trim();
        } else if (!isNaN(Number(parts[1])) && Number(parts[1]) > 0) {
          qtyToAdd = Math.floor(Number(parts[1]));
          cleanCode = parts[0].trim();
        }
      }
    } else if (cleanCode.toLowerCase().includes('x') && /^\d+x/i.test(cleanCode)) {
      const parts = cleanCode.split(/x/i);
      if (parts.length === 2 && !isNaN(Number(parts[0])) && Number(parts[0]) > 0) {
        qtyToAdd = Math.floor(Number(parts[0]));
        cleanCode = parts[1].trim();
      }
    }

    if (!qtyToAdd || qtyToAdd < 1) qtyToAdd = 1;

    const code = cleanCode.toLowerCase();

    // Look up in inventory for matching SKU or product ID belonging to this store
    const product = inventory.find(p => 
      p.storeId === store.id && 
      ((p.sku && p.sku.toLowerCase() === code) || 
       (p.id && p.id.toLowerCase() === code) ||
       (p.name && p.name.toLowerCase() === code))
    );

    if (!product) {
      playBeep(false);

      // Check if code exists in another store
      const productInOtherStore = inventory.find(p => 
        (p.sku && p.sku.toLowerCase() === code) || 
        (p.id && p.id.toLowerCase() === code) ||
        (p.name && p.name.toLowerCase() === code)
      );

      let warnMessage = `🚨 ¡CÓDIGO/PRODUCTO NO EXISTE EN EL SISTEMA! No se encontró ninguna prenda en ${store.name} con el código "${cleanCode}".`;
      if (productInOtherStore) {
        warnMessage += ` ⚠️ Nota: Esta prenda ("${productInOtherStore.name}") pertenece a OTRA sede (Tienda ID: ${productInOtherStore.storeId}).`;
      }

      setScanStatus({ 
        type: 'error', 
        message: warnMessage 
      });

      setUnknownCodeAlert(cleanCode);
      setScanInput('');
      return;
    }

    const currentCount = sessionData.scannedCounts[product.id] || 0;
    const newCount = currentCount + qtyToAdd;

    const newScanEntry: RecentScan = {
      id: `${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      productId: product.id,
      productName: product.name,
      sku: product.sku || 'N/A',
      timestamp: new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      quantity: newCount
    };

    const currentHistory = sessionData.scanHistory || recentScans || [];
    const updatedHistory = [newScanEntry, ...currentHistory].slice(0, 100);

    try {
      const sessionDocRef = doc(db, 'tagScanningSessions', `active_${store.id}`);
      await updateDoc(sessionDocRef, {
        [`scannedCounts.${product.id}`]: newCount,
        scanHistory: updatedHistory,
        updatedAt: new Date().toISOString()
      });

      playBeep(true);
      setScanStatus({
        type: 'success',
        message: `✔ ${product.name} (SKU: ${product.sku || 'N/A'}): +${qtyToAdd} ${qtyToAdd === 1 ? 'unidad' : 'unidades'} sumada(s). Total escaneado: #${newCount}.`
      });

      setRecentScans(updatedHistory);
      try {
        localStorage.setItem(`tag_scans_${store.id}`, JSON.stringify(updatedHistory));
      } catch (e) {}
    } catch (error) {
      console.error("Error logging scan:", error);
      playBeep(false);
      setScanStatus({ type: 'error', message: "Error de red al actualizar base de datos." });
    }

    setScanInput('');
  };

  // Handler for checking loose tags
  const handleCheckLooseTag = (codeToTest: string) => {
    if (!codeToTest.trim()) return;
    const cleanCode = codeToTest.trim();
    const code = cleanCode.toLowerCase();
    const timestamp = new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    // Find in current store
    const product = inventory.find(p => 
      p.storeId === store.id && 
      ((p.sku && p.sku.toLowerCase() === code) || 
       (p.id && p.id.toLowerCase() === code) ||
       (p.name && p.name.toLowerCase() === code))
    );

    if (!product) {
      const productInOtherStore = inventory.find(p => 
        (p.sku && p.sku.toLowerCase() === code) || 
        (p.id && p.id.toLowerCase() === code) ||
        (p.name && p.name.toLowerCase() === code)
      );
      playBeep(false);

      const resultItem: LooseTagCheckResult = {
        id: `${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        scannedCode: cleanCode,
        timestamp,
        status: 'NOT_IN_SYSTEM',
        productName: productInOtherStore ? `[Otra Sede] ${productInOtherStore.name}` : 'NO REGISTRADO EN EL SISTEMA',
        sku: cleanCode,
        notes: productInOtherStore 
          ? `🚨 La etiqueta pertenece a otra sede (Tienda ID: ${productInOtherStore.storeId}), no a ${store.name}.`
          : `🚨 ¡Etiqueta Desconocida! El código/SKU no existe en la base de datos de esta tienda.`
      };

      setLastLooseTagResult(resultItem);
      setLooseTagChecks(prev => [resultItem, ...prev]);
      setLooseTagInput('');
      if (looseTagInputRef.current) looseTagInputRef.current.focus();
      return;
    }

    // Product exists in current store
    const systemStock = product.stock > 0 ? product.stock : 0;
    const scannedQty = sessionData?.scannedCounts[product.id] || 0;
    const pendingTagQty = sessionData?.pendingTagCounts?.[product.id] || 0;
    
    // Total missing tags = missing from stock + pending relabeling
    const missingFromStock = Math.max(0, systemStock - scannedQty);
    const totalMissingTags = missingFromStock + pendingTagQty;

    if (totalMissingTags > 0) {
      playBeep(true);
      const resultItem: LooseTagCheckResult = {
        id: `${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        scannedCode: cleanCode,
        timestamp,
        status: 'NEEDED',
        productName: product.name,
        sku: product.sku || cleanCode,
        systemStock,
        scannedQty,
        missingTags: totalMissingTags,
        notes: `🟢 ¡ETIQUETA ÚTIL Y NECESARIA! Para la prenda "${product.name}" hacen falta ${totalMissingTags} etiqueta(s) en tienda. Puedes pegársela a una prenda física.`
      };
      setLastLooseTagResult(resultItem);
      setLooseTagChecks(prev => [resultItem, ...prev]);
    } else {
      playBeep(false);
      const resultItem: LooseTagCheckResult = {
        id: `${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        scannedCode: cleanCode,
        timestamp,
        status: 'SURPLUS',
        productName: product.name,
        sku: product.sku || cleanCode,
        systemStock,
        scannedQty,
        missingTags: 0,
        notes: `⚠️ ETIQUETA SOBRANTE / HUÉRFANA. Para "${product.name}" ya todas las ${systemStock} prendas en tienda están etiquetadas o el stock es 0. Esta etiqueta no hace falta.`
      };
      setLastLooseTagResult(resultItem);
      setLooseTagChecks(prev => [resultItem, ...prev]);
    }

    setLooseTagInput('');
    if (looseTagInputRef.current) looseTagInputRef.current.focus();
  };

  // Remove/undo a scan count for a product
  const handleRemoveScanCount = async (productId: string, qtyToRemove: number = 1) => {
    if (!sessionData) return;
    const product = inventory.find(p => p.id === productId);
    const currentCount = sessionData.scannedCounts[productId] || 0;
    if (currentCount <= 0) return;

    const newCount = Math.max(0, currentCount - qtyToRemove);
    const currentHistory = sessionData.scanHistory || recentScans || [];
    const updatedHistory = currentHistory.filter(s => s.productId !== productId);

    try {
      const sessionDocRef = doc(db, 'tagScanningSessions', `active_${store.id}`);
      await updateDoc(sessionDocRef, {
        [`scannedCounts.${productId}`]: newCount,
        scanHistory: updatedHistory,
        updatedAt: new Date().toISOString()
      });

      playBeep(false);
      setScanStatus({
        type: 'success',
        message: `✔ Se descontó ${qtyToRemove} escaneo de "${product?.name || 'Prenda'}". Total escaneado ahora: #${newCount}.`
      });

      setRecentScans(updatedHistory);
      try {
        localStorage.setItem(`tag_scans_${store.id}`, JSON.stringify(updatedHistory));
      } catch (e) {}
    } catch (err) {
      console.error("Error removing scan count:", err);
      alert("No se pudo deshacer el escaneo.");
    }
  };

  // Open Wrong Tag correction modal
  const handleOpenWrongTagModal = (wrongProdId?: string) => {
    setWrongTagProductId(wrongProdId || '');
    setCorrectTagSearch('');
    setSelectedCorrectProduct(null);
    setWrongTagQty(1);
    setIsWrongTagModalOpen(true);
  };

  // Search results for correct product selection in Wrong Tag Modal
  const filteredCorrectProducts = useMemo(() => {
    if (!correctTagSearch.trim()) return [];
    const q = correctTagSearch.toLowerCase().trim();
    return inventory
      .filter(p => !p.isDisabled && p.storeId === store.id)
      .filter(p => 
        (p.name && p.name.toLowerCase().includes(q)) ||
        (p.sku && p.sku.toLowerCase().includes(q)) ||
        (p.id && p.id.toLowerCase().includes(q))
      )
      .slice(0, 8);
  }, [inventory, store.id, correctTagSearch]);

  // Submit Wrong Tag report / correction
  const handleReportWrongTagSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sessionData) return;

    if (!selectedCorrectProduct) {
      alert("Por favor busca y selecciona la prenda física real que tienes en las manos.");
      return;
    }

    const qty = Math.max(1, wrongTagQty);
    const correctId = selectedCorrectProduct.id;
    const wrongId = wrongTagProductId;

    try {
      const sessionDocRef = doc(db, 'tagScanningSessions', `active_${store.id}`);
      const updates: any = {
        updatedAt: new Date().toISOString()
      };

      // 1. Decrement wrong product scan count if a wrong product was selected
      if (wrongId && sessionData.scannedCounts[wrongId]) {
        const currentWrong = sessionData.scannedCounts[wrongId] || 0;
        updates[`scannedCounts.${wrongId}`] = Math.max(0, currentWrong - qty);
      }

      // 2. Increment correct product scan count (counts as physically present in physical inventory!)
      const currentCorrectScanned = sessionData.scannedCounts[correctId] || 0;
      updates[`scannedCounts.${correctId}`] = currentCorrectScanned + qty;

      // 3. Increment correct product pendingTagCounts (flagged as pending a correct tag!)
      const currentPending = sessionData.pendingTagCounts?.[correctId] || 0;
      updates[`pendingTagCounts.${correctId}`] = currentPending + qty;

      // 4. Update scanHistory log in Firestore
      const newScanItem: RecentScan = {
        id: `${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        productId: correctId,
        productName: `⚠️ [Corr. Etiqueta] ${selectedCorrectProduct.name}`,
        sku: selectedCorrectProduct.sku || 'N/A',
        timestamp: new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        quantity: qty
      };
      const currentHistory = sessionData.scanHistory || recentScans || [];
      const updatedHistory = [newScanItem, ...currentHistory].slice(0, 100);
      updates.scanHistory = updatedHistory;

      await updateDoc(sessionDocRef, updates);

      playBeep(true);
      const wrongProductObj = inventory.find(p => p.id === wrongId);
      const wrongName = wrongProductObj ? wrongProductObj.name : 'Etiqueta Errónea';

      setScanStatus({
        type: 'success',
        message: `✔ CORRECCIÓN REGISTRADA: ${wrongId ? `Se descontaron ${qty} un. a "${wrongName}" y ` : ''}se sumó "${selectedCorrectProduct.name}" a las prendas físicas identificadas (MARCADA COMO PENDIENTE DE NUEVA ETIQUETA 🏷️).`
      });

      setRecentScans(updatedHistory);
      try {
        localStorage.setItem(`tag_scans_${store.id}`, JSON.stringify(updatedHistory));
      } catch (e) {}

      // Reset & close modal
      setIsWrongTagModalOpen(false);
      setWrongTagProductId('');
      setCorrectTagSearch('');
      setSelectedCorrectProduct(null);
      setWrongTagQty(1);

    } catch (err) {
      console.error("Error submitting wrong tag report:", err);
      alert("Ocurrió un error al procesar la corrección de etiqueta.");
    }
  };

  const handleScanSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    processCode(scanInput);
  };

  // Camera Scanner Lifecycle
  useEffect(() => {
    let isMounted = true;

    if (isCameraActive && sessionData) {
      // Small timeout to allow DOM element #reader-camera-tags to be rendered
      const timer = setTimeout(() => {
        if (!isMounted) return;
        try {
          const html5Qrcode = new Html5Qrcode("reader-camera-tags");
          html5QrcodeRef.current = html5Qrcode;

          const config = { 
            fps: 12, 
            qrbox: { width: 260, height: 180 },
            aspectRatio: 1.0 
          };

          html5Qrcode.start(
            { facingMode: "environment" },
            config,
            (decodedText) => {
              if (!isMounted) return;
              const now = Date.now();
              // Prevent rapid multi-scans of the same item within 2 seconds
              if (
                lastScannedCodeRef.current.code === decodedText &&
                now - lastScannedCodeRef.current.time < 2000
              ) {
                return;
              }
              // Prevent scanning different items faster than 1 second
              if (now - lastScannedCodeRef.current.time < 1000) {
                return;
              }

              lastScannedCodeRef.current = { code: decodedText, time: now };
              
              // Automatically register immediately!
              processCode(decodedText);
            },
            () => {
              // Frame decoding noise ignored
            }
          ).catch(err => {
            console.error("Camera start error:", err);
            if (isMounted) {
              setScanStatus({
                type: 'error',
                message: 'No se pudo acceder a la cámara. Revisa los permisos en tu navegador.'
              });
              setIsCameraActive(false);
            }
          });
        } catch (err) {
          console.error("Html5Qrcode initialization error:", err);
        }
      }, 200);

      return () => {
        isMounted = false;
        clearTimeout(timer);
        if (html5QrcodeRef.current) {
          if (html5QrcodeRef.current.isScanning) {
            html5QrcodeRef.current.stop().then(() => {
              html5QrcodeRef.current?.clear();
            }).catch(e => console.error("Camera stop error:", e));
          } else {
            try { html5QrcodeRef.current.clear(); } catch(e) {}
          }
        }
      };
    }
  }, [isCameraActive, sessionData]);

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
      pendingTagQty: number;
      missingTags: number;
    }[] = [];

    // Filter enabled products for this store and category filter
    const storeProducts = inventory.filter(p => {
      if (p.isDisabled || p.storeId !== store.id) return false;
      if (selectedCategoryId !== 'all' && p.categoryId !== selectedCategoryId) return false;
      return true;
    });

    storeProducts.forEach(product => {
      const stock = product.stock > 0 ? product.stock : 0;
      const scanned = sessionData.scannedCounts[product.id] || 0;
      const pendingTagQty = sessionData.pendingTagCounts?.[product.id] || 0;

      totalSystemStock += stock;
      totalScanned += scanned;

      const missingFromStock = Math.max(0, stock - scanned);
      const missing = missingFromStock + pendingTagQty;

      totalMissing += missingFromStock + pendingTagQty;

      if (missing > 0 || scanned !== stock || pendingTagQty > 0) {
        missingProductsList.push({
          product,
          systemStock: stock,
          scannedQty: scanned,
          pendingTagQty,
          missingTags: missing
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
  }, [inventory, sessionData, selectedCategoryId, store.id]);

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
        <div className="space-y-6">
          {/* Category Filter Bar */}
          <div className="bg-white dark:bg-slate-800 p-4 rounded-3xl border border-slate-100 dark:border-slate-700/60 shadow-sm space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xs">🏷️</span>
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  Filtrar Auditoría por Categoría:
                </span>
              </div>
              {selectedCategoryId !== 'all' && (
                <button 
                  type="button" 
                  onClick={() => setSelectedCategoryId('all')}
                  className="text-[10px] font-black text-accent hover:underline flex items-center gap-1"
                >
                  <span>Ver Todas las Categorías</span>
                </button>
              )}
            </div>
            <div className="flex items-center gap-2 overflow-x-auto pb-1.5 pt-1 scrollbar-thin">
              <button
                type="button"
                onClick={() => setSelectedCategoryId('all')}
                className={`px-3.5 py-1.5 rounded-xl font-black text-xs whitespace-nowrap transition-all ${
                  selectedCategoryId === 'all'
                    ? 'bg-slate-900 text-white dark:bg-accent dark:text-white shadow-sm ring-2 ring-accent/30'
                    : 'bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800'
                }`}
              >
                Todas las Categorías ({inventory.filter(p => !p.isDisabled && p.storeId === store.id).length})
              </button>
              {categories.map((cat) => {
                const count = inventory.filter(p => !p.isDisabled && p.storeId === store.id && p.categoryId === cat.id).length;
                if (count === 0) return null;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setSelectedCategoryId(cat.id)}
                    className={`px-3.5 py-1.5 rounded-xl font-black text-xs whitespace-nowrap transition-all ${
                      selectedCategoryId === cat.id
                        ? 'bg-accent text-white shadow-sm ring-2 ring-accent/30'
                        : 'bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800'
                    }`}
                  >
                    {cat.name} ({count})
                  </button>
                );
              })}
            </div>
          </div>

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

              {/* Scanner Control Buttons: Camera & Loose Tag Verifier */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setIsCameraActive(!isCameraActive)}
                  className={`w-full py-3 px-3 rounded-2xl font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all shadow-md ${
                    isCameraActive 
                      ? 'bg-rose-500 hover:bg-rose-600 text-white' 
                      : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                  }`}
                >
                  <CameraIcon className="w-4 h-4" />
                  <span>{isCameraActive ? 'Cerrar Cámara' : 'Cámara Celular'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setIsLooseTagsModalOpen(true);
                    setTimeout(() => looseTagInputRef.current?.focus(), 120);
                  }}
                  className="w-full py-3 px-3 bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-300 rounded-2xl font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all border border-amber-500/30 shadow-sm"
                >
                  <span>🔎 Inspector Etiquetas Sueltas</span>
                </button>
              </div>

              {/* Camera Scanner Live Container */}
              {isCameraActive && (
                <div className="space-y-2 bg-slate-900 p-3.5 rounded-2xl border border-slate-700 animate-fade-in">
                  <div className="flex items-center justify-between text-[10px] font-bold text-emerald-400 uppercase tracking-wider px-1">
                    <span>Cámara Activa</span>
                    <span className="animate-pulse">Escanear directo ⚡</span>
                  </div>
                  <div 
                    id="reader-camera-tags" 
                    className="overflow-hidden rounded-xl border border-slate-700 bg-black min-h-[220px]"
                  />
                  <p className="text-[10px] text-slate-300 text-center font-bold leading-tight">
                    Apunta la cámara a la etiqueta. La prenda se agregará <span className="text-emerald-400">directamente</span> sin presionar botones.
                  </p>
                </div>
              )}

              {/* Quantity Selector Control */}
              <div className="p-3 bg-slate-50 dark:bg-slate-900/60 rounded-2xl border border-slate-200 dark:border-slate-700/60 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-black uppercase tracking-wider text-slate-600 dark:text-slate-300">
                    Cantidad a sumar por cada escaneo:
                  </label>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        setScanQuantity(prev => Math.max(1, prev - 1));
                        if (inputRef.current) inputRef.current.focus();
                      }}
                      className="w-7 h-7 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 rounded-lg text-slate-800 dark:text-white font-black text-sm flex items-center justify-center transition-colors"
                      title="Disminuir cantidad"
                    >
                      -
                    </button>
                    <input
                      type="number"
                      min="1"
                      value={scanQuantity}
                      onChange={(e) => setScanQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-12 py-1 text-center font-black text-xs bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white outline-none focus:ring-1 focus:ring-accent"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setScanQuantity(prev => prev + 1);
                        if (inputRef.current) inputRef.current.focus();
                      }}
                      className="w-7 h-7 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 rounded-lg text-slate-800 dark:text-white font-black text-sm flex items-center justify-center transition-colors"
                      title="Aumentar cantidad"
                    >
                      +
                    </button>
                  </div>
                </div>

                {/* Quick preset buttons */}
                <div className="grid grid-cols-7 gap-1">
                  {[1, 2, 3, 5, 10, 15, 20].map((num) => (
                    <button
                      key={num}
                      type="button"
                      onClick={() => {
                        setScanQuantity(num);
                        if (inputRef.current) inputRef.current.focus();
                      }}
                      className={`py-1 rounded-lg font-black text-[10px] transition-all text-center ${
                        scanQuantity === num
                          ? 'bg-accent text-white shadow-sm ring-2 ring-accent/30'
                          : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700'
                      }`}
                    >
                      {num}u
                    </button>
                  ))}
                </div>
              </div>

              <form onSubmit={handleScanSubmit} className="space-y-3 pt-1">
                <div className="flex items-center justify-between">
                  <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Código de Barras / Pistola / SKU
                  </label>
                  <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500">
                    Suma actual: <strong className="text-accent">{scanQuantity} un.</strong>
                  </span>
                </div>

                <div className="relative">
                  <input
                    ref={inputRef}
                    type="text"
                    value={scanInput}
                    onChange={(e) => setScanInput(e.target.value)}
                    placeholder="Escanear con pistola o escribir..."
                    autoFocus
                    className="w-full px-4 py-3.5 bg-slate-50 dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-700 rounded-2xl focus:border-accent dark:focus:border-accent text-slate-900 dark:text-white font-black text-sm uppercase placeholder-slate-400 outline-none transition-all pr-12"
                  />
                  <div className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400">
                    <TagIcon className="w-5 h-5" />
                  </div>
                </div>

                <p className="text-[10px] text-slate-400 dark:text-slate-500 font-medium">
                  💡 <strong>Tip con pistola:</strong> Puedes digitar directamente por ejemplo <code className="bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded text-accent">5*CÓDIGO</code> o <code className="bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded text-accent">3xCÓDIGO</code> + Enter para registrar varias unidades a la vez.
                </p>

                <button
                  type="submit"
                  className="w-full py-3 bg-slate-900 hover:bg-slate-850 dark:bg-slate-700 dark:hover:bg-slate-600 text-white font-black text-xs uppercase tracking-wider rounded-2xl transition-all shadow-sm flex items-center justify-center gap-2"
                >
                  <span>Registrar Escaneo (+{scanQuantity})</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleOpenWrongTagModal()}
                  className="w-full py-2.5 px-3 bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-300 font-black text-[11px] uppercase tracking-wider rounded-2xl border border-amber-500/30 flex items-center justify-center gap-2 transition-all"
                >
                  <span>⚠️ ¿Etiqueta Equivocada en Prenda? Reportar Aquí</span>
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
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                  <span>Tus Escaneos Recientes</span>
                  <span className="bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded-full text-[10px]">
                    {recentScans.length}
                  </span>
                </h3>
                <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  Guardado permanente
                </span>
              </div>
              
              {recentScans.length === 0 ? (
                <p className="text-xs font-bold text-slate-400 dark:text-slate-500 text-center py-6">
                  Aún no has escaneado ninguna prenda en esta sesión.
                </p>
              ) : (
                <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1 custom-scrollbar">
                  {recentScans.map((scan) => (
                    <div 
                      key={scan.id} 
                      className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-100 dark:border-slate-800 animate-slide-in-right gap-2"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-black text-slate-700 dark:text-slate-300 truncate">{scan.productName}</p>
                        <p className="text-[10px] text-slate-400 font-bold mt-0.5">SKU: {scan.sku} • {scan.timestamp}</p>
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        {scan.productId && (
                          <>
                            <button
                              type="button"
                              onClick={() => handleOpenWrongTagModal(scan.productId)}
                              className="px-2 py-1 bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 text-[10px] font-black rounded-lg transition-colors flex items-center gap-1"
                              title="Reportar que esta etiqueta pertenece a otra prenda"
                            >
                              <span>⚠️ Mala</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRemoveScanCount(scan.productId!, 1)}
                              className="p-1 bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 rounded-lg transition-colors"
                              title="Deshacer / eliminar 1 escaneo"
                            >
                              <TrashIcon className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}
                        <span className="inline-block bg-accent/10 text-accent font-black text-[10px] px-2 py-0.5 rounded-full">
                          #{scan.quantity}
                        </span>
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
                          {stats.missingProducts.map(({ product, systemStock, scannedQty, pendingTagQty, missingTags }) => (
                            <tr key={product.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-700/10">
                              <td className="p-3">
                                <p className="font-black text-slate-800 dark:text-white truncate max-w-[150px]">{product.name}</p>
                                <p className="text-[10px] text-slate-400 font-bold mt-0.5">{product.sku || 'Sin SKU'}</p>
                                {pendingTagQty > 0 && (
                                  <span className="inline-block mt-1 px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400 text-[9px] font-black border border-amber-500/20">
                                    ⚠️ {pendingTagQty} {pendingTagQty === 1 ? 'etiqueta errónea reportada' : 'etiquetas erróneas reportadas'}
                                  </span>
                                )}
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
        </div>
      )}

      {/* Modal for Reporting Wrong Tag / Re-labeling */}
      {isWrongTagModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in overflow-y-auto">
          <div className="bg-white dark:bg-slate-800 rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 dark:border-slate-700 space-y-5 my-8">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700/60 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center font-black">
                  ⚠️
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-tight">
                    Corregir Etiqueta Equivocada
                  </h3>
                  <p className="text-[10px] text-slate-400 font-bold">
                    Re-asigna el escaneo a la prenda física real y la marca como pendiente de nueva etiqueta.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsWrongTagModalOpen(false)}
                className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
              >
                <CrossIcon className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleReportWrongTagSubmit} className="space-y-4">
              {/* Step 1: Wrong tag product (if any) */}
              <div className="space-y-1.5">
                <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  1. Prenda de la Etiqueta Mal Escaneada (Se le restará el escaneo):
                </label>
                <select
                  value={wrongTagProductId}
                  onChange={(e) => setWrongTagProductId(e.target.value)}
                  className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-white font-bold text-xs outline-none focus:ring-1 focus:ring-accent"
                >
                  <option value="">-- Ninguna / Solo registrar prenda sin etiqueta válida --</option>
                  {inventory
                    .filter(p => p.storeId === store.id && (sessionData?.scannedCounts[p.id] || 0) > 0)
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} (SKU: {p.sku || 'N/A'}) - Escaneados: #{sessionData?.scannedCounts[p.id]}
                      </option>
                    ))}
                </select>
                <p className="text-[9px] text-slate-400 font-medium">
                  Si escaneaste la etiqueta pegada en la prenda equivocada, selecciónala arriba para descontarla.
                </p>
              </div>

              {/* Step 2: Search for the correct product */}
              <div className="space-y-2">
                <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  2. Prenda Física Real que tienes en las manos (Se le sumará la presencia física):
                </label>

                {selectedCorrectProduct ? (
                  <div className="flex items-center justify-between p-3 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-2xl">
                    <div>
                      <span className="text-[9px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-wider block">Prenda Seleccionada ✔</span>
                      <p className="text-xs font-black text-slate-800 dark:text-white">{selectedCorrectProduct.name}</p>
                      <p className="text-[10px] text-slate-400 font-bold">SKU: {selectedCorrectProduct.sku || 'N/A'}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedCorrectProduct(null)}
                      className="px-2 py-1 bg-white dark:bg-slate-800 text-slate-500 text-[10px] font-bold rounded-lg border border-slate-200 dark:border-slate-700 hover:text-rose-500"
                    >
                      Cambiar
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="relative">
                      <input
                        type="text"
                        value={correctTagSearch}
                        onChange={(e) => setCorrectTagSearch(e.target.value)}
                        placeholder="Buscar prenda real por nombre, SKU o referencia..."
                        className="w-full pl-9 pr-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white outline-none focus:ring-1 focus:ring-accent"
                      />
                      <SearchIcon className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    </div>

                    {/* Search results */}
                    {correctTagSearch.trim() && (
                      <div className="max-h-[160px] overflow-y-auto border border-slate-200 dark:border-slate-700 rounded-xl divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900">
                        {filteredCorrectProducts.length === 0 ? (
                          <p className="text-[11px] font-bold text-slate-400 text-center py-4">
                            No se encontró ninguna prenda con "{correctTagSearch}"
                          </p>
                        ) : (
                          filteredCorrectProducts.map((p) => (
                            <button
                              key={p.id}
                              type="button"
                              onClick={() => setSelectedCorrectProduct(p)}
                              className="w-full p-2.5 text-left hover:bg-slate-50 dark:hover:bg-slate-800/80 transition-colors flex items-center justify-between"
                            >
                              <div>
                                <p className="text-xs font-black text-slate-800 dark:text-white">{p.name}</p>
                                <p className="text-[10px] text-slate-400 font-bold">SKU: {p.sku || 'N/A'}</p>
                              </div>
                              <span className="text-[10px] font-black text-accent bg-accent/10 px-2 py-0.5 rounded-full">
                                Seleccionar
                              </span>
                            </button>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Step 3: Quantity */}
              <div className="space-y-1.5">
                <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  3. Cantidad de prendas afectando:
                </label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setWrongTagQty(prev => Math.max(1, prev - 1))}
                    className="w-8 h-8 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 text-slate-800 dark:text-white font-black text-sm rounded-lg"
                  >
                    -
                  </button>
                  <input
                    type="number"
                    min="1"
                    value={wrongTagQty}
                    onChange={(e) => setWrongTagQty(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-16 py-1.5 text-center font-black text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                  />
                  <button
                    type="button"
                    onClick={() => setWrongTagQty(prev => prev + 1)}
                    className="w-8 h-8 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 text-slate-800 dark:text-white font-black text-sm rounded-lg"
                  >
                    +
                  </button>
                  <span className="text-[10px] font-bold text-slate-400 ml-2">unidades</span>
                </div>
              </div>

              {/* Submit / Cancel Buttons */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-700/60">
                <button
                  type="button"
                  onClick={() => setIsWrongTagModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl text-xs font-black text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 uppercase"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={!selectedCorrectProduct}
                  className={`px-5 py-2.5 rounded-xl text-xs font-black text-white uppercase tracking-wider shadow-md transition-all ${
                    selectedCorrectProduct 
                      ? 'bg-amber-600 hover:bg-amber-700 shadow-amber-600/20' 
                      : 'bg-slate-300 dark:bg-slate-700 text-slate-500 cursor-not-allowed'
                  }`}
                >
                  ✔ Registrar Corrección (Pendiente Etiqueta)
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Unknown Code Warning Modal */}
      {unknownCodeAlert && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border-2 border-rose-500 shadow-2xl max-w-md w-full p-6 text-center space-y-4 animate-scale-up">
            <div className="w-16 h-16 bg-rose-500/10 text-rose-500 rounded-full flex items-center justify-center mx-auto text-3xl animate-pulse">
              🚨
            </div>
            <div>
              <h3 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-tight">
                ¡Producto No Registrado!
              </h3>
              <p className="text-xs font-bold text-rose-600 dark:text-rose-400 mt-1">
                El código de etiqueta escaneado no existe en el sistema.
              </p>
            </div>

            <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 rounded-2xl">
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Código / SKU Escaneado:</p>
              <p className="text-base font-black text-rose-700 dark:text-rose-300 font-mono mt-0.5">{unknownCodeAlert}</p>
            </div>

            <p className="text-xs font-medium text-slate-600 dark:text-slate-300 leading-relaxed">
              Esta etiqueta no corresponde a ninguna prenda registrada en la sede <strong>{store.name}</strong>. Por favor verifica si el código fue digitado erróneamente o si es mercancía de otra sede/tienda.
            </p>

            <button
              type="button"
              onClick={() => {
                setUnknownCodeAlert(null);
                setTimeout(() => inputRef.current?.focus(), 100);
              }}
              className="w-full py-3 bg-rose-600 hover:bg-rose-700 text-white font-black text-xs uppercase tracking-wider rounded-xl transition-all shadow-lg shadow-rose-600/30"
            >
              Entendido / Continuar Escaneando
            </button>
          </div>
        </div>
      )}

      {/* Loose Tag Verifier Modal */}
      {isLooseTagsModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-2xl w-full p-6 space-y-5 my-8">
            {/* Header */}
            <div className="flex items-start justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="p-2 bg-amber-500/10 text-amber-600 rounded-xl">🏷️</span>
                  <h3 className="text-base font-black text-slate-900 dark:text-white uppercase tracking-tight">
                    Inspector de Etiquetas Sueltas
                  </h3>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-1">
                  Escanea con la pistola o digita cualquier etiqueta suelta para saber si <strong>hace falta en tienda</strong> (útil) o si <strong>ya no hay prendas pendientes</strong> (sobrante).
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsLooseTagsModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xl font-bold rounded-lg"
              >
                ✕
              </button>
            </div>

            {/* Quick Stats Summary */}
            <div className="grid grid-cols-4 gap-2 text-center">
              <div className="p-2.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700">
                <p className="text-[9px] font-black text-slate-400 uppercase">Revisadas</p>
                <p className="text-lg font-black text-slate-800 dark:text-white">{looseTagChecks.length}</p>
              </div>
              <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/30 rounded-xl border border-emerald-200 dark:border-emerald-800">
                <p className="text-[9px] font-black text-emerald-600 dark:text-emerald-400 uppercase">🟢 Útiles</p>
                <p className="text-lg font-black text-emerald-600 dark:text-emerald-400">
                  {looseTagChecks.filter(c => c.status === 'NEEDED').length}
                </p>
              </div>
              <div className="p-2.5 bg-amber-50 dark:bg-amber-950/30 rounded-xl border border-amber-200 dark:border-amber-800">
                <p className="text-[9px] font-black text-amber-600 dark:text-amber-400 uppercase">⚠️ Sobrantes</p>
                <p className="text-lg font-black text-amber-600 dark:text-amber-400">
                  {looseTagChecks.filter(c => c.status === 'SURPLUS').length}
                </p>
              </div>
              <div className="p-2.5 bg-rose-50 dark:bg-rose-950/30 rounded-xl border border-rose-200 dark:border-rose-800">
                <p className="text-[9px] font-black text-rose-600 dark:text-rose-400 uppercase">🚨 No Existe</p>
                <p className="text-lg font-black text-rose-600 dark:text-rose-400">
                  {looseTagChecks.filter(c => c.status === 'NOT_IN_SYSTEM').length}
                </p>
              </div>
            </div>

            {/* Continuous Scanner Input */}
            <form 
              onSubmit={(e) => {
                e.preventDefault();
                handleCheckLooseTag(looseTagInput);
              }}
              className="space-y-2"
            >
              <label className="block text-[10px] font-black uppercase tracking-wider text-slate-600 dark:text-slate-300">
                Escanear Etiqueta Suelta (Pistola o Teclado):
              </label>
              <div className="flex gap-2">
                <input
                  ref={looseTagInputRef}
                  type="text"
                  value={looseTagInput}
                  onChange={(e) => setLooseTagInput(e.target.value)}
                  placeholder="Apunta la pistola o escribe SKU/Código..."
                  className="flex-1 px-4 py-3 bg-slate-50 dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-700 rounded-2xl focus:border-amber-500 font-black text-sm uppercase outline-none transition-all"
                  autoFocus
                />
                <button
                  type="submit"
                  className="px-5 py-3 bg-amber-600 hover:bg-amber-700 text-white font-black text-xs uppercase tracking-wider rounded-2xl shadow-md transition-all flex items-center gap-1.5"
                >
                  <span>Verificar</span>
                </button>
              </div>
            </form>

            {/* Last Inspection Result Card */}
            {lastLooseTagResult && (
              <div className={`p-4 rounded-2xl border space-y-2 animate-scale-up ${
                lastLooseTagResult.status === 'NEEDED'
                  ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200'
                  : lastLooseTagResult.status === 'SURPLUS'
                  ? 'bg-amber-50 dark:bg-amber-950/30 border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200'
                  : 'bg-rose-50 dark:bg-rose-950/30 border-rose-300 dark:border-rose-800 text-rose-900 dark:text-rose-200'
              }`}>
                <div className="flex items-center justify-between">
                  <span className={`text-xs font-black px-2.5 py-1 rounded-full uppercase tracking-wider ${
                    lastLooseTagResult.status === 'NEEDED'
                      ? 'bg-emerald-500 text-white'
                      : lastLooseTagResult.status === 'SURPLUS'
                      ? 'bg-amber-500 text-white'
                      : 'bg-rose-500 text-white'
                  }`}>
                    {lastLooseTagResult.status === 'NEEDED' && '🟢 ETIQUETA ÚTIL Y REQUERIDA'}
                    {lastLooseTagResult.status === 'SURPLUS' && '⚠️ ETIQUETA SOBRANTE / HUÉRFANA'}
                    {lastLooseTagResult.status === 'NOT_IN_SYSTEM' && '🚨 PRODUCTO NO EXISTE EN SISTEMA'}
                  </span>
                  <span className="text-[10px] font-bold opacity-70">{lastLooseTagResult.timestamp}</span>
                </div>

                <div className="pt-1">
                  <h4 className="text-sm font-black">{lastLooseTagResult.productName}</h4>
                  <p className="text-[11px] font-bold opacity-80">SKU / Código: {lastLooseTagResult.sku}</p>
                </div>

                <p className="text-xs font-bold leading-relaxed">{lastLooseTagResult.notes}</p>

                {/* Option to count needed tag into current active session */}
                {lastLooseTagResult.status === 'NEEDED' && (
                  <button
                    type="button"
                    onClick={() => {
                      processCode(lastLooseTagResult.scannedCode, 1);
                      alert(`✔ Se registró 1 unidad de "${lastLooseTagResult.productName}" en el escaneo activo.`);
                    }}
                    className="mt-2 w-full py-2 px-3 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs uppercase tracking-wider rounded-xl transition-all shadow-sm"
                  >
                    ✔ Sumar este escaneo a la auditoría activa (+1)
                  </button>
                )}
              </div>
            )}

            {/* Inspection History Log */}
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Historial de Etiquetas Verificadas en esta Sesión
                </h4>
                {looseTagChecks.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setLooseTagChecks([]);
                      setLastLooseTagResult(null);
                    }}
                    className="text-[10px] font-bold text-rose-500 hover:underline"
                  >
                    Limpiar lista
                  </button>
                )}
              </div>

              {/* Filter pills */}
              <div className="flex gap-1.5 overflow-x-auto pb-1">
                {(['ALL', 'NEEDED', 'SURPLUS', 'NOT_IN_SYSTEM'] as const).map((filter) => (
                  <button
                    key={filter}
                    type="button"
                    onClick={() => setLooseTagFilter(filter)}
                    className={`px-3 py-1 rounded-xl text-[10px] font-black uppercase transition-all whitespace-nowrap ${
                      looseTagFilter === filter
                        ? 'bg-slate-900 text-white dark:bg-amber-500 dark:text-slate-950'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    {filter === 'ALL' && `Todas (${looseTagChecks.length})`}
                    {filter === 'NEEDED' && `🟢 Útiles (${looseTagChecks.filter(c => c.status === 'NEEDED').length})`}
                    {filter === 'SURPLUS' && `⚠️ Sobrantes (${looseTagChecks.filter(c => c.status === 'SURPLUS').length})`}
                    {filter === 'NOT_IN_SYSTEM' && `🚨 No Registradas (${looseTagChecks.filter(c => c.status === 'NOT_IN_SYSTEM').length})`}
                  </button>
                ))}
              </div>

              <div className="max-h-[220px] overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                {looseTagChecks.length === 0 ? (
                  <p className="text-xs font-bold text-slate-400 text-center py-6">
                    Aún no has escaneado ninguna etiqueta suelta.
                  </p>
                ) : (
                  looseTagChecks
                    .filter(c => looseTagFilter === 'ALL' || c.status === looseTagFilter)
                    .map((item) => (
                      <div 
                        key={item.id}
                        className="p-3 bg-slate-50 dark:bg-slate-800/80 rounded-xl border border-slate-100 dark:border-slate-700/60 flex items-center justify-between text-xs gap-2"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="font-black text-slate-800 dark:text-white truncate">{item.productName}</p>
                          <p className="text-[10px] text-slate-400 font-bold">SKU: {item.sku} • {item.timestamp}</p>
                        </div>
                        <span className={`text-[10px] font-black px-2.5 py-1 rounded-full uppercase flex-shrink-0 ${
                          item.status === 'NEEDED' 
                            ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800'
                            : item.status === 'SURPLUS'
                            ? 'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-800'
                            : 'bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-800'
                        }`}>
                          {item.status === 'NEEDED' && `🟢 Faltan ${item.missingTags} un.`}
                          {item.status === 'SURPLUS' && `⚠️ Sobran 0 un.`}
                          {item.status === 'NOT_IN_SYSTEM' && `🚨 No existe`}
                        </span>
                      </div>
                    ))
                )}
              </div>
            </div>

            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex justify-end">
              <button
                type="button"
                onClick={() => setIsLooseTagsModalOpen(false)}
                className="px-5 py-2.5 bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-black text-xs uppercase tracking-wider rounded-xl hover:bg-slate-300 dark:hover:bg-slate-700"
              >
                Cerrar Inspector
              </button>
            </div>
          </div>
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
