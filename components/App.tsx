import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { db, auth } from './firebase';
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
import { Product, CartItem, View, PaymentMethod, HeldCart, Layaway, Category, Sale, Purchase, Seller, StockTake, DailyNote, Role, LoginRecord, Store, InventoryTransfer, Incident, IncidentType, IncidentStatus, ProductHistoryLog, ProductChangeType, PayrollRecord, Customer, Payment } from './types';
import Header from './components/Header';
import PosView from './components/PosView';
import InventoryView from './components/InventoryView';
import { InventoryTransferView } from './components/InventoryTransferView';
import { LayawayView } from './components/LayawayView';
import SalesView from './components/SalesView';
import PurchasesView from './components/PurchasesView';
import SellersView from './components/SellersView';
import StoresView from './components/StoresView';
import StockTakeHistoryView from './components/StockTakeHistoryView';
import CustomersView from './components/CustomersView';
import { SettingsView } from './components/SettingsView';
import PayrollView from './components/PayrollView';
import LoginView from './components/LoginView';
import RoleManagerView from './components/RoleManagerView';
import IncidentsView from './components/IncidentsView';
import ReportsModal from './components/ReportsView';
import { INITIAL_CATEGORIES, INITIAL_PRODUCTS, INITIAL_ROLES, INITIAL_SELLERS, INITIAL_STORES } from './constants';
import ReceiptModal from './components/ReceiptModal';
import RecaudoReceiptModal from './components/RecaudoReceiptModal';
import DashboardView from './components/DashboardView';
import { reuploadImageFromUrl, uploadImageAndGetURL } from './services/storageService';

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

