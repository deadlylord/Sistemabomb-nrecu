
import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { db, auth } from '../firebase';
import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  writeBatch, 
  increment, 
  query, 
  where, 
  limit, 
  onSnapshot,
  addDoc,
  DocumentReference,
  Query,
  WriteBatch,
  arrayUnion
} from 'firebase/firestore';
import { onAuthStateChanged, signInAnonymously } from 'firebase/auth';
import { Product, CartItem, View, PaymentMethod, HeldCart, Layaway, Category, Sale, Purchase, Seller, StockTake, DailyNote, Role, LoginRecord, Store, InventoryTransfer, Incident, IncidentType, IncidentStatus, ProductHistoryLog, ProductChangeType, PayrollRecord, Customer, Payment, PendingDetailedVerification, Expense } from '../types';
import Header from './Header';
import PosView from './PosView';
import InventoryView from './InventoryView';
import { InventoryTransferView } from './InventoryTransferView';
import { LayawayView } from './LayawayView';
import SalesView from './SalesView';
import PurchasesView from './PurchasesView';
import SellersView from './SellersView';
import StoresView from './StoresView';
import StockTakeHistoryView from './StockTakeHistoryView';
import CustomersView from './CustomersView';
import { SettingsView } from './SettingsView';
import PayrollView from './PayrollView';
import LoginView from './LoginView';
import RoleManagerView from './RoleManagerView';
import IncidentsView from './IncidentsView';
import ReportsModal from './ReportsView';
import { INITIAL_CATEGORIES, INITIAL_PRODUCTS, INITIAL_ROLES, INITIAL_SELLERS, INITIAL_STORES } from '../constants';
import ReceiptModal from './ReceiptModal';
import RecaudoReceiptModal from './RecaudoReceiptModal';
import DashboardView from './DashboardView';
import { reuploadImageFromUrl, uploadImageAndGetURL } from '../services/storageService';
import { InventoryVerificationModal } from './InventoryVerificationModal';
import PendingIncidentsBriefingModal from './PendingIncidentsBriefingModal';
import SmartAccountantView from './SmartAccountantView';

const hexToRgb = (hex: string) => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : null;
};

