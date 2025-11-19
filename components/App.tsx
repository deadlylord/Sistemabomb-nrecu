
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
  const [allLayaways, setAllLayaways] = useState<Layaway[]>([]);
  const [allIncidents, setAllIncidents] = useState<Incident[]>([]);
  
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
    
    // Base listeners for all users
    const unsubscribers = [
      attachFirestoreListener(query(collection(db, 'sellers')), setSellers),
      attachFirestoreListener(query(collection(db, 'categories')), setCategories),
      attachFirestoreListener(query(collection(db, 'inventoryTransfers')), setInventoryTransfers)
    ];
    
    // Additional global listeners for Admins needed for Dashboard banners
    if (isAdmin) {
      unsubscribers.push(attachFirestoreListener(query(collection(db, 'layaways')), setAllLayaways));
      unsubscribers.push(attachFirestoreListener(query(collection(db, 'incidents')), setAllIncidents));
    }

    return () => {
      console.log("Cleaning up post-login global listeners.");
      unsubscribers.forEach(unsub => unsub());
    }
  }, [currentUser, isAppReady, isAuthReady, isAdmin]);
  
  // On-demand data loading for AI Reports Modal
  useEffect(() => {
    // Only trigger if the modal is opened by an admin
    if (isReportsModalOpen && isAdmin) {
      // Check if data is already loaded to prevent re-fetching
      if (allSales.length === 0) {
        console.log("Reports modal opened. Fetching all sales data...");
        const salesQuery = query(collection(db, 'sales'));
        getDocs(salesQuery).then(snapshot => {
          const list: Sale[] = snapshot.docs.map(doc => ({ ...(doc.data() as object), id: doc.id } as Sale));
          setAllSales(list);
        }).catch(error => console.error("Error fetching all sales for report:", error));
      }
      
      if (globalInventoryForSearch.length === 0) {
          console.log("Reports modal opened. Fetching all inventory data...");
          const inventoryQuery = query(collection(db, 'inventory'));
          getDocs(inventoryQuery).then(snapshot => {
              const list: Product[] = snapshot.docs.map(doc => ({ ...(doc.data() as object), id: doc.id } as Product));
              setGlobalInventoryForSearch(list);
          }).catch(error => console.error("Error fetching all inventory for report:", error));
      }
    }
  }, [isReportsModalOpen, isAdmin, allSales, globalInventoryForSearch]); // Dependencies ensure this runs only when needed
  
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