/**
 * Attaches a real-time Firestore listener to a query.
 * It efficiently updates the component's state by mapping the snapshot docs.
 *
 * @param query The Firestore query to listen to.
 * @param setter The React state setter function to update the component's state.
 * @returns A cleanup function that detaches the listener when the component unmounts.
 */
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
  // States for data specific to the current store
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
  
  // States for global (non-store-specific) data
  const [categories, setCategories] = useState<Category[]>([]);
  const [sellers, setSellers] = useState<Seller[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [allSales, setAllSales] = useState<Sale[]>([]);
  
  // States for UI and session management
  const [activeCart, setActiveCart] = useState<CartItem[]>([]);
  const [heldCarts, setHeldCarts] = useState<HeldCart[]>([]);
  const [inventoryTransfers, setInventoryTransfers] = useState<InventoryTransfer[]>([]); // This might stay global for admins
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

  const handleToggleProductVerification = (productId: string) => {
    setVerifiedProducts(prev => {
        const newSet = new Set(prev);
        if (newSet.has(productId)) {
            newSet.delete(productId);
        } else {
            newSet.add(productId);
        }
        return newSet;
    });
  };

  const handleClearVerifications = useCallback(() => {
      setVerifiedProducts(new Set());
  }, []);
  
  const currentStore = useMemo(() => {
    const store = stores.find(s => s.id === currentStoreId);
    if (store) { // Always apply color, even in global mode, to show which store is the primary context
      const rgb = hexToRgb(store.accentColor);
      if (rgb) {
        document.documentElement.style.setProperty('--color-accent', `${rgb.r} ${rgb.g} ${rgb.b}`);
      }
      const hoverRgb = hexToRgb(store.accentColorHover);
      if (hoverRgb) {
        document.documentElement.style.setProperty('--color-accent-hover', `${hoverRgb.r} ${hoverRgb.g} ${hoverRgb.b}`);
      }
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
      if (user) {
        console.log('Firebase Anonymous Auth successful:', user.uid);
        setIsAuthReady(true);
      } else {
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
          console.log("Database is empty. Initializing with sample data...");
          const batch = writeBatch(db);
          INITIAL_STORES.forEach(item => { const { id, ...data } = item; batch.set(doc(db, 'stores', id), data); });
          INITIAL_CATEGORIES.forEach(item => { const { id, ...data } = item; batch.set(doc(db, 'categories', id), data); });
          INITIAL_ROLES.forEach(item => { const { id, ...data } = item; batch.set(doc(db, 'roles', id), data); });
          INITIAL_SELLERS.forEach(item => { const { id, ...data } = item; batch.set(doc(db, 'sellers', id), data); });
          INITIAL_PRODUCTS.forEach(item => { const { id, ...data } = item; batch.set(doc(db, 'inventory', id), data); });
          await batch.commit();
          console.log("Sample data has been written to the database.");
        }
      } catch (error) {
        console.error("Error initializing database:", error);
      } finally {
        setIsAppReady(true);
      }
    };
    loadInitialData();
  }, [isAuthReady]);

  // Pre-login data loading (essentials for login screen)
  useEffect(() => {
    if (!isAppReady || !isAuthReady || currentUser) return;

    console.log("App is ready, loading pre-login data (sellers, stores, and roles)...");

    const unsubscribers = [
      attachFirestoreListener(query(collection(db, 'sellers')), setSellers),
      attachFirestoreListener(query(collection(db, 'stores')), setStores),
      attachFirestoreListener(query(collection(db, 'roles')), setRoles),
    ];

    return () => {
      console.log("Cleaning up pre-login listeners.");
      unsubscribers.forEach(unsub => unsub());
    }
  }, [isAppReady, isAuthReady, currentUser]);

  // Post-login data loading (global data that doesn't depend on store)
  useEffect(() => {
    if (!isAppReady || !isAuthReady || !currentUser) return;

    console.log("User logged in. Loading post-login global data...");
    
    const unsubscribers = [
      attachFirestoreListener(query(collection(db, 'sellers')), setSellers),
      attachFirestoreListener(query(collection(db, 'categories')), setCategories),
      attachFirestoreListener(query(collection(db, 'inventoryTransfers')), setInventoryTransfers)
    ];
    
    if (isAdmin) {
      unsubscribers.push(attachFirestoreListener(query(collection(db, 'sales')), setAllSales));
      unsubscribers.push(attachFirestoreListener(query(collection(db, 'inventory')), setGlobalInventoryForSearch));
    }

    return () => {
      console.log("Cleaning up post-login global listeners.");
      unsubscribers.forEach(unsub => unsub());
    }
  }, [currentUser, isAppReady, isAuthReady, isAdmin]);
  
  // Effect for managing global search mode data
  useEffect(() => {
    if (!isGlobalMode || !isAppReady || !currentUser) {
        if (globalInventoryForSearch.length > 0 && !isAdmin) { // Admins always have it loaded
            setGlobalInventoryForSearch([]); // Clear if mode is turned off
        }
        return;
    }

    console.log("Global mode enabled, fetching all inventory for search...");
    const inventoryQuery = query(collection(db, 'inventory'));
    const unsubscribe = attachFirestoreListener(inventoryQuery, setGlobalInventoryForSearch);

    return () => {
        console.log("Cleaning up global inventory listener.");
        unsubscribe();
    };
  }, [isGlobalMode, isAppReady, currentUser, isAdmin]);
  
  // LAZY LOADING EFFECT: On-demand data loading based on current view and store
  useEffect(() => {
    if (!isAppReady || !isAuthReady || !currentStoreId || !currentUser || userPermissions.length === 0) {
        return; // Exit if app is not ready for store-specific data
    }

    console.log(`Attaching listeners for view: ${currentView} in store ${currentStoreId}`);
    const unsubscribers: (() => void)[] = [];
    const attach = <T extends { id: string }>(query: Query, setter: React.Dispatch<React.SetStateAction<T[]>>) => {
        unsubscribers.push(attachFirestoreListener(query, setter));
    };
    const fetchOnce = <T extends { id: string }>(query: Query, setter: React.Dispatch<React.SetStateAction<T[]>>) => {
        fetchOnceFromFirestore(query, setter);
    };

    // Reset data states to prevent flashing stale data from a previous view
    setInventory([]); setSales([]); setPurchases([]); setLayaways([]); setStockTakes([]);
    setDailyNotes([]); setLoginHistory([]); setIncidents([]); setProductHistory([]);
    setPayrollHistory([]); setCustomers([]); setHeldCarts([]);

    // Define base queries for the current store
    const storeSpecificQuery = (collectionName: string) => query(collection(db, collectionName), where('storeId', '==', currentStoreId));
    const storeInventoryQuery = storeSpecificQuery('inventory');

    switch (currentView) {
        case View.DASHBOARD:
            attach(storeSpecificQuery('sales'), setSales);
            attach(storeSpecificQuery('layaways'), setLayaways);
            attach(storeSpecificQuery('incidents'), setIncidents);
            attach(storeSpecificQuery('dailyNotes'), setDailyNotes);
            attach(storeInventoryQuery, setInventory);
            break;
        
        case View.POS:
            attach(storeInventoryQuery, setInventory);
            attach(storeSpecificQuery('sales'), setSales);
            attach(storeSpecificQuery('purchases'), setPurchases);
            attach(storeSpecificQuery('layaways'), setLayaways);
            attach(storeSpecificQuery('customers'), setCustomers);
            attach(query(collection(db, 'heldCarts'), where('storeId', '==', currentStoreId)), setHeldCarts);
            attach(storeSpecificQuery('incidents'), setIncidents);
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
            attach(storeSpecificQuery('incidents'), setIncidents);
            attach(storeSpecificQuery('sales'), setSales);
            attach(storeSpecificQuery('customers'), setCustomers);
            break;
        
        // Views like SELLERS, STORES, ROLE_MANAGER use global data already loaded, no extra listeners needed here.
    }

    return () => {
        console.log(`Cleaning up listeners for view: ${currentView} in store ${currentStoreId}.`);
        unsubscribers.forEach(unsub => unsub());
    };

}, [isAppReady, isAuthReady, currentStoreId, currentView, currentUser, roles, userPermissions, fetchOnceFromFirestore]);

  useEffect(() => {
    // This effect runs a one-time migration to update accent colors in Firebase.
    // It checks for a flag `accentColorsUpdated` to prevent running on every load.
    if (!isAppReady || stores.length === 0) return;

    const runColorMigration = async () => {
      const batch = writeBatch(db);
      let needsUpdate = false;

      const ccStore = stores.find(s => s.name === 'Centro Comercial');
      if (ccStore && !ccStore.accentColorsUpdated) {
        const ref = doc(db, 'stores', ccStore.id);
        batch.update(ref, { accentColor: '#00aaff', accentColorHover: '#0095e6', accentColorsUpdated: true });
        needsUpdate = true;
      }

      const metroStore = stores.find(s => s.name === 'Metro');
      if (metroStore && !metroStore.accentColorsUpdated) {
        const ref = doc(db, 'stores', metroStore.id);
        batch.update(ref, { accentColor: '#9d00ff', accentColorHover: '#8c00e6', accentColorsUpdated: true });
        needsUpdate = true;
      }
      
      const divinoStore = stores.find(s => s.name === 'Divino');
      if (divinoStore && !divinoStore.accentColorsUpdated) {
          const ref = doc(db, 'stores', divinoStore.id);
          batch.update(ref, { accentColor: '#ff007f', accentColorHover: '#e60073', accentColorsUpdated: true });
          needsUpdate = true;
      }

      if (needsUpdate) {
        try {
          console.log("Running one-time accent color migration...");
          await batch.commit();
          console.log("Accent color migration successful.");
        } catch (error) {
          console.error("Failed to run accent color migration:", error);
        }
      }
    };

    runColorMigration();
  }, [isAppReady, stores]);

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);
  
  const getStoreName = (storeId: string) => stores.find(s => s.id === storeId)?.name || 'Tienda Desconocida';

  const toggleTheme = () => {
    setTheme(prevTheme => (prevTheme === 'dark' ? 'light' : 'dark'));
  };

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

  // FIX: Modified function to accept an optional batch. If a batch is provided, it uses it and does not commit. If not, it creates and commits its own. Also re-throws errors for the caller to handle.
  const handleInventoryTransfer = async (data: { fromStoreId: string; toStoreId: string; productId: string; quantity: number; sellerName: string; }, existingBatch?: WriteBatch) => {
    if (!currentUser) return;
    // Use existing batch or create a new one
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
      if (toProductSnapshot.empty) {
          throw new Error(`Producto "${fromProduct.name}" debe existir en la tienda de destino antes de hacer el traslado.`);
      }
      const toProductDoc = toProductSnapshot.docs[0];
      const toProduct = { id: toProductDoc.id, ...toProductDoc.data() } as Product;
      const toProductRef = toProductDoc.ref;
  
      batch.update(fromProductRef, { stock: increment(-quantity) });
      
      const updateData: { [key: string]: any } = { stock: increment(quantity) };
      if (toProduct.isDisabled) {
        updateData.isDisabled = false;
      }
      batch.update(toProductRef, updateData);
  
      const newTransferRef = doc(collection(db, 'inventoryTransfers'));
      const newTransfer: Omit<InventoryTransfer, 'id'> = {
          fromStoreId,
          toStoreId,
          productId,
          productName: fromProduct.name,
          quantity,
          productCost: fromProduct.cost,
          totalCost: fromProduct.cost * quantity,
          createdAt: new Date().toISOString(),
          sellerName,
          settled: false,
      };
      batch.set(newTransferRef, newTransfer);
  
      const outLog = createProductHistoryLog(fromProduct, sellerName, ProductChangeType.TRANSFER_OUT, `-${quantity} a ${getStoreName(toStoreId)} (antes: ${fromProduct.stock})`);
      batch.set(doc(db, 'productHistory', outLog.id), outLog);
      const inLog = createProductHistoryLog(toProduct, sellerName, ProductChangeType.TRANSFER_IN, `+${quantity} desde ${getStoreName(fromStoreId)} (antes: ${toProduct.stock})`);
      batch.set(doc(db, 'productHistory', inLog.id), inLog);
  
      // Only commit if we created the batch here
      if (!existingBatch) {
        await batch.commit();
        alert('Traslado realizado con éxito.');
      }
    } catch (error: any) {
      console.error("Error durante el traslado de inventario:", error);
      // Re-throw to allow caller to handle transaction failure
      throw error;
    }
  };

  const handleResetBalances = async () => {
    if (!window.confirm("Esto marcará todos los traslados visibles como 'liquidados' y reiniciará los saldos. Esta acción es para fines contables y no se puede deshacer. ¿Continuar?")) {
        return;
    }
    
    try {
        const batch = writeBatch(db);
        const unsettledTransfers = inventoryTransfers.filter(t => !t.settled);

        if (unsettledTransfers.length === 0) {
            alert("No hay traslados pendientes para liquidar.");
            return;
        }

        unsettledTransfers.forEach(transfer => {
            const transferRef = doc(db, 'inventoryTransfers', transfer.id);
            batch.update(transferRef, { settled: true });
        });
        
        await batch.commit();
        alert(`${unsettledTransfers.length} traslados marcados como liquidados.`);

    } catch (error: any) {
        console.error("Error reseteando saldos:", error);
        alert(`Fallo al resetear saldos: ${error.message}`);
    }
  };

  const handleCreateIncident = async (data: Omit<Incident, 'id' | 'status' | 'createdAt' | 'storeId' | 'sellerName'> & { surplusPaid?: number; surplusPaymentMethod?: PaymentMethod; incidentDate?: string }) => {
    if (!currentUser || !currentStoreId) return;

    const { surplusPaid, surplusPaymentMethod, incidentDate, ...incidentData } = data;
    const batch = writeBatch(db);
    
    const newIncidentRef = doc(collection(db, 'incidents'));
    const createdAt = incidentDate || new Date().toISOString();

    let initialStatus: IncidentStatus;
    switch(data.type) {
        case IncidentType.CASH_ADJUSTMENT:
        case IncidentType.RECAUDO:
        case IncidentType.ADDITIONAL_INCOME:
        case IncidentType.NEGATIVE_STOCK_SALE:
            initialStatus = IncidentStatus.REGISTRADO;
            break;
        case IncidentType.DAMAGED:
            initialStatus = IncidentStatus.DAÑADO_REPORTADO;
            break;
        case IncidentType.PRODUCT_EXCHANGE:
            initialStatus = IncidentStatus.CAMBIO_SOLICITADO;
            break;
        case IncidentType.INVENTORY_TRANSFER_REQUEST:
            initialStatus = IncidentStatus.TRASLADO_SOLICITADO;
            break;
        case IncidentType.WARRANTY:
            initialStatus = IncidentStatus.WARRANTY_ACTIVE;
            break;
        default:
            throw new Error(`Unhandled incident type for status initialization: ${data.type}`);
    }

    const newIncident: Incident = {
      ...incidentData,
      id: newIncidentRef.id,
      status: initialStatus,
      createdAt: createdAt,
      sellerName: currentUser.name,
      storeId: currentStoreId,
    };
    
    if (newIncident.type === IncidentType.PRODUCT_EXCHANGE && surplusPaid && surplusPaid > 0 && surplusPaymentMethod) {
        newIncident.adjustmentAmount = surplusPaid;
        newIncident.paymentMethod = surplusPaymentMethod;

        if (surplusPaymentMethod === PaymentMethod.Efectivo) {
            const adjustmentRef = doc(collection(db, 'incidents'));
            newIncident.relatedIncidentId = adjustmentRef.id;
    
            const adjustmentIncident: Incident = {
                id: adjustmentRef.id,
                type: IncidentType.CASH_ADJUSTMENT,
                status: IncidentStatus.REGISTRADO,
                description: `Excedente pagado por cambio de factura #${newIncident.originalSaleInvoiceNumber}`,
                createdAt: createdAt,
                sellerName: currentUser.name,
                storeId: currentStoreId,
                adjustmentAmount: surplusPaid,
                adjustmentType: 'income',
                customerName: newIncident.customerName,
                customerPhone: newIncident.customerPhone,
                paymentMethod: surplusPaymentMethod,
            };
            batch.set(adjustmentRef, adjustmentIncident);
        }
    }
    
    batch.set(newIncidentRef, newIncident);
    await batch.commit();
    
    if (newIncident.type === IncidentType.RECAUDO) {
      setLastRecaudo(newIncident);
      setShowRecaudoReceipt(true);
    }
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
            const { productId } = incident;
            if (!productId) throw new Error('No se especificó un producto para la baja por daño.');
            const productToDamage = inventory.find(p => p.id === productId);
            if (!productToDamage) throw new Error('Producto no encontrado en inventario.');
            if (productToDamage.stock < 1) throw new Error(`No hay stock para dar de baja para ${productToDamage.name}.`);
            
            const productToDamageRef = doc(db, 'inventory', productId);
            batch.update(productToDamageRef, { stock: increment(-1) });
            
            const damageLog = createProductHistoryLog(productToDamage, currentUser.name, ProductChangeType.DAMAGED, `-${1} por daño (antes: ${productToDamage.stock}). Motivo: ${incident.description}`);
            batch.set(doc(db, 'productHistory', damageLog.id), damageLog);
            break;

          case IncidentType.PRODUCT_EXCHANGE:
            if (incident.status !== IncidentStatus.CAMBIO_SOLICITADO) return;
            newStatus = IncidentStatus.CAMBIO_PROCESADO;
            const { originalSaleId, returnedItems, takenItems, relatedIncidentId } = incident;
            if (!originalSaleId || !returnedItems || returnedItems.length === 0 || !takenItems || takenItems.length === 0) { throw new Error('Datos de cambio de producto incompletos o inválidos.'); }
            const originalSale = sales.find(s => s.id === originalSaleId);
            if (!originalSale) { throw new Error(`Venta original con ID #${originalSaleId} no encontrada.`); }

            const itemsToStartFrom = incident.originalSaleItemsSnapshot || originalSale.items || [];
            const paymentsToStartFrom = incident.originalSalePaymentsSnapshot || originalSale.payments || [];
            if (!incident.originalSaleItemsSnapshot) { batch.update(incidentRef, { originalSaleItemsSnapshot: itemsToStartFrom }); }
            if (!incident.originalSalePaymentsSnapshot) { batch.update(incidentRef, { originalSalePaymentsSnapshot: paymentsToStartFrom }); }

            const stockErrors: string[] = [];
            takenItems.forEach(itemToTake => {
                const productInStock = inventory.find(p => p.id === itemToTake.productId);
                if (!productInStock) { stockErrors.push(`Producto a llevar no encontrado: ${itemToTake.productName}`); }
                else if (productInStock.stock < itemToTake.quantity) { stockErrors.push(`Stock insuficiente para ${itemToTake.productName}. Solicitado: ${itemToTake.quantity}, Disponible: ${productInStock.stock}`); }
            });
            if (stockErrors.length > 0) { throw new Error(`No se pudo aprobar el cambio por errores de stock: ${stockErrors.join(', ')}`); }

            returnedItems.forEach(itemToReturn => {
                const product = inventory.find(p => p.id === itemToReturn.productId);
                if (product) {
                    const productRef = doc(db, 'inventory', itemToReturn.productId);
                    const updateData: { [key: string]: any } = { stock: increment(itemToReturn.quantity) };
                    if (product.isDisabled) {
                        updateData.isDisabled = false;
                    }
                    batch.update(productRef, updateData);

                    const historyLog = createProductHistoryLog( product, currentUser.name, ProductChangeType.EXCHANGE_IN, `+${itemToReturn.quantity} por cambio (antes: ${product.stock}). Factura orig: #${incident.originalSaleInvoiceNumber}`);
                    batch.set(doc(db, 'productHistory', historyLog.id), historyLog);
                }
            });
            takenItems.forEach(itemToTake => {
                const product = inventory.find(p => p.id === itemToTake.productId);
                const productRef = doc(db, 'inventory', itemToTake.productId);
                batch.update(productRef, { stock: increment(-itemToTake.quantity) });
                
                const historyLog = createProductHistoryLog( product!, currentUser.name, ProductChangeType.EXCHANGE_OUT, `-${itemToTake.quantity} por cambio (antes: ${product!.stock}). Factura orig: #${incident.originalSaleInvoiceNumber}`);
                batch.set(doc(db, 'productHistory', historyLog.id), historyLog);
            });

            const finalSaleItemsMap = new Map<string, CartItem>();
            itemsToStartFrom.forEach(item => { if (item) finalSaleItemsMap.set(item.id, { ...item }); });
            returnedItems.forEach(returned => {
                const existingItem = finalSaleItemsMap.get(returned.productId);
                if (existingItem) {
                    const newQuantity = existingItem.quantity - returned.quantity;
                    if (newQuantity > 0) { existingItem.quantity = newQuantity; }
                    else { finalSaleItemsMap.delete(returned.productId); }
                }
            });
            takenItems.forEach(taken => {
                const existingItem = finalSaleItemsMap.get(taken.productId);
                const productDetails = inventory.find(p => p.id === taken.productId);
                if (!productDetails) throw new Error(`Producto ${taken.productName} no encontrado al reconstruir la venta.`);
                if (existingItem) { existingItem.quantity += taken.quantity; }
                else { finalSaleItemsMap.set(taken.productId, { ...productDetails, price: taken.price, cost: taken.cost, quantity: taken.quantity }); }
            });

            const newSaleItems: CartItem[] = Array.from(finalSaleItemsMap.values());
            const newTotalAmount = newSaleItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
            let surplusPayment: Payment | undefined;
            if (relatedIncidentId) {
                const adjustmentIncident = incidents.find(i => i.id === relatedIncidentId);
                if (adjustmentIncident) { surplusPayment = { date: adjustmentIncident.createdAt, amount: adjustmentIncident.adjustmentAmount!, method: adjustmentIncident.paymentMethod!, seller: adjustmentIncident.sellerName }; }
            } else if (incident.adjustmentAmount && incident.adjustmentAmount > 0 && incident.paymentMethod) {
                surplusPayment = { date: incident.createdAt, amount: incident.adjustmentAmount, method: incident.paymentMethod, seller: incident.sellerName };
            }
            const newPayments = [...paymentsToStartFrom];
            if (surplusPayment) newPayments.push(surplusPayment);
            
            const originalSaleRef = doc(db, 'sales', originalSaleId);
            batch.update(originalSaleRef, { items: newSaleItems, totalAmount: newTotalAmount, payments: newPayments });
            batch.update(incidentRef, { description: `${incident.description} (Venta #${incident.originalSaleInvoiceNumber} actualizada).` });
            break;

          case IncidentType.INVENTORY_TRANSFER_REQUEST:
            if (incident.status !== IncidentStatus.TRASLADO_SOLICITADO) return;
            newStatus = IncidentStatus.TRASLADO_COMPLETADO;
            const { fromStoreId, toStoreId, productId: transferProductId, quantity } = incident;
            if (!fromStoreId || !toStoreId || !transferProductId || !quantity) throw new Error('Datos de traslado incompletos.');
            
            // FIX: This call was incorrect, passing two arguments to a function expecting one.
            // The handleInventoryTransfer function has been updated to accept an optional batch,
            // allowing this to be part of a larger atomic operation.
            await handleInventoryTransfer({ fromStoreId, toStoreId, productId: transferProductId, quantity, sellerName: incident.sellerName }, batch);
            break;
          default: 
            console.error(`handleApproveIncident called for unhandled or non-approvable type: ${incident.type}`);
            return;
        }
        batch.update(incidentRef, { status: newStatus, resolutionDate: new Date().toISOString() });
        await batch.commit();
    } catch (error: any) {
        console.error("Error approving incident:", error);
        alert(`Error al aprobar: ${error.message}`);
    }
  };

  const handleResolveIncident = async (incidentId: string) => {
    const incident = incidents.find(i => i.id === incidentId);
    if (!incident || !currentUser) return;
    
    const batch = writeBatch(db);
    const incidentRef = doc(db, 'incidents', incidentId);

    let newStatus: IncidentStatus | null = null;
    
    if (incident.type === IncidentType.WARRANTY && incident.status === IncidentStatus.WARRANTY_ACTIVE) {
        newStatus = IncidentStatus.WARRANTY_RETURNED;
    } else if (incident.type === IncidentType.DAMAGED && incident.status === IncidentStatus.EN_ARREGLO_CAMBIO) {
        newStatus = IncidentStatus.DEVUELTO_Y_RESUELTO;
        const { productId } = incident;
        if (productId) {
            const productToReturn = inventory.find(p => p.id === productId);
            if (productToReturn) {
                const productRef = doc(db, 'inventory', productId);
                const updateData: { [key: string]: any } = { stock: increment(1) };
                if (productToReturn.isDisabled) {
                    updateData.isDisabled = false;
                }
                batch.update(productRef, updateData);

                const returnLog = createProductHistoryLog(productToReturn, currentUser.name, ProductChangeType.DAMAGED_RETURNED, `+1 por resolución de daño (antes: ${productToReturn.stock}). Novedad resuelta.`);
                batch.set(doc(db, 'productHistory', returnLog.id), returnLog);
            } else {
                console.warn(`Could not find product with ID ${productId} to return to stock.`);
            }
        }
    }

    if (newStatus) {
      batch.update(incidentRef, { status: newStatus, resolutionDate: new Date().toISOString() });
      await batch.commit();
    } else {
      console.warn(`handleResolveIncident called for unhandled or non-resolvable incident status: ${incident.status}`);
    }
  };

  const handleUpdateIncident = async (incident: Incident) => {
    await setDoc(doc(db, 'incidents', incident.id), incident, { merge: true });
  };
  
  const handleDeleteIncident = async (incidentId: string) => {
    if (window.confirm('¿Estás seguro de que quieres eliminar esta novedad permanentemente? Esta acción no se puede deshacer.')) {
        await deleteDoc(doc(db, 'incidents', incidentId));
    }
  };
  
  const handleLogin = (sellerName: string, passwordAttempt: string) => {
    const seller = sellers.find(s => s.name.trim().toLowerCase() === sellerName.trim().toLowerCase());
    
    if (seller && seller.password.trim() === passwordAttempt.trim()) {
      setCurrentUser(seller);
      setCurrentStoreId(seller.storeId);
      localStorage.setItem('currentStoreId', seller.storeId);

      const sellerRole = roles.find(role => role.id === seller.roleId);
      if (sellerRole && sellerRole.name.toLowerCase() === 'vendedor') {
        setCurrentView(View.POS);
      } else {
        setCurrentView(View.DASHBOARD);
      }
      
      const newLoginRecord: Omit<LoginRecord, 'id'> = { sellerId: seller.id, sellerName: seller.name, date: new Date().toISOString(), storeId: seller.storeId };
      addDoc(collection(db, 'loginHistory'), newLoginRecord);
    } else {
      alert('Usuario o contraseña incorrecta.');
    }
  };
  
  const handleLogout = () => {
    setCurrentUser(null);
    setCurrentStoreId(null);
    localStorage.removeItem('currentStoreId');
    setIsGlobalMode(false);
    
    // Reset store-specific data to empty arrays
    setInventory([]);
    setSales([]);
    setPurchases([]);
    setLayaways([]);
    setStockTakes([]);
    setDailyNotes([]);
    setLoginHistory([]);
    setIncidents([]);
    setProductHistory([]);
    setPayrollHistory([]);
    setCustomers([]);
    
    // Reset global data that's loaded post-login
    setCategories([]);
    setInventoryTransfers([]);
  
    // Reset UI state
    setActiveCart([]);
    setHeldCarts([]);
    setVerifiedProducts(new Set());
  
    // On a normal logout, sellers, stores, and roles are kept for the login screen.
  };
  
  const handleSwitchStore = (storeId: string) => {
    setCurrentStoreId(storeId);
    localStorage.setItem('currentStoreId', storeId);
  }

  const handleToggleGlobalMode = () => {
    const newMode = !isGlobalMode;
    setIsGlobalMode(newMode);
    if (!newMode && currentUser) {
      // When turning off, ensure we are back on the user's default store
      setCurrentStoreId(currentUser.storeId);
    }
  };

  const handleAddToCart = (product: Product) => {
    setActiveCart(prevCart => {
      const existingItem = prevCart.find(item => item.id === product.id);
      if (existingItem) {
        return prevCart.map(item =>
          item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [...prevCart, { ...product, quantity: 1 }];
    });
  };

  const handleUpdateCartQuantity = (productId: string, newQuantity: number) => {
    setActiveCart(prevCart => {
      if (newQuantity <= 0) {
        return prevCart.filter(item => item.id !== productId);
      }
      return prevCart.map(item =>
        item.id === productId ? { ...item, quantity: newQuantity } : item
      );
    });
  };

  const handleUpdateCartItemPrice = (productId: string, newPrice: number) => {
      setActiveCart(prevCart => prevCart.map(item => 
          item.id === productId ? { ...item, price: newPrice } : item
      ));
  };
  
  const handleRemoveFromCart = (productId: string) => {
    setActiveCart(prevCart => prevCart.filter(item => item.id !== productId));
  };

  const handleClearCart = () => {
    setActiveCart([]);
  };
  
  const getNextInvoiceNumber = async (storeId: string): Promise<number> => {
      const storeRef = doc(db, 'stores', storeId);
      const docSnap = await getDoc(storeRef);
      if (docSnap.exists()) {
          return (docSnap.data() as Store).nextInvoiceNumber || 1;
      }
      return 1;
  };

  const handleProcessSale = async (saleData: { payments: Payment[]; customerName: string; customerPhone: string; seller: string; }, saleDate: Date) => {
    if (!currentUser || !currentStoreId) return;

    const saleTimestamp = new Date(saleDate);
    const now = new Date();
    saleTimestamp.setHours(now.getHours(), now.getMinutes(), now.getSeconds(), now.getMilliseconds());
    const finalTimestamp = saleTimestamp.toISOString();

    const batch = writeBatch(db);
    const newSaleRef = doc(collection(db, 'sales'));
    const invoiceNumber = await getNextInvoiceNumber(currentStoreId);
    
    const totalAmount = activeCart.reduce((sum, item) => sum + item.price * item.quantity, 0);

    const newSale: Omit<Sale, 'id'> = {
      ...saleData,
      payments: saleData.payments.map(p => ({ ...p, date: finalTimestamp })),
      invoiceNumber,
      items: activeCart.map(item => ({ ...item })),
      totalAmount,
      createdAt: finalTimestamp,
      storeId: currentStoreId,
    };

    batch.set(newSaleRef, newSale);
    
    for (const item of activeCart) {
      const productRef = doc(db, 'inventory', item.id);
      batch.update(productRef, { stock: increment(-item.quantity) });
      const historyLog = createProductHistoryLog(item, currentUser.name, ProductChangeType.SALE, `-${item.quantity} por venta #${invoiceNumber} (antes: ${item.stock})`);
      batch.set(doc(db, 'productHistory', historyLog.id), historyLog);

      if (item.stock - item.quantity < 0) {
        const negativeStockIncident: Omit<Incident, 'id' | 'status' | 'createdAt' | 'storeId' | 'sellerName'> = {
          type: IncidentType.NEGATIVE_STOCK_SALE,
          description: `Venta de ${item.quantity} unidad(es) de "${item.name}" (SKU: ${item.sku}). Stock anterior: ${item.stock}. Nuevo stock: ${item.stock - item.quantity}. Factura de venta: #${invoiceNumber}.`,
          productId: item.id,
          productName: item.name,
          customerName: saleData.customerName,
          customerPhone: saleData.customerPhone,
        };
        handleCreateIncident(negativeStockIncident);
      }
    }

    const storeRef = doc(db, 'stores', currentStoreId);
    batch.update(storeRef, { nextInvoiceNumber: increment(1) });
    
    if (saleData.customerName !== 'Cliente Mostrador' && saleData.customerPhone !== 'N/A' && saleData.customerPhone.length === 10) {
        const customerQuery = query(collection(db, 'customers'), where('phone', '==', saleData.customerPhone), where('storeId', '==', currentStoreId));
        const customerSnapshot = await getDocs(customerQuery);
        if (customerSnapshot.empty) {
            const newCustomerRef = doc(collection(db, 'customers'));
            const newCustomer: Omit<Customer, 'id'> = { name: saleData.customerName, phone: saleData.customerPhone, storeId: currentStoreId, createdAt: new Date().toISOString() };
            batch.set(newCustomerRef, newCustomer);
        }
    }

    try {
        await batch.commit();
        setSaleForReceipt({ ...newSale, id: newSaleRef.id });
        setShowReceiptModal(true);
        handleClearCart();
    } catch (error) {
        console.error("Error processing sale:", error);
        alert("Hubo un error al procesar la venta. El stock podría no estar actualizado. Por favor, verifica.");
    }
  };
  
  const handleHoldSale = (data?: { customer?: { name: string; phone: string }; sellerName?: string; }) => {
    if (!currentStoreId) return;
    if (activeCart.length === 0) {
      alert("No puedes poner en espera un carrito vacío.");
      return;
    }
    
    const newHeldCartData: { [key: string]: any } = {
        items: activeCart.map(item => ({...item})), // Clean the items
        storeId: currentStoreId,
    };
    
    if (data?.customer?.name) newHeldCartData.customerName = data.customer.name;
    if (data?.customer?.phone) newHeldCartData.customerPhone = data.customer.phone;
    if (data?.sellerName) newHeldCartData.sellerName = data.sellerName;

    addDoc(collection(db, 'heldCarts'), newHeldCartData);
    handleClearCart();
  };

  const handleResumeSale = (heldCartId: string) => {
    const heldCart = heldCarts.find(c => c.id === heldCartId);
    if (heldCart) {
      setActiveCart(heldCart.items);
      deleteDoc(doc(db, 'heldCarts', heldCartId));
    }
  };

  const handleCreateLayaway = async (customerName: string, customerPhone: string, invoiceNumber: string, seller: string, initialPayment: { amount: number; method: PaymentMethod; }, saleDate: Date, isPreOrder: boolean, description?: string) => {
    if (!currentUser || !currentStoreId) return;
    
    if (activeCart.length === 0) {
      alert("El carrito está vacío.");
      return;
    }
    
    const layawayTimestamp = new Date(saleDate);
    const now = new Date();
    layawayTimestamp.setHours(now.getHours(), now.getMinutes(), now.getSeconds(), now.getMilliseconds());
    const finalTimestamp = layawayTimestamp.toISOString();
  
    const batch = writeBatch(db);
    const newLayawayRef = doc(collection(db, 'layaways'));
    
    const totalAmount = activeCart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  
    const newLayaway: Omit<Layaway, 'id'> = {
      invoiceNumber,
      customerName,
      customerPhone,
      items: activeCart.map(item => ({ ...item })),
      totalAmount,
      paidAmount: initialPayment.amount,
      payments: [{...initialPayment, date: finalTimestamp, seller}],
      status: isPreOrder ? 'pre-order' : 'active',
      createdAt: finalTimestamp,
      seller,
      storeId: currentStoreId,
      ...(isPreOrder && { description: description || '' }),
    };
  
    batch.set(newLayawayRef, newLayaway);
  
    if (!isPreOrder) {
      for (const item of activeCart) {
        const productRef = doc(db, 'inventory', item.id);
        batch.update(productRef, { stock: increment(-item.quantity) });
        const historyLog = createProductHistoryLog(item, currentUser.name, ProductChangeType.LAYAWAY_RESERVED, `-${item.quantity} por abono #${invoiceNumber} (antes: ${item.stock})`);
        batch.set(doc(db, 'productHistory', historyLog.id), historyLog);

        if (item.stock - item.quantity < 0) {
            const negativeStockIncident: Omit<Incident, 'id' | 'status' | 'createdAt' | 'storeId' | 'sellerName'> = {
              type: IncidentType.NEGATIVE_STOCK_SALE,
              description: `Abono de ${item.quantity} unidad(es) de "${item.name}" (SKU: ${item.sku}). Stock anterior: ${item.stock}. Nuevo stock: ${item.stock - item.quantity}. Abono: #${invoiceNumber}.`,
              productId: item.id,
              productName: item.name,
              customerName: customerName,
              customerPhone: customerPhone,
            };
            handleCreateIncident(negativeStockIncident);
        }
      }
    }
    
    if (customerName.trim() && customerPhone.trim().length === 10) {
        const customerQuery = query(collection(db, 'customers'), where('phone', '==', customerPhone), where('storeId', '==', currentStoreId));
        const customerSnapshot = await getDocs(customerQuery);
        if (customerSnapshot.empty) {
            const newCustomerRef = doc(collection(db, 'customers'));
            const newCustomer: Omit<Customer, 'id'> = { name: customerName, phone: customerPhone, storeId: currentStoreId, createdAt: new Date().toISOString() };
            batch.set(newCustomerRef, newCustomer);
        }
    }
  
    await batch.commit();
    handleClearCart();
  };

  const handleAddPaymentToLayaway = async (layawayId: string, amount: number, method: PaymentMethod, seller: string) => {
    const layaway = layaways.find(l => l.id === layawayId);
    if (!layaway) return;

    const newPayment: Payment = {
      date: new Date().toISOString(),
      amount,
      method,
      seller,
    };

    const layawayRef = doc(db, 'layaways', layawayId);
    await updateDoc(layawayRef, {
      payments: [...layaway.payments, newPayment],
      paidAmount: increment(amount),
    });
  };

  const handleFulfillPreOrder = async (layawayId: string) => {
    if (!currentUser) return;
    const layaway = layaways.find(l => l.id === layawayId);
    if (!layaway || layaway.status !== 'pre-order') return;

    const batch = writeBatch(db);
    const layawayRef = doc(db, 'layaways', layawayId);

    // Deduct stock
    for (const item of layaway.items) {
      const product = inventory.find(p => p.id === item.id);
      if (product) {
        const productRef = doc(db, 'inventory', item.id);
        batch.update(productRef, { stock: increment(-item.quantity) });

        const historyLog = createProductHistoryLog(product, currentUser.name, ProductChangeType.PRE_ORDER_FULFILLED, `-${item.quantity} por surtir pre-orden #${layaway.invoiceNumber} (antes: ${product.stock})`);
        batch.set(doc(db, 'productHistory', historyLog.id), historyLog);
        
        if (product.stock < item.quantity) {
          alert(`Alerta: El stock de "${item.name}" quedará negativo. Disponible: ${product.stock}, Necesario: ${item.quantity}.`);
          const negativeStockIncident: Omit<Incident, 'id' | 'status' | 'createdAt' | 'storeId' | 'sellerName'> = {
              type: IncidentType.NEGATIVE_STOCK_SALE,
              description: `Surtido de pre-orden de ${item.quantity} unidad(es) de "${item.name}" (SKU: ${item.sku}). Stock anterior: ${product.stock}. Nuevo stock: ${product.stock - item.quantity}. Abono: #${layaway.invoiceNumber}.`,
              productId: item.id,
              productName: item.name,
              customerName: layaway.customerName,
              customerPhone: layaway.customerPhone,
            };
          handleCreateIncident(negativeStockIncident);
        }
      } else {
        alert(`Producto "${item.name}" no encontrado en el inventario. El stock no se descontará.`);
      }
    }

    batch.update(layawayRef, { status: 'active' });
    await batch.commit();
  };

  const handleDeleteLayaway = async (layawayId: string) => {
    if (!currentUser) return;
    if (!window.confirm("¿Estás seguro de que quieres eliminar este abono? El stock de los productos asociados será devuelto si el abono estaba activo.")) return;

    const layaway = layaways.find(l => l.id === layawayId);
    if (!layaway) return;
    
    const batch = writeBatch(db);
    const layawayRef = doc(db, 'layaways', layawayId);

    // Return stock to inventory if it was an active layaway
    if (layaway.status === 'active') {
        for (const item of layaway.items) {
            const product = inventory.find(p => p.id === item.id);
            if (product) {
                const productRef = doc(db, 'inventory', item.id);
                const updateData: { [key: string]: any } = { stock: increment(item.quantity) };
                if (product.isDisabled) {
                    updateData.isDisabled = false;
                }
                batch.update(productRef, updateData);

                const historyLog = createProductHistoryLog(product, currentUser.name, ProductChangeType.LAYAWAY_DELETED, `+${item.quantity} por eliminación de abono #${layaway.invoiceNumber} (antes: ${product.stock})`);
                batch.set(doc(db, 'productHistory', historyLog.id), historyLog);
            }
        }
    }

    batch.delete(layawayRef);
    await batch.commit();
  };

  const handleUpdateLayaway = async (updatedLayaway: Layaway, originalLayaway: Layaway) => {
    if (!currentUser) return;
    const batch = writeBatch(db);
    const layawayRef = doc(db, 'layaways', updatedLayaway.id);

    const originalItems = new Map((originalLayaway.items || []).filter(Boolean).map(item => [item.id, item.quantity]));
    const updatedItems = new Map((updatedLayaway.items || []).filter(Boolean).map(item => [item.id, item.quantity]));
    const allItemIds = new Set([...originalItems.keys(), ...updatedItems.keys()]);
    
    try {
        // Scenarios for stock adjustment based on STATUS change
        if (originalLayaway.status !== 'pre-order' && updatedLayaway.status === 'pre-order') {
            // Became a pre-order, return all original items to stock
            originalItems.forEach((quantity, productId) => {
                const product = inventory.find(p => p.id === productId);
                if (product) {
                    const updateData: { [key: string]: any } = { stock: increment(quantity) };
                    if (product.isDisabled) {
                        updateData.isDisabled = false;
                    }
                    batch.update(doc(db, 'inventory', productId), updateData);
                    const log = createProductHistoryLog(product, currentUser.name, ProductChangeType.LAYAWAY_DELETED, `+${quantity} por cambio a pre-orden abono #${originalLayaway.invoiceNumber} (antes: ${product.stock})`);
                    batch.set(doc(db, 'productHistory', log.id), log);
                }
            });
        } else if (originalLayaway.status === 'pre-order' && updatedLayaway.status !== 'pre-order') {
            // No longer a pre-order, deduct new items from stock
            for (const [productId, quantity] of updatedItems.entries()) {
                const product = inventory.find(p => p.id === productId);
                if (product) {
                    batch.update(doc(db, 'inventory', productId), { stock: increment(-quantity) });
                    const log = createProductHistoryLog(product, currentUser.name, ProductChangeType.LAYAWAY_RESERVED, `-${quantity} por cambio desde pre-orden abono #${updatedLayaway.invoiceNumber} (antes: ${product.stock})`);
                    batch.set(doc(db, 'productHistory', log.id), log);
                }
            }
        } else if (originalLayaway.status !== 'pre-order' && updatedLayaway.status !== 'pre-order') {
            // Neither was/is a pre-order, calculate delta of items
            for (const productId of allItemIds) {
                const originalQty = originalItems.get(productId) || 0;
                const updatedQty = updatedItems.get(productId) || 0;
                const diff = originalQty - updatedQty; // positive if items returned, negative if items added
                if (diff !== 0) {
                    const product = inventory.find(p => p.id === productId);
                    if (product) {
                        const updateData: { [key: string]: any } = { stock: increment(diff) };
                        if (diff > 0 && product.isDisabled) {
                            updateData.isDisabled = false;
                        }
                        batch.update(doc(db, 'inventory', productId), updateData);
                        const log = createProductHistoryLog(product, currentUser.name, ProductChangeType.LAYAWAY_DELETED, `${diff > 0 ? '+': ''}${diff} por edición de abono #${originalLayaway.invoiceNumber} (antes: ${product.stock})`);
                        batch.set(doc(db, 'productHistory', log.id), log);
                    }
                }
            }
        }
        
        batch.set(layawayRef, updatedLayaway);
        await batch.commit();
    } catch(e: any) {
        alert(`Error al actualizar el abono: ${e.message}`);
        console.error(e);
    }
  };
  
  const handleSaveStockTake = async (stockTakeData: Omit<StockTake, 'id' | 'createdAt' | 'storeId'>) => {
    if (!currentStoreId) return;
    const newStockTake: Omit<StockTake, 'id'> = {
      ...stockTakeData,
      createdAt: new Date().toISOString(),
      storeId: currentStoreId
    };
    await addDoc(collection(db, 'stockTakes'), newStockTake);
  };
  
  const handleAddDailyNote = async (content: string, seller: string) => {
    if (!currentStoreId) return;
    const newNote: Omit<DailyNote, 'id'> = {
      content,
      seller,
      createdAt: new Date().toISOString(),
      storeId: currentStoreId
    };
    await addDoc(collection(db, 'dailyNotes'), newNote);
  };
  
  const handleDeleteStockTake = async (stockTakeId: string) => {
    if (window.confirm('¿Estás seguro de que quieres eliminar este registro de conteo permanentemente? Esta acción no se puede deshacer.')) {
      try {
        await deleteDoc(doc(db, 'stockTakes', stockTakeId));
        alert('Registro de conteo eliminado.');
      } catch (error) {
        console.error("Error deleting stock take:", error);
        alert("No se pudo eliminar el registro de conteo.");
      }
    }
  };

  const handleAddNoteToStockTake = async (stockTakeId: string, noteContent: string) => {
    if (!currentUser) return;

    const stockTakeRef = doc(db, 'stockTakes', stockTakeId);
    const newNote = {
      content: noteContent,
      author: currentUser.name,
      date: new Date().toISOString()
    };
    
    try {
      await updateDoc(stockTakeRef, {
        notes: arrayUnion(newNote)
      });
    } catch (error) {
      console.error("Error adding note to stock take:", error);
      alert("No se pudo agregar la nota.");
    }
  };
  
  const handleAddProduct = async (
    newProductData: Omit<Product, 'id' | 'sku' | 'storeId' | 'imageUrl'>,
    selectedStoreIds: string[],
    imageFile?: File
  ) => {
    if (!currentUser) return;
  
    try {
      if (isNaN(newProductData.price) || isNaN(newProductData.cost) || isNaN(newProductData.stock)) {
        throw new Error("El precio, costo y stock deben ser números válidos.");
      }
  
      let imageUrl = '';
      if (imageFile) {
        const storeSettings = stores.find(s => s.id === selectedStoreIds[0]);
        const quality = storeSettings?.imageCompressionQuality || 'medium';
        imageUrl = await uploadImageAndGetURL(imageFile, quality);
      } else {
        const q = query(collection(db, 'inventory'), where('name', '==', newProductData.name), limit(1));
        const snapshot = await getDocs(q);
        if (!snapshot.empty) {
          const existingProd = snapshot.docs[0].data() as Product;
          if (existingProd.imageUrl) {
            imageUrl = existingProd.imageUrl;
          }
        }
      }
  
      const batch = writeBatch(db);
  
      for (const storeId of selectedStoreIds) {
        const store = stores.find(s => s.id === storeId);
        if (!store) continue;
  
        const newDocRef = doc(collection(db, 'inventory'));
        const sku = `${newProductData.categoryId}-${store.name.substring(0, 3).toUpperCase()}-${newDocRef.id.substring(0, 4).toUpperCase()}`;
  
        const newProduct: Omit<Product, 'id'> = {
          ...newProductData,
          sku,
          imageUrl,
          storeId: storeId,
          isDisabled: false,
        };
  
        batch.set(newDocRef, newProduct);
        const historyLog = createProductHistoryLog({ ...newProduct, id: newDocRef.id }, currentUser.name, ProductChangeType.CREATED, `+${newProduct.stock} por creación.`);
        batch.set(doc(db, 'productHistory', historyLog.id), historyLog);
      }
  
      if (imageFile && imageUrl) {
        const allMatchingProductsQuery = query(collection(db, 'inventory'), where('name', '==', newProductData.name));
        const allMatchingSnapshot = await getDocs(allMatchingProductsQuery);
        allMatchingSnapshot.docs.forEach(doc => {
          batch.update(doc.ref, { imageUrl: imageUrl });
        });
      }
  
      await batch.commit();
    } catch (error: any) {
      console.error("Error al agregar producto(s):", error);
      alert(`No se pudo crear el producto. Error: ${error.message}`);
      throw error;
    }
  };
  
  const handleUpdateProduct = async (updatedProductData: Product, imageFile?: File): Promise<void> => {
    if (!currentUser) return Promise.reject("No user logged in");
  
    const batch = writeBatch(db);
    const mainProductRef = doc(db, 'inventory', updatedProductData.id);
    let finalProductData = { ...updatedProductData };
    let newImageUrl: string | null = null;
  
    try {
      // If a disabled product receives stock (e.g. from manual edit), re-enable it automatically.
      const originalProduct = inventory.find(p => p.id === updatedProductData.id);
      if (originalProduct && originalProduct.isDisabled && finalProductData.stock > 0) {
          finalProductData.isDisabled = false;
      }
        
      if (imageFile) {
        const storeSettings = stores.find(s => s.id === finalProductData.storeId);
        const quality = storeSettings?.imageCompressionQuality || 'medium';
        newImageUrl = await uploadImageAndGetURL(imageFile, quality);
        finalProductData.imageUrl = newImageUrl;
      }
  
      // Update the main product in the batch
      batch.set(mainProductRef, finalProductData, { merge: true });
  
      // If a new image was uploaded and the name hasn't changed, sync the image
      if (newImageUrl && originalProduct && originalProduct.name === updatedProductData.name) {
        const allMatchingProductsQuery = query(collection(db, 'inventory'), where('name', '==', updatedProductData.name));
        const allMatchingSnapshot = await getDocs(allMatchingProductsQuery);
        allMatchingSnapshot.docs.forEach(doc => {
          if (doc.id !== updatedProductData.id) {
            batch.update(doc.ref, { imageUrl: newImageUrl });
          }
        });
      }
  
      // History log for stock change
      if (originalProduct && originalProduct.stock !== updatedProductData.stock) {
        const stockChange = updatedProductData.stock - originalProduct.stock;
        const sign = stockChange > 0 ? '+' : '';
        const details = `Ajuste de stock: ${sign}${stockChange} (antes: ${originalProduct.stock}, ahora: ${updatedProductData.stock})`;
        const historyLog = createProductHistoryLog(updatedProductData, currentUser.name, ProductChangeType.MANUAL_EDIT, details);
        batch.set(doc(db, 'productHistory', historyLog.id), historyLog);
      }
  
      await batch.commit();
  
    } catch (error) {
      console.error("Error updating product:", error);
      throw error;
    }
  };
  
   const handleBulkAddProducts = async (
    productsToAdd: {
      name: string;
      price: number;
      cost: number;
      stock: number;
      categoryName: string;
      supplier?: string;
      description?: string;
      imageUrl?: string;
    }[],
    storeId: string
  ) => {
    if (!currentUser) return;
    
    let existingCategories = [...categories];

    const batch = writeBatch(db);
    try {
      for (const productData of productsToAdd) {
          if(isNaN(productData.price) || isNaN(productData.cost) || isNaN(productData.stock)) {
            throw new Error(`Datos numéricos inválidos para el producto "${productData.name}".`);
          }

          let categoryId = existingCategories.find(c => c.name.toLowerCase() === productData.categoryName.toLowerCase())?.id;
          
          if (!categoryId) {
              const newCategoryRef = doc(collection(db, 'categories'));
              categoryId = newCategoryRef.id;
              const newCategory = { id: categoryId, name: productData.categoryName };
              batch.set(newCategoryRef, { name: productData.categoryName });
              existingCategories.push(newCategory);
          }

          const store = stores.find(s => s.id === storeId);
          if (!store) continue;

          const newDocRef = doc(collection(db, 'inventory'));
          const sku = `${categoryId}-${store.name.substring(0,3).toUpperCase()}-${newDocRef.id.substring(0, 4).toUpperCase()}`;
          
          const newProduct: Omit<Product, 'id'> = {
              name: productData.name,
              price: productData.price,
              cost: productData.cost,
              stock: productData.stock,
              description: productData.description || 'Descripción pendiente...',
              supplier: productData.supplier,
              imageUrl: productData.imageUrl || '',
              categoryId,
              sku,
              storeId,
              isDisabled: false,
          };
          
          batch.set(newDocRef, newProduct);
          const historyLog = createProductHistoryLog({ ...newProduct, id: newDocRef.id }, currentUser.name, ProductChangeType.PURCHASE, `+${newProduct.stock} por carga masiva.`);
          batch.set(doc(db, 'productHistory', historyLog.id), historyLog);
      }
      await batch.commit();
    } catch (error: any) {
        console.error("Error en la carga masiva de productos:", error);
        alert(`No se pudieron agregar los productos. Error: ${error.message}`);
    }
  };
  
  const handleRecompressAllImages = async (storeId: string, quality: 'low' | 'medium' | 'high') => {
      if (!window.confirm(`Esto volverá a procesar y subir TODAS las imágenes de los productos para la tienda seleccionada. Puede tardar varios minutos y es irreversible. ¿Continuar?`)) return;

      setIsRecompressing(true);
      setRecompressProgress({ current: 0, total: 0 });

      try {
          const productsToUpdate = inventory.filter(p => p.storeId === storeId && p.imageUrl && !p.imageUrl.startsWith('data:'));
          setRecompressProgress({ current: 0, total: productsToUpdate.length });

          for (let i = 0; i < productsToUpdate.length; i++) {
              const product = productsToUpdate[i];
              try {
                  const newImageUrl = await reuploadImageFromUrl(product.imageUrl, quality);
                  await updateDoc(doc(db, 'inventory', product.id), { imageUrl: newImageUrl });
                  console.log(`Recompressed ${product.name} successfully.`);
              } catch (error) {
                  console.error(`Failed to recompress image for ${product.name}:`, error);
              }
              setRecompressProgress(prev => ({ ...prev, current: i + 1 }));
          }
          alert('Optimización de imágenes completada.');
      } catch (error) {
          console.error("Error during image recompression:", error);
          alert('Hubo un error durante el proceso de optimización.');
      } finally {
          setIsRecompressing(false);
      }
  };

// @FIX: Renamed function to resolve redeclaration error. This function is for SettingsView.
  const handleSaveStoreSettings = async (updatedStore: Store) => {
    const storeRef = doc(db, 'stores', updatedStore.id);
    await setDoc(storeRef, updatedStore, { merge: true });
    alert(`Ajustes de la tienda "${updatedStore.name}" guardados.`);
  };
  
  const handleResetStoreData = async (storeId: string) => {
    const storeName = stores.find(s => s.id === storeId)?.name;
    const confirmation = prompt(`Esta acción es IRREVERSIBLE. Para confirmar, escribe el nombre de la tienda que quieres reiniciar: "${storeName}"`);
    
    if (confirmation !== storeName) {
      alert("La confirmación no coincide. Operación cancelada.");
      return;
    }

    try {
      const collectionsToDelete = ['sales', 'purchases', 'layaways', 'stockTakes', 'dailyNotes', 'loginHistory', 'incidents', 'productHistory', 'payrollHistory', 'customers', 'heldCarts'];
      const batch = writeBatch(db);

      // Delete inventory for the store
      const inventorySnapshot = await getDocs(query(collection(db, 'inventory'), where('storeId', '==', storeId)));
      inventorySnapshot.docs.forEach(doc => batch.delete(doc.ref));

      // Delete other collections
      for (const collectionName of collectionsToDelete) {
        const snapshot = await getDocs(query(collection(db, collectionName), where('storeId', '==', storeId)));
        snapshot.docs.forEach(doc => batch.delete(doc.ref));
      }

      await batch.commit();
      alert(`Todos los datos para la tienda "${storeName}" han sido eliminados.`);
    } catch (error) {
      console.error("Error reseteando los datos de la tienda:", error);
      alert("Hubo un error al eliminar los datos.");
    }
  };

  const handleGenerateTestData = async () => {
    if (!window.confirm("¿Seguro que quieres generar 100 productos de prueba en CADA tienda? Esto puede tardar y no se puede deshacer fácilmente.")) return;
    
    const batch = writeBatch(db);

    for (const store of stores) {
        for (let i = 0; i < 100; i++) {
            const newDocRef = doc(collection(db, 'inventory'));
            const category = INITIAL_CATEGORIES[Math.floor(Math.random() * INITIAL_CATEGORIES.length)];
            const newProduct: Omit<Product, 'id'> = {
                name: `Producto de Prueba ${i + 1} (${store.name.substring(0,2)})`,
                description: "Este es un producto generado automáticamente para pruebas de rendimiento.",
                price: Math.floor(Math.random() * 100 + 50) * 1000,
                cost: Math.floor(Math.random() * 40 + 20) * 1000,
                stock: Math.floor(Math.random() * 50),
                imageUrl: "",
                categoryId: category.id,
                supplier: "Proveedor Test",
                storeId: store.id,
                sku: `TEST-${store.name.substring(0,3).toUpperCase()}-${newDocRef.id.substring(0, 4)}`,
            };
            batch.set(newDocRef, newProduct);
        }
    }
    
    try {
        await batch.commit();
        alert("Datos de prueba generados exitosamente.");
    } catch (error) {
        console.error("Error generando datos de prueba:", error);
        alert("Error al generar datos de prueba.");
    }
  };
  
  const handleReactivateAllProducts = async () => {
    if (!window.confirm('¿Estás seguro de que quieres reactivar TODOS los productos descontinuados en TODAS las tiendas? Esta acción es masiva y no se puede deshacer fácilmente.')) {
      return;
    }

    try {
      console.log("Iniciando la reactivación de todos los productos...");
      const snapshot = await getDocs(query(collection(db, 'inventory'), where('isDisabled', '==', true)));
      
      if (snapshot.empty) {
        alert("No se encontraron productos descontinuados para reactivar.");
        return;
      }

      const batch = writeBatch(db);
      snapshot.docs.forEach(doc => {
        batch.update(doc.ref, { isDisabled: false });
      });

      await batch.commit();
      alert(`¡Éxito! Se han reactivado ${snapshot.size} productos.`);
      console.log(`${snapshot.size} productos han sido reactivados.`);

    } catch (error) {
      console.error("Error al reactivar productos:", error);
      alert("Ocurrió un error al intentar reactivar los productos. Revisa la consola para más detalles.");
    }
  };

  const handleReactivateInconsistentProducts = async (productIds: string[]) => {
    if (!currentUser) return;
    if (productIds.length === 0) return;

    if (!window.confirm(`¿Estás seguro de que quieres reactivar ${productIds.length} producto(s)? Se marcarán como habilitados.`)) {
      return;
    }

    const batch = writeBatch(db);
    let reactivatedCount = 0;

    for (const productId of productIds) {
      const product = inventory.find(p => p.id === productId); 
      if (product) {
        const productRef = doc(db, 'inventory', productId);
        batch.update(productRef, { isDisabled: false });

        const historyLog = createProductHistoryLog(
          product,
          currentUser.name,
          ProductChangeType.INCONSISTENCY_FIX,
          `Producto reactivado automáticamente por tener stock (${product.stock} uds) mientras estaba descontinuado.`
        );
        batch.set(doc(db, 'productHistory', historyLog.id), historyLog);
        reactivatedCount++;
      }
    }

    try {
      await batch.commit();
      alert(`${reactivatedCount} producto(s) han sido reactivados exitosamente.`);
    } catch (error) {
      console.error("Error reactivating inconsistent products:", error);
      alert("Ocurrió un error al intentar reactivar los productos.");
    }
  };

  const handleMultiStorePurchase = async (data: {
    productInfo: { name: string; categoryId: string; };
    storeEntries: Record<string, { quantity: number; cost: number; price: number; supplier: string }>;
    }) => {
    if (!currentUser) return;

    const { productInfo, storeEntries } = data;
    const batch = writeBatch(db);
    
    try {
        const existingProductQuery = query(collection(db, 'inventory'), where('name', '==', productInfo.name), limit(1));
        const existingProductSnapshot = await getDocs(existingProductQuery);
        const existingProductData = existingProductSnapshot.empty ? null : existingProductSnapshot.docs[0].data() as Product;
    
        const sharedImageUrl = existingProductData?.imageUrl || '';
        const sharedDescription = existingProductData?.description || 'Descripción pendiente...';
    
        for (const storeId in storeEntries) {
            const entry = storeEntries[storeId];
            if(isNaN(entry.quantity) || isNaN(entry.cost) || isNaN(entry.price)) {
              throw new Error(`Datos numéricos inválidos para la tienda ${stores.find(s=>s.id === storeId)?.name}.`);
            }
    
            const productQuery = query(collection(db, 'inventory'), where('storeId', '==', storeId), where('name', '==', productInfo.name));
            const productSnapshot = await getDocs(productQuery);
            let productRef: DocumentReference;
            let previousStock = 0;
            let productForLog: Product;
            
            if (!productSnapshot.empty) {
                const productDoc = productSnapshot.docs[0];
                productRef = productDoc.ref;
                const existingProductInStore = { id: productDoc.id, ...productDoc.data() } as Product;
                previousStock = existingProductInStore.stock;
                productForLog = existingProductInStore;

                const updatePayload: { [key: string]: any } = {
                    stock: increment(entry.quantity),
                    cost: entry.cost,
                    price: entry.price,
                    supplier: entry.supplier,
                };
                if (existingProductInStore.isDisabled) {
                    updatePayload.isDisabled = false;
                }
    
                batch.update(productRef, updatePayload);
            } else {
                productRef = doc(collection(db, 'inventory'));
                const store = stores.find(s => s.id === storeId)!;
                const sku = `${productInfo.categoryId}-${store.name.substring(0,3).toUpperCase()}-${productRef.id.substring(0, 4).toUpperCase()}`;
    
                const newProduct: Omit<Product, 'id'> = {
                    name: productInfo.name,
                    sku,
                    description: sharedDescription,
                    price: entry.price,
                    cost: entry.cost,
                    stock: entry.quantity,
                    imageUrl: sharedImageUrl,
                    categoryId: productInfo.categoryId,
                    supplier: entry.supplier,
                    storeId,
                    isDisabled: false,
                };
                batch.set(productRef, newProduct);
                productForLog = { ...newProduct, id: productRef.id };
            }
    
            const newPurchaseRef = doc(collection(db, 'purchases'));
            const newPurchase: Omit<Purchase, 'id'> = {
                productId: productRef.id,
                productName: productInfo.name,
                quantity: entry.quantity,
                cost: entry.cost,
                totalCost: entry.quantity * entry.cost,
                supplier: entry.supplier,
                createdAt: new Date().toISOString(),
                storeId,
            };
            batch.set(newPurchaseRef, newPurchase);
            
            const historyLog = createProductHistoryLog(
                productForLog,
                currentUser.name,
                ProductChangeType.PURCHASE,
                `+${entry.quantity} por compra (antes: ${previousStock})`
            );
            batch.set(doc(db, 'productHistory', historyLog.id), historyLog);
        }
    
        await batch.commit();
    } catch (error: any) {
        console.error("Error en la compra multi-tienda:", error);
        // Alert is now removed, error is thrown to be handled by the calling component
        throw error;
    }
  };

  const handleUpdatePurchase = async (updatedPurchase: Purchase, originalQuantity: number, newProductPrice: number) => {
    if (!currentUser) return;

    const batch = writeBatch(db);
    const purchaseRef = doc(db, 'purchases', updatedPurchase.id);
    batch.update(purchaseRef, updatedPurchase);

    const productRef = doc(db, 'inventory', updatedPurchase.productId);
    const productDoc = await getDoc(productRef);
    if (productDoc.exists()) {
        const product = { id: productDoc.id, ...productDoc.data() } as Product;
        const stockChange = updatedPurchase.quantity - originalQuantity;
        
        const updatePayload: { [key: string]: any } = {
            stock: increment(stockChange),
            price: newProductPrice,
            cost: updatedPurchase.cost,
            supplier: updatedPurchase.supplier,
        };

        if (stockChange > 0 && product.isDisabled) {
            updatePayload.isDisabled = false;
        }

        batch.update(productRef, updatePayload);

        const sign = stockChange >= 0 ? '+' : '';
        const historyLog = createProductHistoryLog(
            product,
            currentUser.name,
            ProductChangeType.PURCHASE_EDIT,
            `Ajuste de stock: ${sign}${stockChange} por edición de compra (antes: ${product.stock})`
        );
        batch.set(doc(db, 'productHistory', historyLog.id), historyLog);
    }

    await batch.commit();
  };
  
  const handleDeletePurchase = async (purchaseId: string) => {
    if (!currentUser) return;
    if (!window.confirm('¿Seguro que quieres eliminar esta compra? El stock del producto se reducirá si se encuentra.')) return;

    try {
        const batch = writeBatch(db);
        const purchaseRef = doc(db, 'purchases', purchaseId);
        const purchaseDoc = await getDoc(purchaseRef);

        if (!purchaseDoc.exists()) {
            alert("No se pudo encontrar el registro de la compra para eliminar.");
            return;
        }

        const purchase = purchaseDoc.data() as Purchase;
        
        if (!purchase.productId) {
            alert("El registro de compra está corrupto (falta el ID del producto). Se eliminará el registro sin afectar el stock.");
            batch.delete(purchaseRef);
            await batch.commit();
            return;
        }

        const productRef = doc(db, 'inventory', purchase.productId);
        const productDoc = await getDoc(productRef);

        if (productDoc.exists()) {
            const product = { id: productDoc.id, ...productDoc.data() } as Product;
            batch.update(productRef, {
                stock: increment(-purchase.quantity)
            });

            const historyLog = createProductHistoryLog(
                product,
                currentUser.name,
                ProductChangeType.PURCHASE_DELETE,
                `-${purchase.quantity} por eliminación de compra (antes: ${product.stock})`
            );
            batch.set(doc(db, 'productHistory', historyLog.id), historyLog);
        } else {
            alert(`El producto asociado a esta compra (ID: ${purchase.productId}) no fue encontrado. El stock no será ajustado, pero el registro de la compra será eliminado.`);
        }

        batch.delete(purchaseRef);
        await batch.commit();
    } catch (error: any) {
        console.error("Error deleting purchase:", error);
        alert(`Ocurrió un error al eliminar la compra: ${error.message}`);
    }
  };

  const handleUpdateSale = async (updatedSale: Sale, originalSale: Sale) => {
    if (!currentUser) return;

    try {
        const batch = writeBatch(db);
        const saleRef = doc(db, 'sales', updatedSale.id);

        const originalItemsMap = new Map(((Array.isArray(originalSale.items) ? originalSale.items : Object.values(originalSale.items || {})) as CartItem[]).filter(Boolean).map(item => [item.id, item.quantity]));
        const updatedItemsMap = new Map(((Array.isArray(updatedSale.items) ? updatedSale.items : Object.values(updatedSale.items || {})) as CartItem[]).filter(Boolean).map(item => [item.id, item.quantity]));
        const allItemIds = new Set([...originalItemsMap.keys(), ...updatedItemsMap.keys()]);

        for (const itemId of allItemIds) {
            const originalQty = originalItemsMap.get(itemId) || 0;
            const updatedQty = updatedItemsMap.get(itemId) || 0;
            // FIX: Explicitly cast quantities to Number before performing subtraction to prevent arithmetic operation errors when types are inferred incorrectly from Firestore data structures.
            const stockChange = Number(originalQty) - Number(updatedQty);

            if (stockChange !== 0) {
                const product = inventory.find(p => p.id === itemId);
                if (product) {
                    const productRef = doc(db, 'inventory', itemId);
                    if (stockChange < 0 && product.stock < Math.abs(stockChange)) {
                        throw new Error(`Stock insuficiente para "${product.name}". Se necesitan ${Math.abs(stockChange)} más, pero solo hay ${product.stock} disponibles.`);
                    }
                    
                    const updatePayload: { [key: string]: any } = { stock: increment(stockChange) };

                    if (stockChange > 0 && product.isDisabled) { // stock is being returned
                        updatePayload.isDisabled = false;
                    }

                    batch.update(productRef, updatePayload);

                    const historyLog = createProductHistoryLog(
                        product,
                        currentUser.name,
                        ProductChangeType.RETURN,
                        `${stockChange > 0 ? '+' : ''}${stockChange} por edición de venta #${originalSale.invoiceNumber} (antes: ${product.stock})`
                    );
                    batch.set(doc(db, 'productHistory', historyLog.id), historyLog);
                }
            }
        }

        batch.set(saleRef, updatedSale);
        await batch.commit();
    } catch (error: any) {
        console.error("Error updating sale:", error);
        alert(`Error al actualizar la venta: ${error.message}`);
    }
  };
  
  const handleDeleteSale = async (saleId: string) => {
    if (!currentUser) return;
    if (!window.confirm('¿Estás seguro de que quieres eliminar esta venta permanentemente? Esta acción es irreversible y devolverá los productos al inventario.')) {
        return;
    }

    try {
        const saleToDelete = sales.find(s => s.id === saleId);
        if (!saleToDelete) {
            throw new Error("Venta no encontrada.");
        }

        const batch = writeBatch(db);

        // Restore stock for each item in the sale
        const itemsArray = (Array.isArray(saleToDelete.items) ? saleToDelete.items : Object.values(saleToDelete.items || {})).filter(Boolean) as CartItem[];
        for (const item of itemsArray) {
            if (item && item.id) {
                const productRef = doc(db, 'inventory', item.id);
                const productForLog = inventory.find(p => p.id === item.id);
                const updatePayload: { [key: string]: any } = { stock: increment(item.quantity) };

                if (productForLog && productForLog.isDisabled) {
                    updatePayload.isDisabled = false;
                }

                // Use FieldValue.increment to handle concurrent updates safely
                batch.update(productRef, updatePayload);

                // Create a history log for the stock return
                if (productForLog) {
                    const historyLog = createProductHistoryLog(
                        productForLog,
                        currentUser.name,
                        ProductChangeType.SALE_DELETED,
                        `+${item.quantity} por eliminación de venta #${saleToDelete.invoiceNumber} (antes: ${productForLog.stock})`
                    );
                    batch.set(doc(db, 'productHistory', historyLog.id), historyLog);
                }
            }
        }

        // Delete the sale document
        const saleRef = doc(db, 'sales', saleId);
        batch.delete(saleRef);

        // Commit the batch
        await batch.commit();
        alert('Venta eliminada exitosamente y stock restaurado.');

    } catch (error: any) {
        console.error("Error deleting sale:", error);
        alert(`Error al eliminar la venta: ${error.message}`);
    }
  };

  const handleAddCategory = async (name: string) => {
    if (categories.some(c => c.name.toLowerCase() === name.toLowerCase())) {
        alert('Esa categoría ya existe.');
        return;
    }
    const newCategoryRef = doc(collection(db, 'categories'));
    await setDoc(newCategoryRef, { name });
  };
  
  const handleUpdateCategory = async (id: string, newName: string) => {
    if (categories.some(c => c.id !== id && c.name.toLowerCase() === newName.toLowerCase())) {
        alert('Ya existe otra categoría con ese nombre.');
        return;
    }
    const categoryRef = doc(db, 'categories', id);
    await updateDoc(categoryRef, { name: newName });
  };

  const handleDeleteCategory = async (id: string) => {
    const allInventories = isGlobalMode ? globalInventoryForSearch : inventory;
    const isUsed = allInventories.some(p => p.categoryId === id);
    if (isUsed) {
        alert('No se puede eliminar la categoría porque está en uso. El botón debería estar deshabilitado.');
        return;
    }
    if (window.confirm('¿Estás seguro de que quieres eliminar esta categoría? Esta acción no se puede deshacer.')) {
        await deleteDoc(doc(db, 'categories', id));
    }
  };

  const handleDeleteProduct = async (productId: string) => {
    if (!currentUser) return;
    const allInventories = isGlobalMode ? globalInventoryForSearch : inventory;
    const productToDelete = allInventories.find(p => p.id === productId); 
    if (!productToDelete) {
      alert("No se pudo encontrar el producto a eliminar.");
      return;
    }
    
    // Note: This check is limited to the sales history loaded for the current store.
    const hasSales = sales.some(s => s.items.some(i => i && i.id === productId));
    
    if (hasSales) {
        alert('Este producto tiene historial de ventas en la tienda actual y no puede ser eliminado. Por favor, deshabilítalo en su lugar (usando el botón de encendido/apagado).');
        return;
    }
    
    if (window.confirm(`¿Estás seguro de que quieres eliminar "${productToDelete.name}" permanentemente? Esta acción no se puede deshacer.`)) {
        try {
            const batch = writeBatch(db);
            const productRef = doc(db, 'inventory', productId);
            batch.delete(productRef);
            
            const historyLog = createProductHistoryLog(productToDelete, currentUser.name, ProductChangeType.DELETED, `Producto eliminado permanentemente.`);
            batch.set(doc(db, 'productHistory', historyLog.id), historyLog);

            await batch.commit();
        } catch (error) {
            console.error("Error deleting product: ", error);
            alert("Ocurrió un error al eliminar el producto.");
        }
    }
  };

  const handleAddSeller = async (name: string, password: string, roleId: string, storeId: string) => {
    if (sellers.some(s => s.name.toLowerCase() === name.toLowerCase())) {
      alert('Ya existe un vendedor con ese nombre.');
      return;
    }
    const newSellerRef = doc(collection(db, 'sellers'));
    const newSeller: Omit<Seller, 'id'> = { name, password, roleId, storeId };
    await setDoc(newSellerRef, newSeller);
  };

  const handleUpdateSeller = async (id: string, newName: string, newPassword: string, newRoleId: string, newStoreId: string) => {
    const sellerRef = doc(db, 'sellers', id);
    const updates: { [key: string]: string | boolean } = {
      name: newName,
      roleId: newRoleId,
      storeId: newStoreId,
    };
    if (newPassword.trim()) {
      updates.password = newPassword;
    }
    await updateDoc(sellerRef, updates);
  };
  
  const handleToggleSellerStatus = async (sellerId: string) => {
    const seller = sellers.find(s => s.id === sellerId);
    if (!seller) {
      alert("Vendedor no encontrado.");
      return;
    }

    try {
      const sellerRef = doc(db, 'sellers', sellerId);
      await updateDoc(sellerRef, {
        isDisabled: !seller.isDisabled
      });
      alert(`El vendedor "${seller.name}" ha sido ${seller.isDisabled ? 'habilitado' : 'deshabilitado'}.`);
    } catch (error) {
      console.error("Error toggling seller status:", error);
      alert("Hubo un error al cambiar el estado del vendedor.");
    }
  };

  const handleDeleteSeller = async (id: string) => {
    const sellerToDelete = sellers.find(s => s.id === id);
    if (!sellerToDelete) {
        alert("Vendedor no encontrado.");
        return;
    }

    if (currentUser && currentUser.id === id) {
      alert("No puedes eliminar al usuario con el que has iniciado sesión.");
      return;
    }

    try {
        // Perform dependency checks across key collections to ensure data integrity.
        const dependencyChecks = [
            { collection: 'sales', field: 'seller', label: 'ventas' },
            { collection: 'layaways', field: 'seller', label: 'abonos' },
            { collection: 'incidents', field: 'sellerName', label: 'novedades' },
            { collection: 'stockTakes', field: 'seller', label: 'conteos de inventario' },
            { collection: 'dailyNotes', field: 'seller', label: 'notas diarias' },
            { collection: 'inventoryTransfers', field: 'sellerName', label: 'traslados' },
            { collection: 'payrollHistory', field: 'sellerName', label: 'registros de nómina' }
        ];

        for (const check of dependencyChecks) {
            const q = query(collection(db, check.collection), where(check.field, '==', sellerToDelete.name), limit(1));
            const snapshot = await getDocs(q);
            if (!snapshot.empty) {
                alert(`No se puede eliminar a "${sellerToDelete.name}" porque tiene ${check.label} asociadas. Para preservar la integridad de los datos, los vendedores con actividad no pueden ser eliminados.`);
                return;
            }
        }
        
        if (window.confirm(`¿Estás seguro de que quieres eliminar a ${sellerToDelete.name}? Esta acción no se puede deshacer y es permanente.`)) {
          await deleteDoc(doc(db, 'sellers', id));
          alert(`Vendedor ${sellerToDelete.name} eliminado.`);
        }
    } catch (error) {
        console.error("Error checking seller dependencies or deleting:", error);
        alert("Ocurrió un error al intentar eliminar al vendedor. Revisa la consola para más detalles.");
    }
  };

  const handleAddStore = async (name: string) => {
    if (stores.some(s => s.name.toLowerCase() === name.toLowerCase())) {
      alert('Ya existe una tienda con ese nombre.');
      return;
    }
    const newStoreRef = doc(collection(db, 'stores'));
    const newStore: Omit<Store, 'id'> = {
      name,
      receiptName: `Tienda ${name}`,
      logo: null,
      contactInfo: `Contacto: \nInstagram: @`,
      footerText: `¡Gracias por tu compra en ${name}!`,
      whatsappFooterText: `Este es tu recibo de ${name}.`,
      addiLink: 'https://www.addi.com/',
      sistecreditoLink: 'https://www.sistecredito.com/',
      autoPrint: false,
      autoSendWhatsApp: false,
      accentColor: '#ff007f',
      accentColorHover: '#e60073',
      nextInvoiceNumber: 1,
      loginBackgroundUrl: null,
      imageCompressionQuality: 'medium',
    };
    await setDoc(newStoreRef, newStore);
  };

  const handleUpdateStore = async (id: string, newName: string) => {
    if (stores.some(s => s.id !== id && s.name.toLowerCase() === newName.toLowerCase())) {
      alert('Ya existe otra tienda con ese nombre.');
      return;
    }
    const storeRef = doc(db, 'stores', id);
    await updateDoc(storeRef, { name: newName });
  };

  const handleDeleteStore = async (id: string) => {
    if (stores.length <= 1) {
      alert("No puedes eliminar la única tienda existente.");
      return;
    }
    if (sellers.some(s => s.storeId === id)) {
      alert("No se puede eliminar la tienda porque tiene vendedores asignados.");
      return;
    }
    if (window.confirm('¿Estás seguro de que quieres eliminar esta tienda? Esta acción NO elimina los datos asociados (ventas, inventario, etc) y puede dejar datos huérfanos. Procede con precaución.')) {
      await deleteDoc(doc(db, 'stores', id));
    }
  };

  const handleAddRole = async (name: string) => {
    if (roles.some(r => r.name.toLowerCase() === name.toLowerCase())) {
      alert('Ya existe un rol con ese nombre.');
      return;
    }
    const newRoleRef = doc(collection(db, 'roles'));
    const newRole: Omit<Role, 'id'> = { name, permissions: [View.POS] };
    await setDoc(newRoleRef, newRole);
  };

  const handleUpdateRole = async (updatedRole: Role) => {
    const roleRef = doc(db, 'roles', updatedRole.id);
    await setDoc(roleRef, updatedRole, { merge: true });
  };
  
  const handleBulkAddCustomers = async (customersToAdd: { name: string, phone: string }[]) => {
    if (!currentStoreId) return;

    const batch = writeBatch(db);
    const customersInStoreQuery = query(collection(db, 'customers'), where('storeId', '==', currentStoreId));
    const existingCustomersSnapshot = await getDocs(customersInStoreQuery);
    const existingPhones = new Set(existingCustomersSnapshot.docs.map(doc => doc.data().phone));

    let addedCount = 0;
    for (const customerData of customersToAdd) {
        if (!existingPhones.has(customerData.phone)) {
            const newCustomerRef = doc(collection(db, 'customers'));
            const newCustomer: Omit<Customer, 'id'> = {
                ...customerData,
                storeId: currentStoreId,
                createdAt: new Date().toISOString(),
            };
            batch.set(newCustomerRef, newCustomer);
            existingPhones.add(customerData.phone);
            addedCount++;
        }
    }

    if (addedCount > 0) {
        await batch.commit();
        alert(`${addedCount} cliente(s) agregado(s) exitosamente.`);
    } else {
        alert("No se agregaron nuevos clientes. Es posible que todos los números de celular ya existan en esta tienda.");
    }
  };

  const handleSavePayroll = async (payrollData: Omit<PayrollRecord, 'id' | 'paidAt' | 'paidBy' | 'storeId'>) => {
    if (!currentUser || !currentStoreId) return;
    try {
        const newPayrollRef = doc(collection(db, 'payrollHistory'));
        const newRecord: Omit<PayrollRecord, 'id'> = {
            ...payrollData,
            paidAt: new Date().toISOString(),
            paidBy: currentUser.name,
            storeId: currentStoreId,
        };
        await setDoc(newPayrollRef, newRecord);
        alert(`Nómina para ${payrollData.sellerName} registrada exitosamente.`);
        fetchOnceFromFirestore(query(collection(db, 'payrollHistory'), where('storeId', '==', currentStoreId)), setPayrollHistory);
    } catch (error: any) {
        console.error("Error al guardar el registro de nómina:", error);
        alert(`Fallo al guardar la nómina: ${error.message}`);
    }
  };

  const handleReprintSale = (sale: Sale) => {
    setSaleForReceipt(sale);
    setShowReceiptModal(true);
  };

  if (!isAppReady) {
      return (
          <div className="flex justify-center items-center h-screen bg-primary">
              <div className="text-center">
                  <div className="animate-pulse text-4xl font-bold text-accent">Cargando...</div>
                  <p className="text-text-dark mt-2">Inicializando la base de datos.</p>
              </div>
          </div>
      );
  }

  if (!currentUser) {
    const backgroundStyle = currentStore?.loginBackgroundUrl 
      ? { backgroundImage: `url(${currentStore.loginBackgroundUrl})` }
      : {};

    return (
      <div 
        className="flex justify-center items-center h-screen bg-primary bg-cover bg-center transition-all duration-500"
        style={backgroundStyle}
      >
        <LoginView onLogin={handleLogin} isAppReady={isAppReady} />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen">
      <Header 
        currentView={currentView} 
        setCurrentView={setCurrentView} 
        theme={theme}
        toggleTheme={toggleTheme}
        currentUser={currentUser}
        currentStore={currentStore}
        userPermissions={userPermissions}
        onLogout={handleLogout}
        stores={stores}
        onSwitchStore={handleSwitchStore}
        roles={roles}
        isGlobalMode={isGlobalMode}
        onToggleGlobalMode={handleToggleGlobalMode}
      />
      <main className="flex-grow overflow-y-auto">
        {currentView === View.DASHBOARD && <DashboardView onOpenReports={() => setIsReportsModalOpen(true)} sales={sales} layaways={layaways} inventory={inventory} allLayaways={layaways} allIncidents={incidents} currentStore={currentStore} stores={stores} currentUser={currentUser!} roles={roles} onSwitchStore={handleSwitchStore} onNavigate={setCurrentView} categories={categories} sellers={sellers} dailyNotes={dailyNotes} onUpdateSale={handleUpdateSale} onDeleteSale={handleDeleteSale} onReprintSale={handleReprintSale} />}
        {currentView === View.POS && <PosView inventory={inventory} categories={categories} sellers={sellers} stores={stores} sales={sales} purchases={purchases} layaways={layaways} allCustomers={customers} activeCart={activeCart} heldCarts={heldCarts} onAddToCart={handleAddToCart} onUpdateCartQuantity={handleUpdateCartQuantity} onUpdateCartItemPrice={handleUpdateCartItemPrice} onRemoveFromCart={handleRemoveFromCart} onClearCart={handleClearCart} onProcessSale={handleProcessSale} onHoldSale={handleHoldSale} onResumeSale={handleResumeSale} onCreateLayaway={handleCreateLayaway} onSaveStockTake={handleSaveStockTake} dailyNotes={dailyNotes} onAddDailyNote={handleAddDailyNote} onNavigate={setCurrentView} currentStore={currentStore} incidents={incidents} onCreateIncident={handleCreateIncident} currentUser={currentUser} roles={roles} nextInvoiceNumber={currentStore?.nextInvoiceNumber || 1} onUpdateProduct={handleUpdateProduct} verifiedProducts={verifiedProducts} onToggleProductVerification={handleToggleProductVerification} onClearVerifications={handleClearVerifications} />}
        {currentView === View.INVENTORY && <InventoryView inventory={inventory} allInventory={isGlobalMode ? globalInventoryForSearch : inventory} sales={sales} purchases={purchases} layaways={layaways} categories={categories} stores={stores} currentStoreId={currentStoreId!} onAddProduct={handleAddProduct} onUpdateProduct={handleUpdateProduct} onBulkAddProducts={handleBulkAddProducts} onDeleteProduct={handleDeleteProduct} onAddCategory={handleAddCategory} onUpdateCategory={handleUpdateCategory} onDeleteCategory={handleDeleteCategory} onNavigate={setCurrentView} productHistory={productHistory} currentUser={currentUser} roles={roles} showDisabledProducts={shouldIncludeDisabledProducts} onShowDisabledProductsChange={setShouldIncludeDisabledProducts} onReactivateInconsistentProducts={handleReactivateInconsistentProducts} />}
        {currentView === View.INVENTORY_TRANSFER && <InventoryTransferView inventory={isGlobalMode ? globalInventoryForSearch : inventory} stores={stores} currentUser={currentUser} transfers={inventoryTransfers} onTransfer={handleInventoryTransfer} onResetBalances={handleResetBalances} />}
        {currentView === View.LAYAWAY && <LayawayView layaways={layaways} sellers={sellers} inventory={inventory} onAddPayment={handleAddPaymentToLayaway} onFulfillPreOrder={handleFulfillPreOrder} onDeleteLayaway={handleDeleteLayaway} onUpdateLayaway={handleUpdateLayaway} currentUser={currentUser} roles={roles} />}
        {currentView === View.PURCHASES && <PurchasesView purchases={purchases} inventory={inventory} allInventoryForSearch={isGlobalMode ? globalInventoryForSearch : inventory} categories={categories} stores={stores} currentStoreId={currentStoreId!} onMultiStorePurchase={handleMultiStorePurchase} onUpdatePurchase={handleUpdatePurchase} onDeletePurchase={handleDeletePurchase} />}
        {currentView === View.SELLERS && <SellersView sellers={sellers} roles={roles} stores={stores} onAddSeller={handleAddSeller} onUpdateSeller={handleUpdateSeller} onDeleteSeller={handleDeleteSeller} onToggleSellerStatus={handleToggleSellerStatus} />}
        {currentView === View.STORES && <StoresView stores={stores} onAddStore={handleAddStore} onUpdateStore={handleUpdateStore} onDeleteStore={handleDeleteStore} />}
        {currentView === View.CUSTOMERS && <CustomersView sales={sales} layaways={layaways} allCustomers={customers} onBulkAddCustomers={handleBulkAddCustomers} />}
        {currentView === View.STOCK_TAKE_HISTORY && <StockTakeHistoryView stockTakes={stockTakes} sellers={sellers} onDeleteStockTake={handleDeleteStockTake} onAddNoteToStockTake={handleAddNoteToStockTake} currentUser={currentUser} roles={roles} />}
        {currentView === View.PAYROLL && <PayrollView sellers={sellers} sales={sales} layaways={layaways} loginHistory={loginHistory} payrollHistory={payrollHistory} onSavePayroll={handleSavePayroll} currentUser={currentUser} />}
        {currentView === View.SETTINGS && <SettingsView stores={stores} allInventory={isGlobalMode ? globalInventoryForSearch : inventory} onSave={handleSaveStoreSettings} onResetStoreData={handleResetStoreData} currentUser={currentUser} roles={roles} onRecompressAllProductImages={handleRecompressAllImages} isRecompressing={isRecompressing} recompressProgress={recompressProgress} onGenerateTestData={handleGenerateTestData} onReactivateAllProducts={handleReactivateAllProducts} categories={categories} />}
        {currentView === View.INCIDENTS && <IncidentsView incidents={incidents} inventory={inventory} currentUser={currentUser} roles={roles} sales={sales} stores={stores} customers={customers} onCreateIncident={handleCreateIncident} onApproveIncident={handleApproveIncident} onResolveIncident={handleResolveIncident} onUpdateIncident={handleUpdateIncident} onDeleteIncident={handleDeleteIncident} />}
        {currentView === View.ROLE_MANAGER && <RoleManagerView roles={roles} onAddRole={handleAddRole} onUpdateRole={handleUpdateRole} />}
      </main>
      {showReceiptModal && saleForReceipt && (
        <ReceiptModal 
            sale={saleForReceipt} 
            store={currentStore || null} 
            onClose={() => {
                setShowReceiptModal(false);
                setSaleForReceipt(null);
            }} 
        />
      )}
      {showRecaudoReceipt && lastRecaudo && (
        <RecaudoReceiptModal incident={lastRecaudo} store={currentStore || null} onClose={() => setShowRecaudoReceipt(false)} />
      )}
      {isAdmin && <ReportsModal isOpen={isReportsModalOpen} onClose={() => setIsReportsModalOpen(false)} allSales={allSales} allInventory={globalInventoryForSearch} stores={stores} categories={categories} />}
    </div>
  );
};

export default App;