const attachFirestoreListener = <T extends { id: string }>(query: Query, setter: React.Dispatch<React.SetStateAction<T[]>>) => {
  const unsubscribe = onSnapshot(query, snapshot => {
    const list: T[] = snapshot.docs.map(doc => ({ ...(doc.data() as object), id: doc.id } as T));
    setter(list);
  }, error => {
    console.error(`Error attaching listener:`, error);
  });
  return unsubscribe;
};

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<View>(View.DASHBOARD);
  const [inventory, setInventory] = useState<Product[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [layaways, setLayaways] = useState<Layaway[]>([]);
  const [stockTakes, setStockTakes] = useState<StockTake[]>([]);
  const [dailyNotes, setDailyNotes] = useState<DailyNote[]>([]);
  const [loginHistory, setLoginHistory] = useState<LoginRecord[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [productHistory, setProductHistory] = useState<ProductHistoryLog[]>([]);
  const [payrollHistory, setPayrollHistory] = useState<PayrollRecord[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [sellers, setSellers] = useState<Seller[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [allSales, setAllSales] = useState<Sale[]>([]);
  const [allLayaways, setAllLayaways] = useState<Layaway[]>([]);
  const [allIncidents, setAllIncidents] = useState<Incident[]>([]);
  const [activeCart, setActiveCart] = useState<CartItem[]>([]);
  const [heldCarts, setHeldCarts] = useState<HeldCart[]>([]);
  const [inventoryTransfers, setInventoryTransfers] = useState<InventoryTransfer[]>([]);
  const [currentUser, setCurrentUser] = useState<Seller | null>(null);
  const [currentStoreId, setCurrentStoreId] = useState<string | null>(localStorage.getItem('currentStoreId'));
  const [theme, setTheme] = useState<'light' | 'dark'>(localStorage.getItem('theme') as 'light' | 'dark' || 'dark');
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [isAppReady, setIsAppReady] = useState(false);
  const [saleForReceipt, setSaleForReceipt] = useState<Sale | null>(null);
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [lastRecaudo, setLastRecaudo] = useState<Incident | null>(null);
  const [showRecaudoReceipt, setShowRecaudoReceipt] = useState(false);
  const [isRecompressing, setIsRecompressing] = useState(false);
  const [recompressProgress, setRecompressProgress] = useState({ current: 0, total: 0 });
  const [shouldIncludeDisabledProducts, setShouldIncludeDisabledProducts] = useState<boolean>(false);
  const [isGlobalMode, setIsGlobalMode] = useState<boolean>(false);
  const [globalInventoryForSearch, setGlobalInventoryForSearch] = useState<Product[]>([]);
  const [verifiedProducts, setVerifiedProducts] = useState<Set<string>>(new Set());
  const [isReportsModalOpen, setIsReportsModalOpen] = useState(false);
  const [isVerificationModalOpen, setIsVerificationModalOpen] = useState(false);
  
  // Briefing de novedades
  const [hasShownBriefing, setHasShownBriefing] = useState(false);
  const [isBriefingModalOpen, setIsBriefingModalOpen] = useState(false);

  const handleToggleProductVerification = (productId: string) => {
    setVerifiedProducts(prev => {
        const newSet = new Set(prev);
        if (newSet.has(productId)) newSet.delete(productId);
        else newSet.add(productId);
        return newSet;
    });
  };

  const handleClearVerifications = useCallback(() => {
      setVerifiedProducts(new Set());
  }, []);
  
  const currentStore = useMemo(() => {
    const store = stores.find(s => s.id === currentStoreId);
    if (store) {
      const rgb = hexToRgb(store.accentColor);
      if (rgb) document.documentElement.style.setProperty('--color-accent', `${rgb.r} ${rgb.g} ${rgb.b}`);
      const hoverRgb = hexToRgb(store.accentColorHover);
      if (hoverRgb) document.documentElement.style.setProperty('--color-accent-hover', `${hoverRgb.r} ${hoverRgb.g} ${hoverRgb.b}`);
    }
    return store;
  }, [currentStoreId, stores]);

  const userPermissions = useMemo(() => {
    if (!currentUser) return [];
    const userRole = roles.find(role => role.id === currentUser.roleId);
    return userRole ? userRole.permissions : [];
  }, [currentUser, roles]);

  const isAdmin = useMemo(() => {
      if (!currentUser || !roles.length) return false;
      const adminRole = roles.find(r => r.name === 'Administrator');
      return currentUser.roleId === adminRole?.id;
  }, [currentUser, roles]);
  
  const fetchOnceFromFirestore = useCallback(<T extends { id: string }>(query: Query, setter: React.Dispatch<React.SetStateAction<T[]>>) => {
    getDocs(query).then(snapshot => {
      const list: T[] = snapshot.docs.map(doc => ({ ...(doc.data() as object), id: doc.id } as T));
      setter(list);
    }).catch(error => {
      console.error(`Error fetching once:`, error);
    });
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, user => {
      if (user) setIsAuthReady(true);
      else {
        signInAnonymously(auth).catch(error => {
          console.error("Anonymous sign-in failed:", error);
          alert("Error de conexión. No se pudo autenticar de forma segura.");
        });
      }
    });
    return () => unsubscribe();
  }, []);
  
  useEffect(() => {
    if (!isAuthReady) return;
    const loadInitialData = async () => {
      try {
        const sellersQuery = query(collection(db, 'sellers'), limit(1));
        const snapshot = await getDocs(sellersQuery);
        if (snapshot.empty) {
          const batch = writeBatch(db);
          INITIAL_STORES.forEach(item => { const { id, ...data } = item; batch.set(doc(db, 'stores', id), data); });
          INITIAL_CATEGORIES.forEach(item => { const { id, ...data } = item; batch.set(doc(db, 'categories', id), data); });
          INITIAL_ROLES.forEach(item => { const { id, ...data } = item; batch.set(doc(db, 'roles', id), data); });
          INITIAL_SELLERS.forEach(item => { const { id, ...data } = item; batch.set(doc(db, 'sellers', id), data); });
          INITIAL_PRODUCTS.forEach(item => { const { id, ...data } = item; batch.set(doc(db, 'inventory', id), data); });
          await batch.commit();
        }
      } catch (error) {
        console.error("Error initializing database:", error);
      } finally {
        setIsAppReady(true);
      }
    };
    loadInitialData();
  }, [isAuthReady]);

  useEffect(() => {
    if (!isAppReady || !isAuthReady || currentUser) return;
    const unsubscribers = [
      attachFirestoreListener(query(collection(db, 'sellers')), setSellers),
      attachFirestoreListener(query(collection(db, 'stores')), setStores),
      attachFirestoreListener(query(collection(db, 'roles')), setRoles),
    ];
    return () => unsubscribers.forEach(unsub => unsub());
  }, [isAppReady, isAuthReady, currentUser]);

  useEffect(() => {
    if (!isAppReady || !isAuthReady || !currentUser) return;
    const unsubscribers = [
      attachFirestoreListener(query(collection(db, 'sellers')), setSellers),
      attachFirestoreListener(query(collection(db, 'categories')), setCategories),
      attachFirestoreListener(query(collection(db, 'inventoryTransfers')), setInventoryTransfers)
    ];
    if (isAdmin) {
      unsubscribers.push(attachFirestoreListener(query(collection(db, 'layaways')), setAllLayaways));
      unsubscribers.push(attachFirestoreListener(query(collection(db, 'incidents')), setAllIncidents));
    }
    return () => unsubscribers.forEach(unsub => unsub());
  }, [currentUser, isAppReady, isAuthReady, isAdmin]);
  
  useEffect(() => {
    if (isReportsModalOpen && isAdmin) {
      if (allSales.length === 0) {
        const salesQuery = query(collection(db, 'sales'));
        getDocs(salesQuery).then(snapshot => {
          const list: Sale[] = snapshot.docs.map(doc => ({ ...(doc.data() as object), id: doc.id } as Sale));
          setAllSales(list);
        }).catch(error => console.error("Error fetching all sales for report:", error));
      }
      if (globalInventoryForSearch.length === 0) {
          const inventoryQuery = query(collection(db, 'inventory'));
          getDocs(inventoryQuery).then(snapshot => {
              const list: Product[] = snapshot.docs.map(doc => ({ ...(doc.data() as object), id: doc.id } as Product));
              setGlobalInventoryForSearch(list);
          }).catch(error => console.error("Error fetching all inventory for report:", error));
      }
    }
  }, [isReportsModalOpen, isAdmin, allSales, globalInventoryForSearch]);
  
  useEffect(() => {
    if (!isGlobalMode || !isAppReady || !currentUser) {
        if (globalInventoryForSearch.length > 0 && !isAdmin) setGlobalInventoryForSearch([]);
        return;
    }
    const inventoryQuery = query(collection(db, 'inventory'));
    const unsubscribe = attachFirestoreListener(inventoryQuery, setGlobalInventoryForSearch);
    return () => unsubscribe();
  }, [isGlobalMode, isAppReady, currentUser, isAdmin]);
  
  // Dedicamos un listener exclusivo para incidencias que siempre esté activo tras login
  useEffect(() => {
    if (!currentUser || !currentStoreId) return;
    const q = query(collection(db, 'incidents'), where('storeId', '==', currentStoreId));
    const unsubscribe = attachFirestoreListener(q, setIncidents);
    return () => unsubscribe();
  }, [currentUser, currentStoreId]);

  useEffect(() => {
    if (!isAppReady || !isAuthReady || !currentStoreId || !currentUser || userPermissions.length === 0) return;

    const unsubscribers: (() => void)[] = [];
    const attach = <T extends { id: string }>(query: Query, setter: React.Dispatch<React.SetStateAction<T[]>>) => {
        unsubscribers.push(attachFirestoreListener(query, setter));
    };
    const fetchOnce = <T extends { id: string }>(query: Query, setter: React.Dispatch<React.SetStateAction<T[]>>) => {
        fetchOnceFromFirestore(query, setter);
    };

    setInventory([]); setSales([]); setPurchases([]); setLayaways([]); setStockTakes([]);
    setDailyNotes([]); setLoginHistory([]); setProductHistory([]);
    setPayrollHistory([]); setCustomers([]); setHeldCarts([]); setExpenses([]);

    const storeSpecificQuery = (collectionName: string) => query(collection(db, collectionName), where('storeId', '==', currentStoreId));
    const storeInventoryQuery = storeSpecificQuery('inventory');

    switch (currentView) {
        case View.DASHBOARD:
            attach(storeSpecificQuery('sales'), setSales);
            attach(storeSpecificQuery('layaways'), setLayaways);
            attach(storeInventoryQuery, setInventory);
            attach(storeSpecificQuery('dailyNotes'), setDailyNotes);
            attach(storeSpecificQuery('purchases'), setPurchases);
            break;
        case View.POS:
            attach(storeInventoryQuery, setInventory);
            attach(storeSpecificQuery('sales'), setSales);
            attach(storeSpecificQuery('purchases'), setPurchases);
            attach(storeSpecificQuery('layaways'), setLayaways);
            attach(storeSpecificQuery('customers'), setCustomers);
            attach(query(collection(db, 'heldCarts'), where('storeId', '==', currentStoreId)), setHeldCarts);
            break;
        case View.INVENTORY:
            attach(storeInventoryQuery, setInventory);
            attach(storeSpecificQuery('sales'), setSales);
            attach(storeSpecificQuery('purchases'), setPurchases);
            attach(storeSpecificQuery('layaways'), setLayaways);
            fetchOnce(query(collection(db, 'productHistory'), where('storeId', '==', currentStoreId)), setProductHistory);
            break;
        case View.INVENTORY_TRANSFER:
            attach(storeInventoryQuery, setInventory);
            break;
        case View.LAYAWAY:
            attach(storeInventoryQuery, setInventory);
            attach(storeSpecificQuery('layaways'), setLayaways);
            break;
        case View.PURCHASES:
            attach(storeInventoryQuery, setInventory);
            attach(storeSpecificQuery('purchases'), setPurchases);
            break;
        case View.CUSTOMERS:
            attach(storeSpecificQuery('customers'), setCustomers);
            attach(storeSpecificQuery('sales'), setSales);
            attach(storeSpecificQuery('layaways'), setLayaways);
            break;
        case View.STOCK_TAKE_HISTORY:
            fetchOnce(storeSpecificQuery('stockTakes'), setStockTakes);
            break;
        case View.PAYROLL:
            fetchOnce(storeSpecificQuery('loginHistory'), setLoginHistory);
            fetchOnce(storeSpecificQuery('payrollHistory'), setPayrollHistory);
            attach(storeSpecificQuery('sales'), setSales);
            attach(storeSpecificQuery('layaways'), setLayaways);
            break;
        case View.SETTINGS:
            attach(storeInventoryQuery, setInventory);
            break;
        case View.INCIDENTS:
            attach(storeInventoryQuery, setInventory);
            attach(storeSpecificQuery('sales'), setSales);
            attach(storeSpecificQuery('customers'), setCustomers);
            break;
        case View.ACCOUNTING:
            attach(storeSpecificQuery('sales'), setSales);
            attach(storeSpecificQuery('layaways'), setLayaways);
            attach(storeSpecificQuery('expenses'), setExpenses);
            fetchOnce(storeSpecificQuery('payrollHistory'), setPayrollHistory);
            break;
    }
    return () => unsubscribers.forEach(unsub => unsub());
}, [isAppReady, isAuthReady, currentStoreId, currentView, currentUser, roles, userPermissions, fetchOnceFromFirestore]);

  // Briefing de novedades y encargos pendientes al iniciar
  useEffect(() => {
    if (currentUser && !hasShownBriefing) {
      const pendingIncidentsCount = incidents.filter(i => 
        [IncidentStatus.DAÑADO_REPORTADO, IncidentStatus.CAMBIO_SOLICITADO, IncidentStatus.TRASLADO_SOLICITADO, IncidentStatus.WARRANTY_ACTIVE].includes(i.status)
      ).length;

      const pendingPreOrdersCount = layaways.filter(l => l.status === 'pre-order').length;
      
      if (pendingIncidentsCount > 0 || pendingPreOrdersCount > 0) {
        setIsBriefingModalOpen(true);
      }
    }
  }, [currentUser, incidents, layaways, hasShownBriefing]);

  useEffect(() => {
    if (!isAppReady || stores.length === 0) return;
    const runColorMigration = async () => {
      const batch = writeBatch(db);
      let needsUpdate = false;
      stores.forEach(store => {
          if (!store.accentColorsUpdated) {
              const ref = doc(db, 'stores', store.id);
              if (store.name === 'Centro Comercial') batch.update(ref, { accentColor: '#00aaff', accentColorHover: '#0095e6', accentColorsUpdated: true });
              else if (store.name === 'Metro') batch.update(ref, { accentColor: '#9d00ff', accentColorHover: '#8c00e6', accentColorsUpdated: true });
              else if (store.name === 'Divino') batch.update(ref, { accentColor: '#ff007f', accentColorHover: '#e60073', accentColorsUpdated: true });
              needsUpdate = true;
          }
      });
      if (needsUpdate) {
        try { await batch.commit(); } catch (error) { console.error("Failed to run accent color migration:", error); }
      }
    };
    runColorMigration();
  }, [isAppReady, stores]);

  useEffect(() => {
    if (theme === 'dark') document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
    localStorage.setItem('theme', theme);
  }, [theme]);
  
  const getStoreName = (storeId: string) => stores.find(s => s.id === storeId)?.name || 'Tienda Desconocida';

  const toggleTheme = () => setTheme(prevTheme => (prevTheme === 'dark' ? 'light' : 'dark'));

  const createProductHistoryLog = (product: Product, changedBy: string, changeType: ProductChangeType, details: string): ProductHistoryLog => {
    const newLogRef = doc(collection(db, 'productHistory'));
    return {
      id: newLogRef.id,
      productId: product.id,
      productName: product.name,
      storeId: product.storeId,
      changedBy,
      timestamp: new Date().toISOString(),
      changeType,
      details,
    };
  };

  const handleAddToCart = (product: Product) => {
    setActiveCart(prev => {
        const existing = prev.find(p => p.id === product.id);
        if (existing) return prev.map(p => p.id === product.id ? { ...p, quantity: p.quantity + 1 } : p);
        return [...prev, { ...product, quantity: 1 }];
    });
  };

  const handleUpdateCartQuantity = (productId: string, newQuantity: number) => {
    if (newQuantity <= 0) setActiveCart(prev => prev.filter(p => p.id !== productId));
    else setActiveCart(prev => prev.map(p => p.id === productId ? { ...p, quantity: newQuantity } : p));
  };

  const handleUpdateCartItemPrice = (productId: string, newPrice: number) => {
    setActiveCart(prev => prev.map(p => p.id === productId ? { ...p, price: newPrice } : p));
  };

  const handleRemoveFromCart = (productId: string) => setActiveCart(prev => prev.filter(p => p.id !== productId));

  const handleClearCart = () => setActiveCart([]);

  const handleProcessSale = async (saleData: { payments: Payment[]; customerName: string; customerPhone: string; seller: string; }, saleDate: Date) => {
    if (!currentStore || !currentStoreId || !currentUser) return;
    const batch = writeBatch(db);
    const saleRef = doc(collection(db, 'sales'));
    const totalAmount = activeCart.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const newSale: Sale = {
        id: saleRef.id,
        invoiceNumber: currentStore.nextInvoiceNumber,
        customerName: saleData.customerName,
        customerPhone: saleData.customerPhone,
        items: activeCart,
        totalAmount,
        payments: saleData.payments,
        paymentMethod: saleData.payments[0]?.method, 
        seller: saleData.seller,
        createdAt: saleDate.toISOString(),
        storeId: currentStoreId,
    };
    batch.set(saleRef, newSale);
    activeCart.forEach(item => {
        const productRef = doc(db, 'inventory', item.id);
        batch.update(productRef, { stock: increment(-item.quantity) });
    });
    const storeRef = doc(db, 'stores', currentStore.id);
    batch.update(storeRef, { nextInvoiceNumber: increment(1) });
    await batch.commit();
    setSaleForReceipt(newSale);
    setShowReceiptModal(true);
    handleClearCart();
  };

  const handleHoldSale = async (data?: { customer?: { name: string; phone: string }; sellerName?: string; }) => {
    if (!currentStoreId) return;
    const cartRef = doc(collection(db, 'heldCarts'));
    const heldCart: HeldCart = {
        id: cartRef.id,
        items: activeCart,
        storeId: currentStoreId,
        customerName: data?.customer?.name,
        customerPhone: data?.customer?.phone,
        sellerName: data?.sellerName,
    };
    await setDoc(cartRef, heldCart);
    handleClearCart();
  };

  const handleResumeSale = async (heldCartId: string) => {
    const cart = heldCarts.find(c => c.id === heldCartId);
    if (cart) {
        setActiveCart(cart.items);
        await deleteDoc(doc(db, 'heldCarts', heldCartId));
    }
  };

  const handleCreateLayaway = async (customerName: string, customerPhone: string, invoiceNumber: string, seller: string, initialPayment: { amount: number; method: PaymentMethod; }, saleDate: Date, isPreOrder: boolean, description?: string) => {
    if (!currentStoreId) return;
    const batch = writeBatch(db);
    const layawayRef = doc(collection(db, 'layaways'));
    const totalAmount = activeCart.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const payment: Payment = { amount: initialPayment.amount, method: initialPayment.method, date: saleDate.toISOString(), seller: seller };
    const newLayaway: Layaway = {
        id: layawayRef.id,
        invoiceNumber,
        customerName,
        customerPhone,
        items: activeCart,
        totalAmount,
        paidAmount: initialPayment.amount,
        payments: [payment],
        status: isPreOrder ? 'pre-order' : 'active',
        createdAt: saleDate.toISOString(),
        seller,
        storeId: currentStoreId,
        description,
    };
    batch.set(layawayRef, newLayaway);
    if (!isPreOrder) {
        activeCart.forEach(item => {
            const productRef = doc(db, 'inventory', item.id);
            batch.update(productRef, { stock: increment(-item.quantity) });
        });
    }
    await batch.commit();
    handleClearCart();
  };

  const handleAddPaymentToLayaway = async (layawayId: string, amount: number, method: PaymentMethod, seller: string) => {
    const layaway = layaways.find(l => l.id === layawayId);
    if (!layaway) return;
    const newPayment: Payment = { date: new Date().toISOString(), amount, method, seller };
    const layawayRef = doc(db, 'layaways', layawayId);
    const newPaidAmount = layaway.paidAmount + amount;
    const updateData: any = { payments: arrayUnion(newPayment), paidAmount: increment(amount) };
    if (newPaidAmount >= layaway.totalAmount && layaway.totalAmount > 0 && (layaway.status === 'active' || layaway.status === 'pre-order')) {
      updateData.status = 'completed';
      const fullPaymentsList = [...layaway.payments, newPayment];
      const completedTransactionReceipt: any = {
          id: layaway.id,
          invoiceNumber: layaway.invoiceNumber,
          customerName: layaway.customerName,
          customerPhone: layaway.customerPhone,
          items: layaway.items,
          totalAmount: layaway.totalAmount,
          payments: fullPaymentsList,
          seller: seller,
          createdAt: new Date().toISOString(),
          storeId: layaway.storeId,
      };
      setSaleForReceipt(completedTransactionReceipt);
      setShowReceiptModal(true);
    }
    await updateDoc(layawayRef, updateData);
  };

  const handleFulfillPreOrder = async (layawayId: string) => {
      const layaway = layaways.find(l => l.id === layawayId);
      if (!layaway || layaway.status !== 'pre-order') return;
      const batch = writeBatch(db);
      const layawayRef = doc(db, 'layaways', layawayId);
      layaway.items.forEach(item => {
          const productRef = doc(db, 'inventory', item.id);
          batch.update(productRef, { stock: increment(-item.quantity) });
      });
      batch.update(layawayRef, { status: 'active' });
      await batch.commit();
  };

  const handleInventoryTransfer = async (data: { fromStoreId: string; toStoreId: string; productId: string; quantity: number; sellerName: string; }, existingBatch?: WriteBatch) => {
    if (!currentUser) return;
    const batch = existingBatch || writeBatch(db);
    try {
      const { fromStoreId, toStoreId, productId, quantity, sellerName } = data;
      const fromProductRef = doc(db, 'inventory', productId);
      const fromProductDoc = await getDoc(fromProductRef);
      if (!fromProductDoc.exists()) throw new Error("Producto no encontrado en la tienda de origen.");
      const fromProduct = { id: fromProductDoc.id, ...fromProductDoc.data() } as Product;
      if (fromProduct.stock < quantity) throw new Error("Stock insuficiente.");
      const toProductQuery = query(collection(db, 'inventory'), where('name', '==', fromProduct.name), where('storeId', '==', toStoreId), limit(1));
      const toProductSnapshot = await getDocs(toProductQuery);
      if (toProductSnapshot.empty) throw new Error(`Producto "${fromProduct.name}" debe existir en la tienda de destino antes de hacer el traslado.`);
      const toProductDoc = toProductSnapshot.docs[0];
      const toProduct = { id: toProductDoc.id, ...toProductDoc.data() } as Product;
      const toProductRef = toProductDoc.ref;
      batch.update(fromProductRef, { stock: increment(-quantity) });
      const updateData: { [key: string]: any } = { stock: increment(quantity) };
      if (toProduct.isDisabled) updateData.isDisabled = false;
      batch.update(toProductRef, updateData);
      const newTransferRef = doc(collection(db, 'inventoryTransfers'));
      const newTransfer: Omit<InventoryTransfer, 'id'> = { fromStoreId, toStoreId, productId, productName: fromProduct.name, quantity, productCost: fromProduct.cost, totalCost: fromProduct.cost * quantity, createdAt: new Date().toISOString(), sellerName, settled: false };
      batch.set(newTransferRef, newTransfer);
      const outLog = createProductHistoryLog(fromProduct, sellerName, ProductChangeType.TRANSFER_OUT, `-${quantity} a ${getStoreName(toStoreId)} (antes: ${fromProduct.stock})`);
      batch.set(doc(db, 'productHistory', outLog.id), outLog);
      const inLog = createProductHistoryLog(toProduct, sellerName, ProductChangeType.TRANSFER_IN, `+${quantity} desde ${getStoreName(fromStoreId)} (antes: ${toProduct.stock})`);
      batch.set(doc(db, 'productHistory', inLog.id), inLog);
      if (!existingBatch) { await batch.commit(); alert('Traslado realizado con éxito.'); }
    } catch (error: any) { console.error("Error durante el traslado de inventario:", error); throw error; }
  };

  const handleResetBalances = async () => {
    if (!window.confirm("Esto marcará todos los traslados visibles como 'liquidados' y reiniciará los saldos. ¿Continuar?")) return;
    try {
        const batch = writeBatch(db);
        const unsettledTransfers = inventoryTransfers.filter(t => !t.settled);
        if (unsettledTransfers.length === 0) return;
        unsettledTransfers.forEach(transfer => {
            const transferRef = doc(db, 'inventoryTransfers', transfer.id);
            batch.update(transferRef, { settled: true });
        });
        await batch.commit();
        alert(`${unsettledTransfers.length} traslados marcados como liquidados.`);
    } catch (error: any) { console.error("Error reseteando saldos:", error); alert(`Fallo al resetear saldos: ${error.message}`); }
  };

  const handleCreateIncident = async (data: Omit<Incident, 'id' | 'status' | 'createdAt' | 'storeId' | 'sellerName'> & { surplusPaid?: number; surplusPaymentMethod?: PaymentMethod; incidentDate?: string }) => {
    if (!currentUser || !currentStoreId) return;
    const { surplusPaid, surplusPaymentMethod, incidentDate, ...incidentData } = data;
    const batch = writeBatch(db);
    const newIncidentRef = doc(collection(db, 'incidents'));
    const createdAt = incidentDate || new Date().toISOString();
    let initialStatus: IncidentStatus;
    switch(data.type) {
        case IncidentType.CASH_ADJUSTMENT: case IncidentType.RECAUDO: case IncidentType.ADDITIONAL_INCOME: case IncidentType.NEGATIVE_STOCK_SALE: initialStatus = IncidentStatus.REGISTRADO; break;
        case IncidentType.DAMAGED: initialStatus = IncidentStatus.DAÑADO_REPORTADO; break;
        case IncidentType.PRODUCT_EXCHANGE: initialStatus = IncidentStatus.CAMBIO_SOLICITADO; break;
        case IncidentType.INVENTORY_TRANSFER_REQUEST: initialStatus = IncidentStatus.TRASLADO_SOLICITADO; break;
        case IncidentType.WARRANTY: initialStatus = IncidentStatus.WARRANTY_ACTIVE; break;
        default: throw new Error(`Unhandled incident type for status initialization: ${data.type}`);
    }
    const newIncident: Incident = { ...incidentData, id: newIncidentRef.id, status: initialStatus, createdAt: createdAt, sellerName: currentUser.name, storeId: currentStoreId };
    if (newIncident.type === IncidentType.PRODUCT_EXCHANGE && surplusPaid && surplusPaid > 0 && surplusPaymentMethod) {
        newIncident.adjustmentAmount = surplusPaid;
        newIncident.paymentMethod = surplusPaymentMethod;
        const adjustmentRef = doc(collection(db, 'incidents'));
        newIncident.relatedIncidentId = adjustmentRef.id;
        const adjustmentIncident: Incident = { id: adjustmentRef.id, type: IncidentType.CASH_ADJUSTMENT, status: IncidentStatus.REGISTRADO, description: `Excedente pagado (${surplusPaymentMethod}) por cambio de factura #${newIncident.originalSaleInvoiceNumber}`, createdAt: createdAt, sellerName: currentUser.name, storeId: currentStoreId, adjustmentAmount: surplusPaid, adjustmentType: 'income', customerName: newIncident.customerName, customerPhone: newIncident.customerPhone, paymentMethod: surplusPaymentMethod };
        batch.set(adjustmentRef, adjustmentIncident);
    }
    batch.set(newIncidentRef, newIncident);
    await batch.commit();
    if (newIncident.type === IncidentType.RECAUDO) { setLastRecaudo(newIncident); setShowRecaudoReceipt(true); }
  };

  const handleApproveIncident = async (incidentId: string) => {
    if (!currentUser) return;
    const incident = incidents.find(i => i.id === incidentId);
    if (!incident) return;
    const batch = writeBatch(db);
    const incidentRef = doc(db, 'incidents', incidentId);
    let newStatus: IncidentStatus;
    try {
        switch (incident.type) {
          case IncidentType.DAMAGED:
            if (incident.status !== IncidentStatus.DAÑADO_REPORTADO) return;
            newStatus = IncidentStatus.EN_ARREGLO_CAMBIO;
            if (!incident.productId) throw new Error('No se especificó un producto.');
            const productToDamageRef = doc(db, 'inventory', incident.productId);
            batch.update(productToDamageRef, { stock: increment(-1) });
            break;
          case IncidentType.PRODUCT_EXCHANGE:
            if (incident.status !== IncidentStatus.CAMBIO_SOLICITADO) return;
            newStatus = IncidentStatus.CAMBIO_PROCESADO;
            incident.returnedItems?.forEach(item => { batch.update(doc(db, 'inventory', item.productId), { stock: increment(item.quantity) }); });
            incident.takenItems?.forEach(item => { batch.update(doc(db, 'inventory', item.productId), { stock: increment(-item.quantity) }); });
            break;
          case IncidentType.INVENTORY_TRANSFER_REQUEST:
            if (incident.status !== IncidentStatus.TRASLADO_SOLICITADO) return;
            newStatus = IncidentStatus.TRASLADO_COMPLETADO;
            if (incident.fromStoreId && incident.toStoreId && incident.productId && incident.quantity) {
                await handleInventoryTransfer({ fromStoreId: incident.fromStoreId, toStoreId: incident.toStoreId, productId: incident.productId, quantity: incident.quantity, sellerName: incident.sellerName }, batch);
            }
            break;
          default: return;
        }
        batch.update(incidentRef, { status: newStatus, resolutionDate: new Date().toISOString() });
        await batch.commit();
    } catch (error: any) { console.error("Error approving incident:", error); alert(`Error al aprobar: ${error.message}`); }
  };

  const handleResolveIncident = async (incidentId: string) => {
    const incident = incidents.find(i => i.id === incidentId);
    if (!incident || !currentUser) return;
    const batch = writeBatch(db);
    const incidentRef = doc(db, 'incidents', incidentId);
    let newStatus: IncidentStatus | null = null;
    if (incident.type === IncidentType.WARRANTY && incident.status === IncidentStatus.WARRANTY_ACTIVE) newStatus = IncidentStatus.WARRANTY_RETURNED;
    else if (incident.type === IncidentType.DAMAGED && incident.status === IncidentStatus.EN_ARREGLO_CAMBIO) {
        newStatus = IncidentStatus.DEVUELTO_Y_RESUELTO;
        if (incident.productId) batch.update(doc(db, 'inventory', incident.productId), { stock: increment(1) });
    }
    if (newStatus) { batch.update(incidentRef, { status: newStatus, resolutionDate: new Date().toISOString() }); await batch.commit(); }
  };

  const handleUpdateIncident = async (incident: Incident) => { await setDoc(doc(db, 'incidents', incident.id), incident, { merge: true }); };
  const handleDeleteIncident = async (incidentId: string) => { if (window.confirm('¿Estás seguro de eliminar esta novedad?')) await deleteDoc(doc(db, 'incidents', incidentId)); };
  const handleUpdateLayaway = async (updatedLayaway: Layaway) => { await setDoc(doc(db, 'layaways', updatedLayaway.id), updatedLayaway); };
  const handleDeleteLayaway = async (layawayId: string) => { if(window.confirm('¿Eliminar abono?')) await deleteDoc(doc(db, 'layaways', layawayId)); };
  const handleUpdateSale = async (updatedSale: Sale) => { await setDoc(doc(db, 'sales', updatedSale.id), updatedSale); };
  const handleDeleteSale = async (saleId: string) => { if(window.confirm('¿Eliminar venta?')) await deleteDoc(doc(db, 'sales', saleId)); };
  const handleReprintSale = (sale: Sale) => { setSaleForReceipt(sale); setShowReceiptModal(true); };

  const handleSaveStockTake = async (stockTakeData: Omit<StockTake, 'id' | 'createdAt' | 'storeId'>, applyNow: boolean) => {
      if (!currentStoreId || !currentUser) return;
      const batch = writeBatch(db);
      const newRef = doc(collection(db, 'stockTakes'));
      const stockTake: StockTake = { ...stockTakeData, id: newRef.id, createdAt: new Date().toISOString(), storeId: currentStoreId, isApplied: applyNow };
      batch.set(newRef, stockTake);
      if (applyNow && stockTake.productCounts) {
          Object.entries(stockTake.productCounts).forEach(([pid, count]) => {
              const productRef = doc(db, 'inventory', pid);
              const product = inventory.find(p => p.id === pid);
              if (product) {
                batch.update(productRef, { stock: count });
                const log = createProductHistoryLog(product, currentUser.name, ProductChangeType.STOCK_TAKE_APPLIED, `Ajuste de inventario vía conteo físico a ${count} unidades.`);
                batch.set(doc(db, 'productHistory', log.id), log);
              }
          });
      }
      await batch.commit();
      if (applyNow) alert("Verificación guardada y stock actualizado correctamente.");
      else alert("Verificación guardada. Pendiente por aplicar por un administrador.");
  };

  const handleApplyHistoricalStockTake = async (stockTake: StockTake) => {
    if (!isAdmin || !stockTake.productCounts || stockTake.isApplied) return;
    if (window.confirm(`¿Estás seguro de aplicar este conteo físico realizado por ${stockTake.seller}? El stock actual será reemplazado por los valores de este reporte.`)) {
        const batch = writeBatch(db);
        Object.entries(stockTake.productCounts).forEach(([pid, count]) => {
            const productRef = doc(db, 'inventory', pid);
            const product = inventory.find(p => p.id === pid);
            if (product) {
              batch.update(productRef, { stock: count });
              const log = createProductHistoryLog(product, currentUser.name, ProductChangeType.STOCK_TAKE_APPLIED, `Ajuste diferido de inventario (Conteo del ${new Date(stockTake.createdAt).toLocaleDateString()}) a ${count} unidades.`);
              batch.set(doc(db, 'productHistory', log.id), log);
            }
        });
        batch.update(doc(db, 'stockTakes', stockTake.id), { isApplied: true });
        await batch.commit();
        alert("Stock actualizado exitosamente.");
    }
  };

  const handleSaveDetailedDraft = async (categoryId: string, counts: Record<string, number>) => {
    if (!currentStoreId || !currentUser) return;
    const draftId = `${categoryId}_${currentStoreId}`;
    const draftRef = doc(db, 'pendingDetailedVerifications', draftId);
    const draftData: PendingDetailedVerification = { id: draftId, categoryId, storeId: currentStoreId, counts, lastUpdatedBy: currentUser.name, updatedAt: new Date().toISOString() };
    await setDoc(draftRef, draftData);
  };

  const handleApplyDetailedVerification = async (categoryId: string, counts: Record<string, number>) => {
    if (!currentStoreId || !currentUser || !isAdmin) return;
    const batch = writeBatch(db);
    Object.entries(counts).forEach(([pid, count]) => {
      const productRef = doc(db, 'inventory', pid);
      const product = inventory.find(p => p.id === pid);
      if (product) {
        batch.update(productRef, { stock: count });
        const log = createProductHistoryLog(product, currentUser.name, ProductChangeType.DETAILED_VERIFICATION, `Ajuste detallado de stock a ${count} unidades por administrador.`);
        batch.set(doc(db, 'productHistory', log.id), log);
      }
    });
    const draftId = `${categoryId}_${currentStoreId}`;
    batch.delete(doc(db, 'pendingDetailedVerifications', draftId));
    await batch.commit();
  };

  const handleAddDailyNote = async (content: string, seller: string) => {
      if (!currentStoreId) return;
      const newRef = doc(collection(db, 'dailyNotes'));
      await setDoc(newRef, { id: newRef.id, content, seller, createdAt: new Date().toISOString(), storeId: currentStoreId });
  };

  const handleAddProduct = async (newProductData: any, selectedStoreIds: string[], imageFile?: File) => {
      const imageUrl = imageFile ? await uploadImageAndGetURL(imageFile) : '';
      const batch = writeBatch(db);
      const namePrefix = newProductData.name.substring(0, 3).toUpperCase();
      const sku = `${namePrefix}-${Math.floor(1000 + Math.random() * 9000)}`;
      selectedStoreIds.forEach(storeId => {
          const newRef = doc(collection(db, 'inventory'));
          batch.set(newRef, { ...newProductData, id: newRef.id, sku, imageUrl, storeId, isDisabled: false });
      });
      await batch.commit();
  };

  const handleUpdateProduct = async (updatedProduct: Product, imageFile?: File) => {
      let imageUrl = updatedProduct.imageUrl;
      if (imageFile) imageUrl = await uploadImageAndGetURL(imageFile);
      await updateDoc(doc(db, 'inventory', updatedProduct.id), { ...updatedProduct, imageUrl });
  };

  const handleDeleteProduct = async (productId: string) => { if (window.confirm('¿Eliminar producto?')) await deleteDoc(doc(db, 'inventory', productId)); };
  const handleBulkAddProducts = async (products: any[], storeId: string) => {
      const batch = writeBatch(db);
      products.forEach(p => {
          const newRef = doc(collection(db, 'inventory'));
          const namePrefix = p.name.substring(0, 3).toUpperCase();
          const sku = `${namePrefix}-${Math.floor(1000 + Math.random() * 9000)}`;
          batch.set(newRef, { ...p, id: newRef.id, sku, storeId, isDisabled: false });
      });
      await batch.commit();
  };
  const handleAddCategory = async (name: string) => { const newRef = doc(collection(db, 'categories')); await setDoc(newRef, { id: newRef.id, name }); };
  const handleUpdateCategory = async (id: string, name: string) => await updateDoc(doc(db, 'categories', id), { name });
  const handleDeleteCategory = async (id: string) => await deleteDoc(doc(db, 'categories', id));
  const handleAddStore = async (name: string) => { const newRef = doc(collection(db, 'stores')); await setDoc(newRef, { id: newRef.id, name, nextInvoiceNumber: 1, accentColor: '#000000', accentColorHover: '#333333' }); };
  const handleUpdateStore = async (updatedStore: Store) => await updateDoc(doc(db, 'stores', updatedStore.id), updatedStore as any);
  const handleDeleteStore = async (id: string) => { if(window.confirm('¿Eliminar tienda?')) await deleteDoc(doc(db, 'stores', id)); };
  const handleAddSeller = async (name: string, password: string, roleId: string, storeId: string) => { const newRef = doc(collection(db, 'sellers')); await setDoc(newRef, { id: newRef.id, name, password, roleId, storeId, isDisabled: false }); };
  const handleUpdateSeller = async (id: string, name: string, password: string, roleId: string, storeId: string) => {
      const data: any = { name, roleId, storeId };
      if (password) data.password = password;
      await updateDoc(doc(db, 'sellers', id), data);
  };
  const handleDeleteSeller = async (id: string) => { if(window.confirm('¿Eliminar vendedor?')) await deleteDoc(doc(db, 'sellers', id)); };
  const handleToggleSellerStatus = async (id: string) => { const seller = sellers.find(s => s.id === id); if (seller) await updateDoc(doc(db, 'sellers', id), { isDisabled: !seller.isDisabled }); };
  const handleAddRole = async (name: string) => { const newRef = doc(collection(db, 'roles')); await setDoc(newRef, { id: newRef.id, name, permissions: [] }); };
  const handleUpdateRole = async (updatedRole: Role) => await setDoc(doc(db, 'roles', updatedRole.id), updatedRole);
  const handleSavePayroll = async (payrollData: any) => {
      if (!currentStoreId || !currentUser) return;
      const newRef = doc(collection(db, 'payrollHistory'));
      await setDoc(newRef, { ...payrollData, id: newRef.id, paidAt: new Date().toISOString(), paidBy: currentUser.name, storeId: currentStoreId });
  };
  const handleBulkAddCustomers = async (newCustomers: any[]) => {
      if (!currentStoreId) return;
      const batch = writeBatch(db);
      newCustomers.forEach(c => {
          const newRef = doc(collection(db, 'customers'));
          batch.set(newRef, { ...c, id: newRef.id, storeId: currentStoreId, createdAt: new Date().toISOString() });
      });
      await batch.commit();
  };
  const handleUpdateCustomer = async (id: string, name: string, phone: string) => await updateDoc(doc(db, 'customers', id), { name, phone });

  const handleAddExpense = async (expenseData: Omit<Expense, 'id'>) => {
      if (!currentStoreId) return;
      const newRef = doc(collection(db, 'expenses'));
      await setDoc(newRef, { ...expenseData, id: newRef.id, storeId: currentStoreId });
  };

  const handleUpdateExpense = async (expense: Expense) => {
      await updateDoc(doc(db, 'expenses', expense.id), { ...expense });
  };

  const handleDeleteExpense = async (id: string) => {
      if (window.confirm('¿Eliminar este registro de gasto?')) await deleteDoc(doc(db, 'expenses', id));
  };

  const handleLogin = (sellerName: string, passwordAttempt: string) => {
    const seller = sellers.find(s => s.name.trim().toLowerCase() === sellerName.trim().toLowerCase());
    if (seller && seller.password.trim() === passwordAttempt.trim()) {
      setCurrentUser(seller); setCurrentStoreId(seller.storeId); localStorage.setItem('currentStoreId', seller.storeId);
      const sellerRole = roles.find(role => role.id === seller.roleId);
      if (sellerRole && sellerRole.name.toLowerCase() === 'vendedor') setCurrentView(View.POS);
      else setCurrentView(View.DASHBOARD);
      const newLoginRecord: Omit<LoginRecord, 'id'> = { sellerId: seller.id, sellerName: seller.name, date: new Date().toISOString(), storeId: seller.storeId };
      addDoc(collection(db, 'loginHistory'), newLoginRecord);
    } else alert('Usuario o contraseña incorrecta.');
  };
  
  const handleLogout = () => { setCurrentUser(null); setCurrentStoreId(null); localStorage.removeItem('currentStoreId'); setIsGlobalMode(false); setInventory([]); setHasShownBriefing(false); };

  if (!currentUser) return <div className="min-h-screen w-full flex items-center justify-center p-4"><LoginView onLogin={handleLogin} isAppReady={isAppReady} /></div>;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 transition-colors duration-300">
      <Header currentView={currentView} setCurrentView={setCurrentView} theme={theme} toggleTheme={toggleTheme} currentUser={currentUser} currentStore={currentStore} userPermissions={userPermissions} onLogout={handleLogout} stores={stores} onSwitchStore={setCurrentStoreId} roles={roles} isGlobalMode={isGlobalMode} onToggleGlobalMode={() => setIsGlobalMode(!isGlobalMode)} incidents={incidents} onOpenBriefing={() => setIsBriefingModalOpen(true)} />
      <main className="container mx-auto p-4 pb-20 lg:pb-4">
        {currentView === View.DASHBOARD && <DashboardView stores={stores} allLayaways={allLayaways} allIncidents={allIncidents} currentUser={currentUser} roles={roles} onSwitchStore={setCurrentStoreId} onNavigate={setCurrentView} onOpenReports={() => setIsReportsModalOpen(true)} sales={sales} layaways={layaways} inventory={inventory} categories={categories} sellers={sellers} dailyNotes={dailyNotes} currentStore={currentStore} onUpdateSale={handleUpdateSale} onDeleteSale={handleDeleteSale} onReprintSale={handleReprintSale} onOpenVerification={() => setIsVerificationModalOpen(true)} purchases={purchases} />}
        {currentView === View.POS && <PosView inventory={isGlobalMode ? globalInventoryForSearch : inventory} categories={categories} sellers={sellers} stores={stores} sales={sales} purchases={purchases} layaways={layaways} allCustomers={customers} activeCart={activeCart} heldCarts={heldCarts} onAddToCart={handleAddToCart} onUpdateCartQuantity={handleUpdateCartQuantity} onUpdateCartItemPrice={handleUpdateCartItemPrice} onRemoveFromCart={handleRemoveFromCart} onClearCart={handleClearCart} onProcessSale={handleProcessSale} onHoldSale={handleHoldSale} onResumeSale={handleResumeSale} onCreateLayaway={handleCreateLayaway} onSaveStockTake={handleSaveStockTake} dailyNotes={dailyNotes} onAddDailyNote={handleAddDailyNote} onNavigate={setCurrentView} currentStore={currentStore} incidents={incidents} onCreateIncident={handleCreateIncident} currentUser={currentUser} roles={roles} nextInvoiceNumber={currentStore?.nextInvoiceNumber || 1} onUpdateProduct={handleUpdateProduct} verifiedProducts={verifiedProducts} onToggleProductVerification={handleToggleProductVerification} onClearVerifications={handleClearVerifications} onSaveDetailedDraft={handleSaveDetailedDraft} onApplyDetailedVerification={handleApplyDetailedVerification} onUpdateStoreSettings={handleUpdateStore} onOpenVerification={() => setIsVerificationModalOpen(true)} />}
        {currentView === View.INVENTORY && <InventoryView inventory={inventory} allInventory={isGlobalMode ? globalInventoryForSearch : inventory} sales={sales} purchases={purchases} layaways={layaways} categories={categories} stores={stores} currentStoreId={currentStoreId || ''} onAddProduct={handleAddProduct} onUpdateProduct={handleUpdateProduct} onBulkAddProducts={handleBulkAddProducts} onDeleteProduct={handleDeleteProduct} onAddCategory={handleAddCategory} onUpdateCategory={handleUpdateCategory} onDeleteCategory={handleDeleteCategory} onNavigate={setCurrentView} productHistory={productHistory} currentUser={currentUser} roles={roles} showDisabledProducts={shouldIncludeDisabledProducts} onShowDisabledProductsChange={setShouldIncludeDisabledProducts} onReactivateInconsistentProducts={(ids) => ids.forEach(id => updateDoc(doc(db, 'inventory', id), { isDisabled: false }))} />}
        {currentView === View.INVENTORY_TRANSFER && <InventoryTransferView inventory={inventory} stores={stores} currentUser={currentUser} transfers={inventoryTransfers} onTransfer={(data) => handleInventoryTransfer(data)} onResetBalances={handleResetBalances} />}
        {currentView === View.LAYAWAY && <LayawayView layaways={layaways} sellers={sellers} inventory={inventory} onAddPayment={handleAddPaymentToLayaway} onFulfillPreOrder={handleFulfillPreOrder} onDeleteLayaway={handleDeleteLayaway} onUpdateLayaway={handleUpdateLayaway} currentUser={currentUser} roles={roles} />}
        {currentView === View.PURCHASES && <PurchasesView purchases={purchases} inventory={inventory} allInventoryForSearch={isGlobalMode ? globalInventoryForSearch : undefined} categories={categories} stores={stores} currentStoreId={currentStoreId || ''} onMultiStorePurchase={async () => {}} onUpdatePurchase={() => {}} onDeletePurchase={() => {}} />}
        {currentView === View.SELLERS && <SellersView sellers={sellers} roles={roles} stores={stores} onAddSeller={handleAddSeller} onUpdateSeller={handleUpdateSeller} onDeleteSeller={handleDeleteSeller} onToggleSellerStatus={handleToggleSellerStatus} />}
        {currentView === View.STORES && <StoresView stores={stores} onAddStore={handleAddStore} onUpdateStore={(id, newName) => {
          const store = stores.find(s => s.id === id);
          if (store) handleUpdateStore({ ...store, name: newName });
        }} onDeleteStore={handleDeleteStore} />}
        {currentView === View.CUSTOMERS && <CustomersView sales={sales} layaways={layaways} allCustomers={customers} onBulkAddCustomers={handleBulkAddCustomers} onUpdateCustomer={handleUpdateCustomer} />}
        {currentView === View.STOCK_TAKE_HISTORY && <StockTakeHistoryView stockTakes={stockTakes} sellers={sellers} onDeleteStockTake={(id) => deleteDoc(doc(db, 'stockTakes', id))} onAddNoteToStockTake={(id, note) => updateDoc(doc(db, 'stockTakes', id), { notes: arrayUnion({ content: note, author: currentUser.name, date: new Date().toISOString() }) })} onApplyStockTake={handleApplyHistoricalStockTake} currentUser={currentUser} roles={roles} />}
        {currentView === View.PAYROLL && <PayrollView sellers={sellers} sales={sales} layaways={layaways} loginHistory={loginHistory} payrollHistory={payrollHistory} onSavePayroll={handleSavePayroll} currentUser={currentUser} />}
        {currentView === View.SETTINGS && <SettingsView stores={stores} allInventory={isGlobalMode ? globalInventoryForSearch : inventory} categories={categories} onSave={handleUpdateStore} onResetStoreData={() => {}} currentUser={currentUser} roles={roles} onRecompressAllProductImages={() => {}} isRecompressing={isRecompressing} recompressProgress={recompressProgress} onGenerateTestData={() => {}} onReactivateAllProducts={() => {}} />}
        {currentView === View.ROLE_MANAGER && <RoleManagerView roles={roles} onAddRole={handleAddRole} onUpdateRole={handleUpdateRole} />}
        {currentView === View.INCIDENTS && <IncidentsView incidents={incidents} inventory={inventory} currentUser={currentUser} roles={roles} sales={sales} stores={stores} customers={customers} onCreateIncident={handleCreateIncident} onApproveIncident={handleApproveIncident} onResolveIncident={handleResolveIncident} onUpdateIncident={handleUpdateIncident} onDeleteIncident={handleDeleteIncident} />}
        {currentView === View.ACCOUNTING && <SmartAccountantView sales={sales} layaways={layaways} expenses={expenses} payrollHistory={payrollHistory} currentStore={currentStore} currentUser={currentUser} onAddExpense={handleAddExpense} onUpdateExpense={handleUpdateExpense} onDeleteExpense={handleDeleteExpense} />}
      </main>
      <ReportsModal isOpen={isReportsModalOpen} onClose={() => setIsReportsModalOpen(false)} allSales={allSales} allInventory={isGlobalMode ? globalInventoryForSearch : inventory} stores={stores} categories={categories} />
      {showReceiptModal && saleForReceipt && <ReceiptModal sale={saleForReceipt} store={currentStore || null} onClose={() => setShowReceiptModal(false)} />}
      {showRecaudoReceipt && lastRecaudo && <RecaudoReceiptModal incident={lastRecaudo} store={currentStore || null} onClose={() => setShowRecaudoReceipt(false)} />}
      {isVerificationModalOpen && (
          <InventoryVerificationModal
              isOpen={isVerificationModalOpen}
              isAdmin={isAdmin}
              currentStore={currentStore}
              onClose={() => setIsVerificationModalOpen(false)}
              inventory={inventory}
              categories={categories}
              sellers={sellers}
              onSaveStockTake={handleSaveStockTake}
              onSaveDetailedDraft={handleSaveDetailedDraft}
              onApplyDetailedVerification={handleApplyDetailedVerification}
              onUpdateStoreSettings={handleUpdateStore}
          />
      )}
      
      {/* Briefing de Novedades - Disponible en móvil y desktop */}
      <PendingIncidentsBriefingModal 
        isOpen={isBriefingModalOpen}
        onClose={() => {
            setIsBriefingModalOpen(false);
            setHasShownBriefing(true); // Se marca como mostrado solo cuando el usuario lo cierra
        }}
        incidents={incidents}
        layaways={layaways}
        onNavigate={setCurrentView}
      />
    </div>
  );
};

export default App;
