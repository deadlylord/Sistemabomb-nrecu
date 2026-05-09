
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
  arrayUnion,
  runTransaction,
  orderBy,
  deleteField
} from 'firebase/firestore';
import { onAuthStateChanged, signInAnonymously } from 'firebase/auth';
import { Product, CartItem, View, PaymentMethod, HeldCart, Layaway, Category, Sale, Purchase, Seller, StockTake, DailyNote, Role, LoginRecord, Store, InventoryTransfer, Incident, IncidentType, IncidentStatus, ProductHistoryLog, ProductChangeType, PayrollRecord, Customer, Payment, PendingDetailedVerification, Expense, ExpenseCategory, GiftVoucher, FinancialRecord } from '../types';
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
import StockTakeModal from './StockTakeModal';
import CustomersView from './CustomersView';
import { SettingsView } from './SettingsView';
import PayrollView from './PayrollView';
import LoginView from './LoginView';
import RoleManagerView from './RoleManagerView';
import IncidentsView from './IncidentsView';
import ReportsModal from './ReportsView';
import { INITIAL_CATEGORIES, INITIAL_PRODUCTS, INITIAL_ROLES, INITIAL_SELLERS, INITIAL_STORES, formatCOP, toTitleCase, generateUniqueSku } from '../constants';
import ReceiptModal from './ReceiptModal';
import RecaudoReceiptModal from './RecaudoReceiptModal';
import DashboardView from './DashboardView';
import { reuploadImageFromUrl, uploadImageAndGetURL } from '../services/storageService';
import { InventoryVerificationModal } from './InventoryVerificationModal';
import PendingIncidentsBriefingModal from './PendingIncidentsBriefingModal';
import SmartAccountantView from './SmartAccountantView';
import VersionHistoryModal from './VersionHistoryModal';
import FinancialReconciliationView from './FinancialReconciliationView';
import GiftVouchersView from './GiftVouchersView';

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

const cleanObject = (obj: any) => {
  const newObj = { ...obj };
  Object.keys(newObj).forEach(key => {
    if (newObj[key] === undefined) {
      delete newObj[key];
    }
  });
  return newObj;
};

const App: React.FC = () => {
  const [giftVouchers, setGiftVouchers] = useState<GiftVoucher[]>([]);
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
  const [expenseCategories, setExpenseCategories] = useState<ExpenseCategory[]>([]);
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
  const [isLoading, setIsLoading] = useState(false);
  
  const [hasShownBriefing, setHasShownBriefing] = useState(false);
  const [isBriefingModalOpen, setIsBriefingModalOpen] = useState(false);
  const [isVersionModalOpen, setIsVersionModalOpen] = useState(false);

  const [loadFullPurchases, setLoadFullPurchases] = useState(false);

  const [accountingChatHistory, setAccountingChatHistory] = useState<any[]>([]);
  const [financialRecords, setFinancialRecords] = useState<FinancialRecord[]>([]);

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

  const handleSwitchStore = (id: string) => {
    setCurrentStoreId(id);
    localStorage.setItem('currentStoreId', id);
  };
  
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
    if (!isAuthReady || isAppReady) return;
    
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
  }, [isAuthReady, isAppReady]);

  useEffect(() => {
    if (!isAppReady || !isAuthReady) return;
    const unsubscribers = [
      attachFirestoreListener(query(collection(db, 'stores')), setStores),
      attachFirestoreListener(query(collection(db, 'roles')), setRoles),
    ];
    return () => unsubscribers.forEach(unsub => unsub());
  }, [isAppReady, isAuthReady]);

  useEffect(() => {
    if (!isAppReady || !isAuthReady || currentUser) return;
    const unsubscribe = attachFirestoreListener(query(collection(db, 'sellers')), setSellers);
    return () => unsubscribe();
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
      unsubscribers.push(attachFirestoreListener(query(collection(db, 'sales')), setAllSales));
      
      // Ensure Administrator role has gift_vouchers permission
      const adminRole = roles.find(r => r.name === 'Administrator');
      if (adminRole && !adminRole.permissions.includes(View.GIFT_VOUCHERS)) {
        updateDoc(doc(db, 'roles', adminRole.id), {
          permissions: [...adminRole.permissions, View.GIFT_VOUCHERS]
        }).catch(err => console.error("Error updating admin permissions:", err));
      }
    }
    return () => unsubscribers.forEach(unsub => unsub());
  }, [currentUser, isAppReady, isAuthReady, isAdmin]);
  
  useEffect(() => {
    if ((isReportsModalOpen || currentView === View.DASHBOARD) && isAdmin) {
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
  }, [isReportsModalOpen, currentView, isAdmin, allSales.length, globalInventoryForSearch.length]);
  
  useEffect(() => {
    if (!isGlobalMode || !isAppReady || !currentUser) {
        if (globalInventoryForSearch.length > 0 && !isAdmin) setGlobalInventoryForSearch([]);
        return;
    }
    const inventoryQuery = query(collection(db, 'inventory'));
    const unsubscribe = attachFirestoreListener(inventoryQuery, setGlobalInventoryForSearch);
    return () => unsubscribe();
  }, [isGlobalMode, isAppReady, currentUser, isAdmin]);
  
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
            attach(storeSpecificQuery('stockTakes'), setStockTakes);
            attach(storeSpecificQuery('giftVouchers'), setGiftVouchers);
            break;
        case View.POS:
            attach(storeInventoryQuery, setInventory);
            attach(storeSpecificQuery('sales'), setSales);
            attach(storeSpecificQuery('purchases'), setPurchases);
            attach(storeSpecificQuery('layaways'), setLayaways);
            attach(storeSpecificQuery('customers'), setCustomers);
            attach(storeSpecificQuery('giftVouchers'), setGiftVouchers);
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
            attach(storeSpecificQuery('payrollHistory'), setPayrollHistory);
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
            attach(storeSpecificQuery('expenseCategories'), setExpenseCategories);
            attach(storeSpecificQuery('payrollHistory'), setPayrollHistory);
            attach(storeInventoryQuery, setInventory);
            attach(storeSpecificQuery('purchases'), setPurchases);
            attach(storeSpecificQuery('financialRecords'), setFinancialRecords);
            
            const chatRef = doc(db, 'accountingChatHistory', currentStoreId);
            unsubscribers.push(onSnapshot(chatRef, (doc) => {
              if (doc.exists()) {
                setAccountingChatHistory(doc.data().messages || []);
              } else {
                setAccountingChatHistory([]);
              }
            }));
            break;
        case View.FINANCIAL_RECONCILIATION:
            attach(storeSpecificQuery('sales'), setSales);
            attach(storeSpecificQuery('layaways'), setLayaways);
            attach(storeSpecificQuery('expenses'), setExpenses);
            attach(storeSpecificQuery('incidents'), setIncidents);
            break;
        case View.GIFT_VOUCHERS:
            attach(storeSpecificQuery('giftVouchers'), setGiftVouchers);
            break;
    }
    return () => unsubscribers.forEach(unsub => unsub());
}, [isAppReady, isAuthReady, currentStoreId, currentView, currentUser, roles, userPermissions, fetchOnceFromFirestore]);

  useEffect(() => {
    if (currentUser && !hasShownBriefing) {
      const pendingIncidentsCount = incidents.filter(i => 
        [IncidentStatus.DAÑADO_REPORTADO, IncidentStatus.CAMBIO_SOLICITADO, IncidentStatus.TRASLADO_SOLICITADO, IncidentStatus.WARRANTY_ACTIVE].includes(i.status)
      ).length;

      const pendingPreOrdersCount = layaways.filter(l => l.status === 'pre-order').length;
      const totalPending = pendingIncidentsCount + pendingPreOrdersCount;

      if (totalPending > 0) {
        const todayStr = new Date().toISOString().split('T')[0];
        const lastShownDate = localStorage.getItem(`lastBriefingDate_${currentUser.id}`);

        if (isAdmin) {
            if (lastShownDate !== todayStr) {
                setIsBriefingModalOpen(true);
            } else {
                setHasShownBriefing(true);
            }
        } else {
            setIsBriefingModalOpen(true);
        }
      } else {
        setHasShownBriefing(true);
      }
    }
  }, [currentUser, incidents, layaways, hasShownBriefing, isAdmin]);

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
    if (currentView === View.ACCOUNTING && expenseCategories.length === 0 && currentStoreId) {
        const checkAndInitCategories = async () => {
            const q = query(collection(db, 'expenseCategories'), where('storeId', '==', currentStoreId));
            const snap = await getDocs(q);
            if (snap.empty) {
                const defaults = ["Arriendo", "Servicios", "Publicidad", "Insumos", "Mantenimiento", "Otro"];
                const batch = writeBatch(db);
                defaults.forEach(name => {
                    const ref = doc(collection(db, 'expenseCategories'));
                    batch.set(ref, { id: ref.id, name, storeId: currentStoreId });
                });
                await batch.commit();
            }
        };
        checkAndInitCategories();
    }
  }, [currentView, expenseCategories.length, currentStoreId]);

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
    const sellingPrice = product.discountPrice !== undefined ? product.discountPrice : product.price;
    setActiveCart(prev => {
        const existing = prev.find(p => p.id === product.id);
        if (existing) {
            return prev.map(p => p.id === product.id ? { 
                ...p, 
                quantity: p.quantity + 1,
                price: sellingPrice,
                basePrice: product.price
            } : p);
        }
        return [...prev, { ...product, price: sellingPrice, basePrice: product.price, quantity: 1 }];
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

  const handleProcessSale = async (saleData: { payments: Payment[]; customerName: string; customerPhone: string; seller: string; items?: CartItem[] }, saleDate: Date) => {
    if (!currentStore || !currentStoreId || !currentUser) return;

    try {
        let savedSale: Sale | null = null;

        await runTransaction(db, async (transaction) => {
            const storeRef = doc(db, 'stores', currentStoreId);
            const storeDoc = await transaction.get(storeRef);
            if (!storeDoc.exists()) {
                throw new Error("Store document does not exist!");
            }

            // Pre-fetch voucher documents if any to satisfy Firestore requirement (all reads before writes)
            const voucherDocs: { ref: any, doc: any, paymentAmount: number }[] = [];
            for (const payment of saleData.payments) {
                if (payment.method === PaymentMethod.Bono && payment.voucherId) {
                    const voucherRef = doc(db, 'giftVouchers', payment.voucherId);
                    const voucherDoc = await transaction.get(voucherRef);
                    if (voucherDoc.exists()) {
                        voucherDocs.push({ ref: voucherRef, doc: voucherDoc, paymentAmount: payment.amount });
                    }
                }
            }

            let currentInvoiceNumber = storeDoc.data().nextInvoiceNumber;
            
            if (typeof currentInvoiceNumber !== 'number') {
                currentInvoiceNumber = Number(currentInvoiceNumber);
            }
            if (isNaN(currentInvoiceNumber)) {
                currentInvoiceNumber = 1;
            }

            const saleRef = doc(collection(db, 'sales'));
            const itemsToProcess = saleData.items || activeCart;
            const totalAmount = itemsToProcess.reduce((sum, item) => sum + item.price * item.quantity, 0);

            const newSale: Sale = {
                id: saleRef.id,
                invoiceNumber: currentInvoiceNumber,
                customerName: saleData.customerName,
                customerPhone: saleData.customerPhone,
                items: itemsToProcess,
                totalAmount,
                payments: saleData.payments,
                paymentMethod: saleData.payments[0]?.method,
                seller: saleData.seller,
                createdAt: saleDate.toISOString(),
                storeId: currentStoreId,
            };

            savedSale = newSale;

            transaction.set(saleRef, cleanObject(newSale));

            // Handle Gift Voucher Redemptions
            for (const { ref, doc, paymentAmount } of voucherDocs) {
                const currentVal = doc.data().currentValue || 0;
                const newVal = Math.max(0, currentVal - paymentAmount);
                transaction.update(ref, { 
                    currentValue: newVal,
                    status: newVal <= 0 ? 'redeemed' : 'active'
                });
            }

            itemsToProcess.forEach(item => {
                // Only update stock and history if it's a real product (vouchers start with 'voucher-')
                if (!item.id.startsWith('voucher-')) {
                    const productRef = doc(db, 'inventory', item.id);
                    transaction.update(productRef, { stock: increment(-item.quantity) });

                    const logRef = doc(collection(db, 'productHistory'));
                    const log: ProductHistoryLog = {
                        id: logRef.id,
                        productId: item.id,
                        productName: item.name,
                        storeId: currentStoreId,
                        changedBy: saleData.seller,
                        timestamp: saleDate.toISOString(),
                        changeType: ProductChangeType.SALE,
                        details: `Venta #${currentInvoiceNumber}. Cantidad: -${item.quantity}. Precio Venta: ${formatCOP(item.price)}`
                    };
                    transaction.set(logRef, log);
                }
            });

            transaction.update(storeRef, { nextInvoiceNumber: currentInvoiceNumber + 1 });

            // 2. Handle new vouchers being sold
            for (const item of itemsToProcess) {
                if (item.id.startsWith('voucher-')) {
                    const code = item.id.replace('voucher-', '');
                    const voucherRef = doc(collection(db, 'giftVouchers'));
                    transaction.set(voucherRef, {
                        id: voucherRef.id,
                        code,
                        initialValue: item.price,
                        currentValue: item.price,
                        status: 'active',
                        createdAt: saleDate.toISOString(),
                        customerName: saleData.customerName,
                        customerPhone: saleData.customerPhone,
                        storeId: currentStoreId,
                        createdBy: saleData.seller,
                        saleId: saleRef.id,
                    });
                }
            }
        });

        if (savedSale) {
            setSaleForReceipt(savedSale);
            setShowReceiptModal(true);
            if (!saleData.items) {
                handleClearCart();
            }
        }

    } catch (e) {
        console.error("Transaction failed: ", e);
        alert("Error procesando la venta. Por favor, intente nuevamente.");
    }
  };

  const handleHoldSale = async (data?: { customer?: { name: string; phone: string }; sellerName?: string; }) => {
    if (!currentStoreId) return;
    const cartRef = doc(collection(db, 'heldCarts'));
    const heldCart: HeldCart = {
        id: cartRef.id,
        items: activeCart,
        storeId: currentStoreId,
        customerName: data?.customer?.name ?? null,
        customerPhone: data?.customer?.phone ?? null,
        sellerName: data?.sellerName ?? null,
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

    try {
        await runTransaction(db, async (transaction) => {
            const storeRef = doc(db, 'stores', currentStoreId);
            const storeDoc = await transaction.get(storeRef);
            if (!storeDoc.exists()) throw new Error("Store not found");

            let dbNextInvoice = storeDoc.data().nextInvoiceNumber;
            
            if (typeof dbNextInvoice !== 'number') dbNextInvoice = Number(dbNextInvoice);
            if (isNaN(dbNextInvoice)) dbNextInvoice = 1;

            let finalInvoiceNumber = invoiceNumber;
            let shouldIncrementStoreCounter = false;

            const inputInvoiceNum = parseInt(invoiceNumber, 10);

            if (!isNaN(inputInvoiceNum) && inputInvoiceNum === dbNextInvoice) {
                shouldIncrementStoreCounter = true;
            }

            const layawayRef = doc(collection(db, 'layaways'));
            const totalAmount = activeCart.reduce((sum, item) => sum + item.price * item.quantity, 0);
            const payment: Payment = { amount: initialPayment.amount, method: initialPayment.method, date: saleDate.toISOString(), seller: seller };
            
            const newLayaway: Layaway = {
                id: layawayRef.id,
                invoiceNumber: finalInvoiceNumber,
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

            transaction.set(layawayRef, cleanObject(newLayaway));

            if (!isPreOrder) {
                activeCart.forEach(item => {
                    const productRef = doc(db, 'inventory', item.id);
                    transaction.update(productRef, { stock: increment(-item.quantity) });

                    const logRef = doc(collection(db, 'productHistory'));
                    const log: ProductHistoryLog = {
                        id: logRef.id,
                        productId: item.id,
                        productName: item.name,
                        storeId: currentStoreId,
                        changedBy: seller,
                        timestamp: saleDate.toISOString(),
                        changeType: ProductChangeType.LAYAWAY_RESERVED,
                        details: `Apartado por Abono #${finalInvoiceNumber}. Cantidad: -${item.quantity}.`
                    };
                    transaction.set(logRef, log);
                });
            }

            if (shouldIncrementStoreCounter) {
                transaction.update(storeRef, { nextInvoiceNumber: dbNextInvoice + 1 });
            }
        });

        handleClearCart();
    } catch (e) {
        console.error("Layaway transaction failed:", e);
        alert("Error al crear abono. Intente nuevamente.");
    }
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

          const logRef = doc(collection(db, 'productHistory'));
          const log: ProductHistoryLog = {
              id: logRef.id,
              productId: item.id,
              productName: item.name,
              storeId: layaway.storeId,
              changedBy: currentUser?.name || 'Sistema',
              timestamp: new Date().toISOString(),
              changeType: ProductChangeType.PRE_ORDER_FULFILLED,
              details: `Encargo #${layaway.invoiceNumber} recibido y stock rebajado: -${item.quantity}.`
          };
          batch.set(logRef, log);
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
        case IncidentType.CASH_ADJUSTMENT: initialStatus = IncidentStatus.PENDIENTE_APROBACION; break;
        case IncidentType.RECAUDO: initialStatus = IncidentStatus.REGISTRADO; break;
        case IncidentType.ADDITIONAL_INCOME: case IncidentType.NEGATIVE_STOCK_SALE: initialStatus = IncidentStatus.REGISTRADO; break;
        case IncidentType.DAMAGED: initialStatus = IncidentStatus.DAÑADO_REPORTADO; break;
        case IncidentType.PRODUCT_EXCHANGE: initialStatus = IncidentStatus.CAMBIO_SOLICITADO; break;
        case IncidentType.INVENTORY_TRANSFER_REQUEST: initialStatus = IncidentStatus.TRASLADO_SOLICITADO; break;
        case IncidentType.WARRANTY: initialStatus = IncidentStatus.WARRANTY_ACTIVE; break;
        case IncidentType.INVENTORY_INCONSISTENCY: initialStatus = IncidentStatus.REGISTRADO; break;
        default: throw new Error(`Unhandled incident type for status initialization: ${data.type}`);
    }
    const newIncident: Incident = { 
        ...incidentData, 
        id: newIncidentRef.id, 
        status: initialStatus, 
        createdAt: createdAt, 
        sellerName: currentUser.name, 
        storeId: currentStoreId,
        history: [{
            status: initialStatus,
            changedBy: currentUser.name,
            timestamp: new Date().toISOString(),
            notes: 'Registro inicial de la novedad'
        }]
    };
    if (newIncident.type === IncidentType.PRODUCT_EXCHANGE && surplusPaid && surplusPaid > 0 && surplusPaymentMethod) {
        newIncident.adjustmentAmount = surplusPaid;
        newIncident.paymentMethod = surplusPaymentMethod;
        const adjustmentRef = doc(collection(db, 'incidents'));
        newIncident.relatedIncidentId = adjustmentRef.id;
        const adjustmentIncident: Incident = { 
            id: adjustmentRef.id, 
            type: IncidentType.CASH_ADJUSTMENT, 
            status: IncidentStatus.PENDIENTE_APROBACION, 
            description: `Excedente pagado (${surplusPaymentMethod}) por cambio de factura #${newIncident.originalSaleInvoiceNumber}`, 
            createdAt: createdAt, 
            sellerName: currentUser.name, 
            storeId: currentStoreId, 
            adjustmentAmount: surplusPaid, 
            adjustmentType: 'income', 
            customerName: newIncident.customerName, 
            customerPhone: newIncident.customerPhone, 
            paymentMethod: surplusPaymentMethod,
            history: [{
                status: IncidentStatus.PENDIENTE_APROBACION,
                changedBy: currentUser.name,
                timestamp: new Date().toISOString(),
                notes: 'Registro automático por excedente en cambio'
            }]
        };
        batch.set(adjustmentRef, cleanObject(adjustmentIncident));
    }
    batch.set(newIncidentRef, cleanObject(newIncident));
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

            const damageLogRef = doc(collection(db, 'productHistory'));
            const damageLog: ProductHistoryLog = {
                id: damageLogRef.id,
                productId: incident.productId,
                productName: incident.productName || 'Producto',
                storeId: incident.storeId,
                changedBy: currentUser.name,
                timestamp: new Date().toISOString(),
                changeType: ProductChangeType.DAMAGED,
                details: `Prenda reportada como dañada. Stock rebajado: -1.`
            };
            batch.set(damageLogRef, damageLog);
            break;
          case IncidentType.PRODUCT_EXCHANGE:
            if (incident.status !== IncidentStatus.CAMBIO_SOLICITADO) return;
            newStatus = IncidentStatus.CAMBIO_PROCESADO;
            
            incident.returnedItems?.forEach(item => { 
                batch.update(doc(db, 'inventory', item.productId), { stock: increment(item.quantity) }); 
                const exchangeInLogRef = doc(collection(db, 'productHistory'));
                const exchangeInLog: ProductHistoryLog = {
                    id: exchangeInLogRef.id,
                    productId: item.productId,
                    productName: item.productName,
                    storeId: incident.storeId,
                    changedBy: currentUser.name,
                    timestamp: new Date().toISOString(),
                    changeType: ProductChangeType.EXCHANGE_IN,
                    details: `Devolución por cambio (Factura #${incident.originalSaleInvoiceNumber}). Stock: +${item.quantity}`
                };
                batch.set(exchangeInLogRef, exchangeInLog);
            });
            incident.takenItems?.forEach(item => { 
                batch.update(doc(db, 'inventory', item.productId), { stock: increment(-item.quantity) }); 
                const exchangeOutLogRef = doc(collection(db, 'productHistory'));
                const exchangeOutLog: ProductHistoryLog = {
                    id: exchangeOutLogRef.id,
                    productId: item.productId,
                    productName: item.productName,
                    storeId: incident.storeId,
                    changedBy: currentUser.name,
                    timestamp: new Date().toISOString(),
                    changeType: ProductChangeType.EXCHANGE_OUT,
                    details: `Salida por cambio (Factura #${incident.originalSaleInvoiceNumber}). Stock: -${item.quantity}`
                };
                batch.set(exchangeOutLogRef, exchangeOutLog);
            });

            if (incident.originalSaleId) {
                const originalSale = allSales.find(s => s.id === incident.originalSaleId) || sales.find(s => s.id === incident.originalSaleId);
                if (originalSale) {
                    const saleRef = doc(db, 'sales', originalSale.id);
                    let updatedItems = [...originalSale.items];
                    
                    incident.returnedItems?.forEach(ret => {
                        const idx = updatedItems.findIndex(i => i.id === ret.productId);
                        if (idx !== -1) {
                            updatedItems[idx].quantity -= ret.quantity;
                            if (updatedItems[idx].quantity <= 0) updatedItems.splice(idx, 1);
                        }
                    });

                    incident.takenItems?.forEach(taken => {
                        const idx = updatedItems.findIndex(i => i.id === taken.productId);
                        if (idx !== -1) {
                            updatedItems[idx].quantity += taken.quantity;
                        } else {
                            updatedItems.push({
                                id: taken.productId,
                                name: taken.productName,
                                sku: taken.sku || '',
                                categoryId: taken.categoryId || '',
                                price: taken.price,
                                cost: taken.cost,
                                quantity: taken.quantity,
                                storeId: originalSale.storeId,
                                description: 'Artículo por cambio',
                                imageUrl: ''
                            } as CartItem);
                        }
                    });

                    const newTotal = updatedItems.reduce((sum, i) => sum + (i.price * i.quantity), 0);
                    batch.update(saleRef, { items: updatedItems, totalAmount: newTotal });
                }
            }
            break;
          case IncidentType.INVENTORY_TRANSFER_REQUEST:
            if (incident.status !== IncidentStatus.TRASLADO_SOLICITADO) return;
            newStatus = IncidentStatus.TRASLADO_COMPLETADO;
            if (incident.fromStoreId && incident.toStoreId && incident.productId && incident.quantity) {
                await handleInventoryTransfer({ fromStoreId: incident.fromStoreId, toStoreId: incident.toStoreId, productId: incident.productId, quantity: incident.quantity, sellerName: incident.sellerName }, batch);
            }
            break;
          case IncidentType.CASH_ADJUSTMENT:
            if (incident.status !== IncidentStatus.PENDIENTE_APROBACION) return;
            newStatus = IncidentStatus.REGISTRADO;
            break;
          default: return;
        }
        const updatedHistory = [
            ...(incident.history || []),
            {
                status: newStatus,
                changedBy: currentUser.name,
                timestamp: new Date().toISOString(),
                notes: 'Novedad aprobada y procesada'
            }
        ];
        batch.update(incidentRef, { 
            status: newStatus, 
            resolutionDate: new Date().toISOString(),
            history: updatedHistory
        });
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
        if (incident.productId) {
            batch.update(doc(db, 'inventory', incident.productId), { stock: increment(1) });
            const repairLogRef = doc(collection(db, 'productHistory'));
            const repairLog: ProductHistoryLog = {
                id: repairLogRef.id,
                productId: incident.productId,
                productName: incident.productName || 'Producto',
                storeId: incident.storeId,
                changedBy: currentUser.name,
                timestamp: new Date().toISOString(),
                changeType: ProductChangeType.DAMAGED_RETURNED,
                details: `Prenda dañada retornada de arreglo. Stock restaurado: +1.`
            };
            batch.set(repairLogRef, repairLog);
        }
    }
    if (newStatus) { 
        const updatedHistory = [
            ...(incident.history || []),
            {
                status: newStatus,
                changedBy: currentUser.name,
                timestamp: new Date().toISOString(),
                notes: 'Novedad resuelta/finalizada'
            }
        ];
        batch.update(incidentRef, { 
            status: newStatus, 
            resolutionDate: new Date().toISOString(),
            history: updatedHistory
        }); 
        await batch.commit(); 
    }
  };

  const handleUpdateIncident = async (incident: Incident) => { 
    const existingIncident = incidents.find(i => i.id === incident.id);
    const batch = writeBatch(db);

    if (existingIncident && existingIncident.status !== incident.status) {
        incident.history = [
            ...(incident.history || []),
            {
                status: incident.status,
                changedBy: currentUser?.name || 'Sistema',
                timestamp: new Date().toISOString(),
                notes: 'Estado actualizado manualmente por administrador'
            }
        ];

        // Ajustar inventario si es una prenda dañada y cambia el estado
        if (incident.type === IncidentType.DAMAGED && incident.productId) {
            const oldStatusImpact = existingIncident.status === IncidentStatus.EN_ARREGLO_CAMBIO ? -1 : 0;
            const newStatusImpact = incident.status === IncidentStatus.EN_ARREGLO_CAMBIO ? -1 : 0;
            const stockChange = newStatusImpact - oldStatusImpact;

            if (stockChange !== 0) {
                batch.update(doc(db, 'inventory', incident.productId), { stock: increment(stockChange) });
                
                const logRef = doc(collection(db, 'productHistory'));
                const log: ProductHistoryLog = {
                    id: logRef.id,
                    productId: incident.productId,
                    productName: incident.productName || 'Producto',
                    storeId: incident.storeId,
                    changedBy: currentUser?.name || 'Sistema',
                    timestamp: new Date().toISOString(),
                    changeType: stockChange > 0 ? ProductChangeType.DAMAGED_RETURNED : ProductChangeType.DAMAGED,
                    details: `Estado de novedad modificado manualmente de ${existingIncident.status} a ${incident.status}. Ajuste de stock: ${stockChange > 0 ? '+' : ''}${stockChange}.`
                };
                batch.set(logRef, log);
            }
        }
    }
    batch.set(doc(db, 'incidents', incident.id), incident, { merge: true }); 
    await batch.commit();
  };

  const handleDeleteIncident = async (incidentId: string) => {
      if (window.confirm('¿Eliminar novedad permanentemente?')) {
          await deleteDoc(doc(db, 'incidents', incidentId));
      }
  };
  
  const handleUpdateLayaway = async (updatedLayaway: Layaway, originalLayaway: Layaway) => {
      if (!currentUser) return;
      const batch = writeBatch(db);

      if (originalLayaway.status === 'active' || originalLayaway.status === 'completed') {
          originalLayaway.items.forEach(item => {
              const productRef = doc(db, 'inventory', item.id);
              batch.update(productRef, { stock: increment(item.quantity) });
          });
      }

      if (updatedLayaway.status === 'active' || updatedLayaway.status === 'completed') {
          updatedLayaway.items.forEach(item => {
              const productRef = doc(db, 'inventory', item.id);
              batch.update(productRef, { stock: increment(-item.quantity) });

              const logRef = doc(collection(db, 'productHistory'));
              const log: ProductHistoryLog = {
                  id: logRef.id,
                  productId: item.id,
                  productName: item.name,
                  storeId: updatedLayaway.storeId,
                  changedBy: currentUser.name,
                  timestamp: new Date().toISOString(),
                  changeType: ProductChangeType.LAYAWAY_RESERVED,
                  details: `Abono #${updatedLayaway.invoiceNumber} editado. Inventario sincronizado: -${item.quantity}`
              };
              batch.set(logRef, log);
          });
      }

      batch.set(doc(db, 'layaways', updatedLayaway.id), cleanObject(updatedLayaway));
      await batch.commit();
  };

  const handleDeleteLayaway = async (layawayId: string) => {
      const layaway = layaways.find(l => l.id === layawayId);
      if (!layaway || !currentUser) return;

      if (!window.confirm('¿Eliminar abono? Las unidades apartadas volverán al inventario.')) return;

      const batch = writeBatch(db);
      const layawayRef = doc(db, 'layaways', layawayId);
      
      if (layaway.status === 'active' || layaway.status === 'completed') {
          layaway.items.forEach(item => {
              const productRef = doc(db, 'inventory', item.id);
              batch.update(productRef, { stock: increment(item.quantity) });
              
              const logRef = doc(collection(db, 'productHistory'));
              const log: ProductHistoryLog = {
                  id: logRef.id,
                  productId: item.id,
                  productName: item.name,
                  storeId: layaway.storeId,
                  changedBy: currentUser.name,
                  timestamp: new Date().toISOString(),
                  changeType: ProductChangeType.LAYAWAY_DELETED,
                  details: `Abono eliminado/cancelado. Stock devuelto: +${item.quantity}`
              };
              batch.set(logRef, log);
          });
      }

      batch.delete(layawayRef);
      await batch.commit();
  };

  const handleUpdateSale = async (updatedSale: Sale, originalSale: Sale) => {
      if (!currentUser) return;
      const batch = writeBatch(db);
      
      originalSale.items.forEach(item => {
          const productRef = doc(db, 'inventory', item.id);
          batch.update(productRef, { stock: increment(item.quantity) });
      });

      updatedSale.items.forEach(item => {
          const productRef = doc(db, 'inventory', item.id);
          batch.update(productRef, { stock: increment(-item.quantity) });
      });

      const saleRef = doc(db, 'sales', updatedSale.id);
      batch.set(saleRef, cleanObject(updatedSale));

      // Actualizar registros de conciliación asociados si existen
      const originalPayments = (Array.isArray(originalSale.payments) ? originalSale.payments : Object.values(originalSale.payments || {})) as Payment[];
      const updatedPayments = (Array.isArray(updatedSale.payments) ? updatedSale.payments : Object.values(updatedSale.payments || {})) as Payment[];

      updatedPayments.forEach((p, idx) => {
          const recordId = `trans_auto_${updatedSale.id}_${idx}`;
          const oldPayment = originalPayments[idx];
          
          // Si el pago cambió de monto o método, y ya estaba conciliado, actualizamos el registro
          // Nota: Esto asume que el ID del registro de conciliación sigue el patrón trans_auto_SALEID_INDEX
          const accountType = (p.method === PaymentMethod.Efectivo) ? 'cash' : 
                            ([PaymentMethod.Nequi, PaymentMethod.Daviplata, PaymentMethod.QR].includes(p.method as PaymentMethod) ? 'qr' : null);
          
          if (accountType) {
              const recordRef = doc(db, 'financialRecords', recordId);
              // Intentamos actualizar. Si no existe, no pasa nada (Firestore update fallará si no existe, así que usamos set con merge o simplemente ignoramos si no queremos crear uno nuevo)
              // Pero aquí solo queremos actualizar si YA EXISTE.
              // Como no podemos saber si existe en un batch sin leer, una opción es usar set con merge: true pero eso crearía uno nuevo si no existe.
              // Mejor: Solo actualizamos el documento de la venta, y dejamos que el usuario vuelva a conciliar si el monto cambió.
              // Sin embargo, el usuario pidió que se actualice.
          }
      });

      if (updatedSale.items.length > 0) {
          const logRef = doc(collection(db, 'productHistory'));
          const log: ProductHistoryLog = {
              id: logRef.id,
              productId: updatedSale.items[0].id, 
              productName: "Venta Editada",
              storeId: updatedSale.storeId,
              changedBy: currentUser.name,
              timestamp: new Date().toISOString(),
              changeType: ProductChangeType.RETURN, 
              details: `Factura #${updatedSale.invoiceNumber} editada. Inventario ajustado.`
          };
          batch.set(logRef, log);
      }

      await batch.commit();
  };

  const handleDeleteSale = async (saleId: string) => {
      const sale = (allSales.length > 0 ? allSales : sales).find(s => s.id === saleId);
      if (!sale || !currentUser) return;

      const batch = writeBatch(db);
      
      sale.items.forEach(item => {
          if (item && item.id && item.id.startsWith('voucher-')) {
              // Si es un bono que se vendió, lo eliminamos
              const voucherCode = item.id.replace('voucher-', '');
              const voucher = giftVouchers.find(v => v.code === voucherCode);
              if (voucher) {
                  batch.delete(doc(db, 'giftVouchers', voucher.id));
              }
          } else if (item && item.id) {
              const productRef = doc(db, 'inventory', item.id);
              batch.update(productRef, { stock: increment(item.quantity) });

              const logRef = doc(collection(db, 'productHistory'));
              const log: ProductHistoryLog = {
                  id: logRef.id,
                  productId: item.id,
                  productName: item.name,
                  storeId: sale.storeId,
                  changedBy: currentUser.name,
                  timestamp: new Date().toISOString(),
                  changeType: ProductChangeType.SALE_DELETED,
                  details: `Venta #${sale.invoiceNumber} eliminada. Stock restaurado: +${item.quantity}`
              };
              batch.set(logRef, log);
          }
      });

      // Restaurar valor de bonos si se usaron como medio de pago
      const paymentsArray = (Array.isArray(sale.payments) ? sale.payments : Object.values(sale.payments || {})) as Payment[];
      paymentsArray.forEach(payment => {
          if (payment && payment.method === PaymentMethod.Bono && payment.voucherId) {
              const voucher = giftVouchers.find(v => v.id === payment.voucherId);
              if (voucher) {
                  const newVal = (voucher.currentValue || 0) + payment.amount;
                  batch.update(doc(db, 'giftVouchers', voucher.id), {
                      currentValue: newVal,
                      status: 'active'
                  });
              }
          }
      });

      batch.delete(doc(db, 'sales', saleId));
      await batch.commit();
  };

  const handleReprintSale = (sale: Sale) => { setSaleForReceipt(sale); setShowReceiptModal(true); };

  const handleSaveStockTake = async (stockTakeData: Omit<StockTake, 'id' | 'createdAt' | 'storeId'>, applyNow: boolean) => {
      if (!currentStoreId || !currentUser) return;
      const batch = writeBatch(db);
      const newRef = doc(collection(db, 'stockTakes'));
      const stockTake: StockTake = cleanObject({ ...stockTakeData, id: newRef.id, createdAt: new Date().toISOString(), storeId: currentStoreId, isApplied: applyNow });
      batch.set(newRef, stockTake);
      
      // Check for inconsistencies (differences in category counts)
      const inconsistencies = stockTake.verification.filter(v => v.difference !== 0);
      if (inconsistencies.length > 0 && !isAdmin) {
          const incidentRef = doc(collection(db, 'incidents'));
          const details = inconsistencies.map(v => `${v.categoryName}: ${v.difference > 0 ? '+' : ''}${v.difference} prendas`).join(', ');
          const newIncident: Incident = {
              id: incidentRef.id,
              type: IncidentType.INVENTORY_INCONSISTENCY,
              status: IncidentStatus.REGISTRADO,
              description: `Inconsistencia detectada en conteo físico por categorías. Diferencias: ${details}`,
              createdAt: stockTake.createdAt,
              sellerName: currentUser.name,
              storeId: currentStoreId,
              history: [{
                  status: IncidentStatus.REGISTRADO,
                  changedBy: 'Sistema (Automático)',
                  timestamp: new Date().toISOString(),
                  notes: `Novedad generada automáticamente por descuadre en inventario reportado por ${currentUser.name}`
              }]
          };
          batch.set(incidentRef, newIncident);
      }

      if (applyNow && stockTake.productCounts) {
          Object.entries(stockTake.productCounts).forEach(([pid, count]) => {
              const productRef = doc(db, 'inventory', pid);
              const product = inventory.find(p => p.id === pid);
              if (product) {
                batch.update(productRef, { stock: count });
                const log = createProductHistoryLog(product, currentUser.name, ProductChangeType.STOCK_TAKE_APPLIED, `Ajuste de inventario vía conteo físico a ${count} unidades (antes: ${product.stock}).`);
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
              const log = createProductHistoryLog(product, currentUser.name, ProductChangeType.STOCK_TAKE_APPLIED, `Ajuste diferido de inventario (Conteo del ${new Date(stockTake.createdAt).toLocaleDateString()}) a ${count} unidades (antes: ${product.stock}).`);
              batch.set(doc(db, 'productHistory', log.id), log);
            }
        });
        batch.update(doc(db, 'stockTakes', stockTake.id), { isApplied: true });
        await batch.commit();
        alert("Stock actualizado exitosamente.");
    }
  };

  const handleSaveDetailedDraft = async (categoryId: string, counts: Record<string, number>, systemSnapshot: Record<string, number>) => {
    if (!currentStoreId || !currentUser) return;
    
    const draftId = `${categoryId}_${currentStoreId}`;
    const draftRef = doc(db, 'pendingDetailedVerifications', draftId);
    const now = new Date().toISOString();
    
    const draftData: PendingDetailedVerification = { 
        id: draftId, 
        categoryId, 
        storeId: currentStoreId, 
        counts, 
        systemSnapshot, // Guardamos la foto del sistema al momento de guardar
        lastUpdatedBy: currentUser.name, 
        updatedAt: now 
    };
    await setDoc(draftRef, cleanObject(draftData));

    const historyRef = doc(collection(db, 'detailedVerificationHistory'));
    
    const historicalCounts: Record<string, { physical: number; system: number }> = {};
    Object.keys(systemSnapshot).forEach(pid => {
        historicalCounts[pid] = {
            physical: counts[pid] !== undefined ? counts[pid] : 0, 
            system: systemSnapshot[pid] || 0
        };
    });

    await setDoc(historyRef, cleanObject({
        ...draftData,
        id: historyRef.id,
        draftId: draftId,
        counts: historicalCounts, 
        updatedAt: now 
    }));
  };

  const handleApplyDetailedVerification = async (categoryId: string, counts: Record<string, number>) => {
    if (!currentStoreId || !currentUser || !isAdmin) return;
    const batch = writeBatch(db);
    Object.entries(counts).forEach(([pid, count]) => {
      const productRef = doc(db, 'inventory', pid);
      const product = inventory.find(p => p.id === pid);
      if (product) {
        batch.update(productRef, { stock: count });
        const log = createProductHistoryLog(product, currentUser.name, ProductChangeType.STOCK_TAKE_APPLIED, `Ajuste detallado de stock a ${count} unidades por administrador.`);
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

  const handleUpdateVoucherStatus = async (voucherId: string, status: 'active' | 'redeemed' | 'cancelled') => {
    try {
      await updateDoc(doc(db, 'giftVouchers', voucherId), { status });
    } catch (error) {
      console.error("Error updating voucher status:", error);
      alert("Error al actualizar el estado del bono.");
    }
  };

  const handleDeleteVoucher = async (voucherId: string) => {
    const voucher = giftVouchers.find(v => v.id === voucherId);
    if (!voucher) return;

    try {
      const batch = writeBatch(db);
      
      // 1. Delete the voucher document
      batch.delete(doc(db, 'giftVouchers', voucherId));
      
      // 2. Find and delete the sale that created this voucher
      // We first check if the voucher has a saleId stored
      let saleIdToDelete = voucher.saleId;
      
      if (!saleIdToDelete) {
        // Fallback: Find a sale that has an item with id: voucher-{code}
        const saleToCancel = (allSales.length > 0 ? allSales : sales).find(s => 
          s.items.some(item => item && item.id === `voucher-${voucher.code}`)
        );
        if (saleToCancel) saleIdToDelete = saleToCancel.id;
      }
      
      if (saleIdToDelete) {
        batch.delete(doc(db, 'sales', saleIdToDelete));
      }
      
      await batch.commit();
    } catch (error) {
      console.error("Error deleting voucher:", error);
      alert("Error al eliminar el bono.");
    }
  };

  const handleCreateGiftVoucher = async (voucher: Omit<GiftVoucher, 'id'>) => {
    try {
      const newRef = doc(collection(db, 'giftVouchers'));
      await setDoc(newRef, { ...voucher, id: newRef.id });
    } catch (error) {
      console.error("Error creating gift voucher:", error);
      throw error;
    }
  };

  const handleUpdateGiftVoucher = async (voucherId: string, updates: Partial<GiftVoucher>) => {
    try {
      await updateDoc(doc(db, 'giftVouchers', voucherId), updates);
    } catch (error) {
      console.error("Error updating gift voucher:", error);
      throw error;
    }
  };

  const handleAddProduct = async (newProductData: any, selectedStoreIds: string[], imageFile?: File) => {
      const inputName = newProductData.name;
      
      const q = query(collection(db, 'inventory'), where('name', '==', inputName));
      const snapshot = await getDocs(q);
      
      let imageUrl = '';
      let existingDescription = newProductData.description;
      let existingCategoryId = newProductData.categoryId;
      let existingSku = '';

      if (!snapshot.empty) {
          const firstMatch = snapshot.docs[0].data() as Product;
          imageUrl = firstMatch.imageUrl;
          existingDescription = firstMatch.description;
          existingCategoryId = firstMatch.categoryId;
          existingSku = firstMatch.sku;
      }

      if (imageFile) {
          imageUrl = await uploadImageAndGetURL(imageFile);
      }

      const batch = writeBatch(db);
      
      snapshot.docs.forEach(docSnap => {
          batch.update(docSnap.ref, {
              imageUrl,
              description: existingDescription,
              categoryId: existingCategoryId
          });
      });

      const existingSkus = new Set<string>(inventory.map(p => p.sku).filter(Boolean) as string[]);
      const sku = existingSku || generateUniqueSku(inputName, existingSkus);
      const existingStoreIds = snapshot.docs.map(d => (d.data() as Product).storeId);

      selectedStoreIds.forEach(storeId => {
          if (existingStoreIds.includes(storeId)) {
              const existingDoc = snapshot.docs.find(d => (d.data() as Product).storeId === storeId);
              if (existingDoc) {
                  batch.update(existingDoc.ref, { 
                      stock: increment(newProductData.stock)
                  });
              }
          } else {
              const newRef = doc(collection(db, 'inventory'));
              batch.set(newRef, cleanObject({ 
                  ...newProductData, 
                  description: existingDescription,
                  categoryId: existingCategoryId,
                  id: newRef.id, 
                  sku, 
                  imageUrl, 
                  storeId, 
                  isDisabled: false 
              }));
          }
      });
      await batch.commit();
  };

  const handleUpdateProduct = async (updatedProduct: Product, imageFile?: File) => {
      const productRef = doc(db, 'inventory', updatedProduct.id);
      
      const currentSnap = await getDoc(productRef);
      const nameInDb = currentSnap.exists() ? currentSnap.data().name : updatedProduct.name;
      const oldStock = currentSnap.exists() ? (currentSnap.data().stock || 0) : 0;
      const oldPrice = currentSnap.exists() ? (currentSnap.data().price || 0) : 0;
      
      let newImageUrl = updatedProduct.imageUrl;
      if (imageFile) {
        newImageUrl = await uploadImageAndGetURL(imageFile);
      }

      const batch = writeBatch(db);
      
      const q = query(collection(db, 'inventory'), where('name', '==', nameInDb));
      const snapshot = await getDocs(q);
      
      if (snapshot.empty) {
          batch.update(productRef, {
              name: updatedProduct.name,
              imageUrl: newImageUrl,
              description: updatedProduct.description,
              categoryId: updatedProduct.categoryId,
              stock: updatedProduct.stock,
              price: updatedProduct.price,
              cost: updatedProduct.cost,
              supplier: updatedProduct.supplier,
              isDisabled: updatedProduct.isDisabled,
              discountPrice: updatedProduct.discountPrice !== undefined ? updatedProduct.discountPrice : deleteField()
          });
      } else {
          snapshot.docs.forEach(docSnap => {
              const updateData: any = { 
                  name: updatedProduct.name, 
                  imageUrl: newImageUrl,
                  description: updatedProduct.description,
                  categoryId: updatedProduct.categoryId
              };
              
              if (docSnap.id === updatedProduct.id) {
                  updateData.stock = updatedProduct.stock;
                  updateData.price = updatedProduct.price;
                  updateData.cost = updatedProduct.cost;
                  updateData.supplier = updatedProduct.supplier;
                  updateData.isDisabled = updatedProduct.isDisabled;
                  updateData.discountPrice = updatedProduct.discountPrice !== undefined ? updatedProduct.discountPrice : deleteField();
              }
              batch.update(docSnap.ref, updateData);
          });
      }

      if (oldStock !== updatedProduct.stock || oldPrice !== updatedProduct.price) {
          const logRef = doc(collection(db, 'productHistory'));
          let details = `Ajuste manual: `;
          if (oldStock !== updatedProduct.stock) details += `Stock ${oldStock} -> ${updatedProduct.stock}. `;
          if (oldPrice !== updatedProduct.price) details += `Precio ${formatCOP(oldPrice)} -> ${formatCOP(updatedProduct.price)}. `;
          
          const log: ProductHistoryLog = {
              id: logRef.id,
              productId: updatedProduct.id,
              productName: updatedProduct.name,
              storeId: updatedProduct.storeId,
              changedBy: currentUser?.name || 'Administrador',
              timestamp: new Date().toISOString(),
              changeType: ProductChangeType.MANUAL_EDIT,
              details
          };
          batch.set(logRef, log);
      }
      
      await batch.commit();
  };

  const handleDeleteProduct = async (productId: string) => { await deleteDoc(doc(db, 'inventory', productId)); };
  
  const handleRegenerateAllSkus = async () => {
    if (!isAdmin) return;
    if (!window.confirm('¿ESTÁS ABSOLUTAMENTE SEGURO? Esta acción reemplazará TODOS los SKUs actuales (incluyendo los que están bien) por formatos cortos y coherentes (PREF1234). Los códigos de barras impresos anteriormente dejarán de funcionar. Esta acción no se puede deshacer.')) {
      return;
    }
    
    setIsLoading(true);
    try {
      const batch = writeBatch(db);
      const usedSkus = new Set<string>();
      const skuByName = new Map<string, string>(); // Mapa para mantener consistencia del SKU basado en el nombre
      
      // Ordenamos por nombre para que los prefijos sean coherentes si hay repetidos
      const sortedInventory = [...inventory].sort((a, b) => a.name.localeCompare(b.name));
      
      sortedInventory.forEach(product => {
        const uniqueKey = product.name.trim().toLowerCase();
        let newSku = skuByName.get(uniqueKey);
        
        if (!newSku) {
          newSku = generateUniqueSku(product.name, usedSkus);
          usedSkus.add(newSku);
          skuByName.set(uniqueKey, newSku);
        }
        
        const productRef = doc(db, 'inventory', product.id);
        batch.update(productRef, { sku: newSku });
      });
      
      await batch.commit();
      alert(`Éxito: Se han reconsolidado y regenerado ${sortedInventory.length} SKUs de forma consistente en todos los locales.`);
    } catch (error) {
      console.error("Error al regenerar SKUs:", error);
      alert('Hubo un error al regenerar los SKUs. Por favor, intenta de nuevo.');
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleBulkAddProducts = async (products: any[], storeId: string) => {
      const batch = writeBatch(db);
      const existingSkus = new Set<string>(inventory.map(p => p.sku).filter(Boolean) as string[]);
      const skuByName = new Map<string, string>();
      
      // Llenamos el mapa con los SKUs de los productos que ya existen en inventario
      inventory.forEach(p => {
        if (p.name && p.sku) {
          skuByName.set(p.name.trim().toLowerCase(), p.sku);
        }
      });
      
      products.forEach(p => {
          const uniqueKey = p.name ? p.name.trim().toLowerCase() : '';
          let sku = skuByName.get(uniqueKey);
          
          if (!sku) {
            sku = generateUniqueSku(p.name, existingSkus);
            existingSkus.add(sku);
            if (uniqueKey) {
              skuByName.set(uniqueKey, sku);
            }
          }
          
          const newRef = doc(collection(db, 'inventory'));
          batch.set(newRef, cleanObject({ ...p, id: newRef.id, sku, storeId, isDisabled: false }));
      });
      await batch.commit();
  };

  const handleMultiStorePurchase = async (data: {
    productInfo: { name: string; categoryId: string; };
    storeEntries: Record<string, { quantity: number; cost: number; price: number; supplier: string }>;
  }) => {
    if (!currentUser) return;
    
    const { productInfo, storeEntries } = data;
    const inputName = productInfo.name;
    
    const globalQ = query(collection(db, 'inventory'), where('name', '==', inputName), limit(1));
    const globalSnap = await getDocs(globalQ);
    
    let globalImage = '';
    let globalDesc = 'Sin descripción...';
    let globalCategoryId = productInfo.categoryId;
    let globalSku = '';

    if (!globalSnap.empty) {
        const d = globalSnap.docs[0].data() as Product;
        globalImage = d.imageUrl;
        globalDesc = d.description;
        globalCategoryId = d.categoryId;
        globalSku = d.sku || '';
    }

    const batch = writeBatch(db);

    try {
        for (const [storeId, entry] of Object.entries(storeEntries)) {
            const q = query(collection(db, 'inventory'), 
                           where('name', '==', inputName), 
                           where('storeId', '==', storeId), 
                           limit(1));
            const snapshot = await getDocs(q);
            
            let productRef;
            let currentStock = 0;
            let productId;

            if (!snapshot.empty) {
                const docSnap = snapshot.docs[0];
                productRef = docSnap.ref;
                const existingData = docSnap.data();
                currentStock = existingData.stock || 0;
                productId = docSnap.id;
                
                batch.update(productRef, {
                    stock: increment(entry.quantity),
                    cost: entry.cost,
                    price: entry.price,
                    supplier: entry.supplier,
                    imageUrl: globalImage || existingData.imageUrl, 
                    description: globalDesc || existingData.description,
                    categoryId: globalCategoryId,
                    isDisabled: false
                });
            } else {
                const newProductRef = doc(collection(db, 'inventory'));
                productRef = newProductRef;
                productId = newProductRef.id;
                
                const existingSkus = new Set<string>(inventory.map(p => p.sku).filter(Boolean) as string[]);
                const sku = globalSku || generateUniqueSku(inputName, existingSkus);
                if (!globalSku) globalSku = sku; // So other iterations also use it!
                
                batch.set(newProductRef, cleanObject({
                    id: productId,
                    name: inputName,
                    categoryId: globalCategoryId,
                    sku,
                    cost: entry.cost,
                    price: entry.price,
                    stock: entry.quantity,
                    supplier: entry.supplier,
                    storeId,
                    imageUrl: globalImage,
                    description: globalDesc,
                    isDisabled: false
                }));
            }

            const purchaseRef = doc(collection(db, 'purchases'));
            batch.set(purchaseRef, cleanObject({
                id: purchaseRef.id,
                productId: productId,
                productName: inputName,
                quantity: entry.quantity,
                cost: entry.cost,
                totalCost: entry.quantity * entry.cost,
                supplier: entry.supplier,
                createdAt: new Date().toISOString(),
                storeId: storeId
            }));

            const logRef = doc(collection(db, 'productHistory'));
            const log = {
                id: logRef.id,
                productId,
                productName: inputName,
                storeId,
                changedBy: currentUser.name,
                timestamp: new Date().toISOString(),
                changeType: ProductChangeType.PURCHASE,
                details: `Compra de ${entry.quantity} unidades (Antes: ${currentStock})`
            };
            batch.set(logRef, log);
        }

        await batch.commit();
    } catch (error: any) {
        console.error("Error al registrar compras multi-tienda:", error);
        alert(`Error al procesar la compra: ${error.message}`);
        throw error;
    }
  };

  const handleUpdatePurchase = async (updatedPurchase: Purchase, originalQuantity: number, newProductPrice: number) => {
    if (!currentUser) return;
    const batch = writeBatch(db);
    const purchaseRef = doc(db, 'purchases', updatedPurchase.id);
    const productRef = doc(db, 'inventory', updatedPurchase.productId);

    const qtyDiff = updatedPurchase.quantity - originalQuantity;

    batch.update(purchaseRef, { ...updatedPurchase });
    batch.update(productRef, {
        stock: increment(qtyDiff),
        cost: updatedPurchase.cost,
        price: newProductPrice,
        supplier: updatedPurchase.supplier
    });

    const logRef = doc(collection(db, 'productHistory'));
    batch.set(logRef, {
        id: logRef.id,
        productId: updatedPurchase.productId,
        productName: updatedPurchase.productName,
        storeId: updatedPurchase.storeId,
        changedBy: currentUser.name,
        timestamp: new Date().toISOString(),
        changeType: ProductChangeType.PURCHASE_EDIT,
        details: `Edición de compra. Ajuste stock: ${qtyDiff > 0 ? '+' : ''}${qtyDiff}`
    });

    await batch.commit();
  };

  const handleDeletePurchase = async (purchaseId: string) => {
    const purchase = purchases.find(p => p.id === purchaseId);
    if (!purchase || !currentUser) return;
    
    if (!window.confirm('¿Eliminar compra? El stock se restará del inventario.')) return;

    const batch = writeBatch(db);
    batch.delete(doc(db, 'purchases', purchaseId));
    batch.update(doc(db, 'inventory', purchase.productId), {
        stock: increment(-purchase.quantity)
    });

    const logRef = doc(collection(db, 'productHistory'));
    batch.set(logRef, {
        id: logRef.id,
        productId: purchase.productId,
        productName: purchase.productName,
        storeId: purchase.storeId,
        changedBy: currentUser.name,
        timestamp: new Date().toISOString(),
        changeType: ProductChangeType.PURCHASE_DELETE,
        details: `Compra eliminada. Se restaron ${purchase.quantity} unidades.`
    });

    await batch.commit();
  };

  const handleAddCategory = async (name: string) => { const newRef = doc(collection(db, 'categories')); await setDoc(newRef, { id: newRef.id, name }); };
  const handleUpdateCategory = async (id: string, name: string) => await updateDoc(doc(db, 'categories', id), { name });
  const handleDeleteCategory = async (id: string) => await deleteDoc(doc(db, 'categories', id));
  
  const handleAddExpenseCategory = async (name: string) => {
    if (!currentStoreId) return;
    const newRef = doc(collection(db, 'expenseCategories'));
    await setDoc(newRef, { id: newRef.id, name, storeId: currentStoreId });
  };
  const handleUpdateExpenseCategory = async (id: string, name: string) => await updateDoc(doc(db, 'expenseCategories', id), { name });
  const handleDeleteExpenseCategory = async (id: string) => await deleteDoc(doc(db, 'expenseCategories', id));

  const handleAddStore = async (store: Store) => await setDoc(doc(db, 'stores', store.id), cleanObject(store) as any);
  const handleUpdateStore = async (updatedStore: Store) => {
    try {
      await updateDoc(doc(db, 'stores', updatedStore.id), cleanObject(updatedStore) as any);
      
      // Sincronizar configuración de etiquetas en todos los locales
      if (updatedStore.labelConfig) {
        const batch = writeBatch(db);
        stores.forEach(s => {
          if (s.id !== updatedStore.id) {
            batch.update(doc(db, 'stores', s.id), { labelConfig: updatedStore.labelConfig });
          }
        });
        await batch.commit();
      }
    } catch (error: any) {
      console.error('Error updating store:', error);
      alert(`Error al guardar: ${error?.message || 'Error desconocido'}`);
      throw error;
    }
  };
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
  const handleUpdateRole = async (updatedRole: Role) => await setDoc(doc(db, 'roles', updatedRole.id), cleanObject(updatedRole));
  
  const handleSavePayroll = async (payrollData: any) => {
      if (!currentStoreId || !currentUser) return;
      const newRef = doc(collection(db, 'payrollHistory'));
      const paidAt = payrollData.paidAt || new Date().toISOString();
      await setDoc(newRef, cleanObject({ ...payrollData, id: newRef.id, paidAt, paidBy: currentUser.name, storeId: currentStoreId }));
  };

  const handleDeletePayroll = async (payrollId: string) => {
      await deleteDoc(doc(db, 'payrollHistory', payrollId));
  };
  
  const handleBulkAddCustomers = async (newCustomers: any[]) => {
      if (!currentStoreId) return;
      const batch = writeBatch(db);
      newCustomers.forEach(c => {
          const newRef = doc(collection(db, 'customers'));
          batch.set(newRef, cleanObject({ ...c, id: newRef.id, storeId: currentStoreId, createdAt: new Date().toISOString() }));
      });
      await batch.commit();
  };
  const handleUpdateCustomer = async (id: string, name: string, phone: string) => await updateDoc(doc(db, 'customers', id), { name, phone });

  const handleAddExpense = async (expenseData: Omit<Expense, 'id'>) => {
      if (!currentStoreId || !currentUser) return;
      const newRef = doc(collection(db, 'financialRecords'));
      // Mapeamos Expense a FinancialRecord
      const financialRecord: FinancialRecord = {
        id: newRef.id,
        date: expenseData.date === 'TEMPLATE' ? new Date().toISOString() : expenseData.date,
        storeId: currentStoreId,
        accountType: 'cash', // Por defecto a caja si se crea desde contabilidad, o podrías pedirlo
        amount: -Math.abs(expenseData.amount),
        type: 'expense',
        description: expenseData.description,
        subCategory: expenseData.category,
        registeredBy: currentUser.name,
        isConfirmed: true,
        affectsCashBalance: true
      };
      
      // Si es una plantilla, seguimos guardándola en 'expenses' para persistencia de plantillas
      if (expenseData.isRecurring) {
        const templateRef = doc(collection(db, 'expenses'));
        await setDoc(templateRef, { ...expenseData, id: templateRef.id, storeId: currentStoreId });
      } else {
        await setDoc(newRef, cleanObject(financialRecord));
      }
  };

  const handleUpdateExpense = async (expense: Expense) => {
      // Si es plantilla, actualizamos en 'expenses'
      if (expense.isRecurring) {
        await updateDoc(doc(db, 'expenses', expense.id), { ...expense });
        return;
      }

      // Si es un gasto real, actualizamos en 'financialRecords'
      // Nota: el ID del gasto en SmartAccountantView ahora vendrá de financialRecords si cambiamos el mapeo
      const recordRef = doc(db, 'financialRecords', expense.id);
      await updateDoc(recordRef, {
          description: expense.description,
          amount: -Math.abs(expense.amount),
          subCategory: expense.category,
          date: expense.date
      });
  };

  const handleDeleteExpense = async (id: string) => {
      if (!window.confirm('¿Eliminar este registro de gasto?')) return;
      
      // Intentamos borrar de ambos por si acaso (o verificamos existencia)
      const expenseRef = doc(db, 'expenses', id);
      const financialRef = doc(db, 'financialRecords', id);
      
      const expenseDoc = await getDoc(expenseRef);
      if (expenseDoc.exists()) {
        await deleteDoc(expenseRef);
      } else {
        await deleteDoc(financialRef);
      }
  };

  const handleToggleFinancialRecordAccounting = async (id: string, exclude: boolean) => {
    const recordRef = doc(db, 'financialRecords', id);
    await updateDoc(recordRef, { excludeFromAccounting: exclude });
  };

  const handleUpdateAccountingChat = async (messages: any[]) => {
    if (!currentStoreId) return;
    const chatRef = doc(db, 'accountingChatHistory', currentStoreId);
    await setDoc(chatRef, { messages, lastUpdated: new Date().toISOString() });
  };

  const handleLogin = (sellerName: string, passwordAttempt: string) => {
    const seller = sellers.find(s => s.name.trim().toLowerCase() === sellerName.trim().toLowerCase());
    if (seller && seller.password.trim() === passwordAttempt.trim()) {
      setCurrentUser(seller); handleSwitchStore(seller.storeId);
      const sellerRole = roles.find(role => role.id === seller.roleId);
      if (sellerRole && sellerRole.name.toLowerCase() === 'vendedor') setCurrentView(View.POS);
      else setCurrentView(View.DASHBOARD);
      const newLoginRecord: Omit<LoginRecord, 'id'> = { sellerId: seller.id, sellerName: seller.name, date: new Date().toISOString(), storeId: seller.storeId };
      addDoc(collection(db, 'loginHistory'), newLoginRecord);
    } else alert('Usuario o contraseña incorrecta.');
  };
  
  const handleLogout = () => { setCurrentUser(null); setCurrentStoreId(null); localStorage.removeItem('currentStoreId'); setIsGlobalMode(false); setInventory([]); setHasShownBriefing(false); };

  if (!currentUser) return <div className="min-h-screen w-full flex items-center justify-center p-4"><LoginView onLogin={handleLogin} isAppReady={isAppReady} onOpenVersionHistory={() => setIsVersionModalOpen(true)} />{isVersionModalOpen && <VersionHistoryModal isOpen={isVersionModalOpen} onClose={() => setIsVersionModalOpen(false)} />}</div>;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 transition-colors duration-300">
      <Header currentView={currentView} setCurrentView={setCurrentView} theme={theme} toggleTheme={toggleTheme} currentUser={currentUser} currentStore={currentStore} userPermissions={userPermissions} onLogout={handleLogout} stores={stores} onSwitchStore={handleSwitchStore} roles={roles} isGlobalMode={isGlobalMode} onToggleGlobalMode={() => setIsGlobalMode(!isGlobalMode)} incidents={incidents} onOpenBriefing={() => setIsBriefingModalOpen(true)} onOpenVersionHistory={() => setIsVersionModalOpen(true)} />
      <main className="container mx-auto p-4 pb-20 lg:pb-4">
        {currentView === View.DASHBOARD && <DashboardView stores={stores} allLayaways={allLayaways} allIncidents={allIncidents} currentUser={currentUser} roles={roles} onSwitchStore={handleSwitchStore} onNavigate={setCurrentView} onOpenReports={() => setIsReportsModalOpen(true)} sales={sales} layaways={layaways} expenses={expenses} inventory={inventory} categories={categories} sellers={sellers} dailyNotes={dailyNotes} currentStore={currentStore} onUpdateSale={handleUpdateSale} onDeleteSale={handleDeleteSale} onReprintSale={handleReprintSale} onOpenVerification={() => setIsVerificationModalOpen(true)} purchases={purchases} allSales={allSales} allInventory={globalInventoryForSearch} allStockTakes={stockTakes} />}
        {currentView === View.POS && <PosView inventory={isGlobalMode ? globalInventoryForSearch : inventory} categories={categories} sellers={sellers} stores={stores} sales={sales} purchases={purchases} layaways={layaways} allCustomers={customers} activeCart={activeCart} heldCarts={heldCarts} onAddToCart={handleAddToCart} onUpdateCartQuantity={handleUpdateCartQuantity} onUpdateCartItemPrice={handleUpdateCartItemPrice} onRemoveFromCart={handleRemoveFromCart} onClearCart={handleClearCart} onProcessSale={handleProcessSale} onHoldSale={handleHoldSale} onResumeSale={handleResumeSale} onCreateLayaway={handleCreateLayaway} onSaveStockTake={handleSaveStockTake} dailyNotes={dailyNotes} onAddDailyNote={handleAddDailyNote} onNavigate={setCurrentView} currentStore={currentStore} incidents={incidents} onCreateIncident={handleCreateIncident} currentUser={currentUser} roles={roles} nextInvoiceNumber={currentStore?.nextInvoiceNumber || 1} onUpdateProduct={handleUpdateProduct} verifiedProducts={verifiedProducts} onToggleProductVerification={handleToggleProductVerification} onClearVerifications={handleClearVerifications} onSaveDetailedDraft={handleSaveDetailedDraft} onApplyDetailedVerification={handleApplyDetailedVerification} onUpdateStoreSettings={handleUpdateStore} onOpenVerification={() => setIsVerificationModalOpen(true)} giftVouchers={giftVouchers} onCreateGiftVoucher={handleCreateGiftVoucher} onUpdateGiftVoucher={handleUpdateGiftVoucher} onRegenerateAllSkus={handleRegenerateAllSkus} />}
        {currentView === View.INVENTORY && <InventoryView inventory={inventory} allInventory={isGlobalMode ? globalInventoryForSearch : inventory} sales={sales} purchases={purchases} layaways={layaways} categories={categories} stores={stores} currentStoreId={currentStoreId || ''} onAddProduct={handleAddProduct} onUpdateProduct={handleUpdateProduct} onBulkAddProducts={handleBulkAddProducts} onDeleteProduct={handleDeleteProduct} onAddCategory={handleAddCategory} onUpdateCategory={handleUpdateCategory} onDeleteCategory={handleDeleteCategory} onNavigate={setCurrentView} productHistory={productHistory} currentUser={currentUser} roles={roles} showDisabledProducts={shouldIncludeDisabledProducts} onShowDisabledProductsChange={setShouldIncludeDisabledProducts} onReactivateInconsistentProducts={(ids) => ids.forEach(id => updateDoc(doc(db, 'inventory', id), { isDisabled: false }))} onRegenerateAllSkus={handleRegenerateAllSkus} />}
        {currentView === View.INVENTORY_TRANSFER && <InventoryTransferView inventory={inventory} stores={stores} currentUser={currentUser} transfers={inventoryTransfers} onTransfer={(data) => handleInventoryTransfer(data)} onResetBalances={handleResetBalances} />}
        {currentView === View.LAYAWAY && <LayawayView layaways={layaways} sellers={sellers} inventory={inventory} onAddPayment={handleAddPaymentToLayaway} onFulfillPreOrder={handleFulfillPreOrder} onDeleteLayaway={handleDeleteLayaway} onUpdateLayaway={handleUpdateLayaway} currentUser={currentUser} roles={roles} />}
        {currentView === View.PURCHASES && <PurchasesView purchases={purchases} inventory={inventory} allInventoryForSearch={isGlobalMode ? globalInventoryForSearch : undefined} categories={categories} stores={stores} currentStoreId={currentStoreId || ''} onMultiStorePurchase={handleMultiStorePurchase} onUpdatePurchase={handleUpdatePurchase} onDeletePurchase={handleDeletePurchase} onUpdateProduct={handleUpdateProduct} onLoadFullHistory={() => setLoadFullPurchases(true)} isFullHistoryLoaded={loadFullPurchases} />}
        {currentView === View.SELLERS && <SellersView sellers={sellers} roles={roles} stores={stores} onAddSeller={handleAddSeller} onUpdateSeller={handleUpdateSeller} onDeleteSeller={handleDeleteSeller} onToggleSellerStatus={handleToggleSellerStatus} />}
        {currentView === View.STORES && <StoresView stores={stores} onAddStore={handleAddStore} onUpdateStore={handleUpdateStore} onDeleteStore={handleDeleteStore} />}
        {currentView === View.CUSTOMERS && <CustomersView sales={sales} layaways={layaways} allCustomers={customers} onBulkAddCustomers={handleBulkAddCustomers} onUpdateCustomer={handleUpdateCustomer} />}
        {currentView === View.STOCK_TAKE_HISTORY && <StockTakeHistoryView stockTakes={stockTakes} sellers={sellers} onDeleteStockTake={(id) => deleteDoc(doc(db, 'stockTakes', id))} onAddNoteToStockTake={(id, note) => updateDoc(doc(db, 'stockTakes', id), { notes: arrayUnion({ content: note, author: currentUser.name, date: new Date().toISOString() }) })} onApplyStockTake={handleApplyHistoricalStockTake} currentUser={currentUser} roles={roles} />}
        {currentView === View.PAYROLL && <PayrollView sellers={sellers} sales={sales} layaways={layaways} loginHistory={loginHistory} payrollHistory={payrollHistory} onSavePayroll={handleSavePayroll} onDeletePayroll={handleDeletePayroll} currentUser={currentUser} currentStore={currentStore} />}
        {currentView === View.SETTINGS && <SettingsView stores={stores} allInventory={isGlobalMode ? globalInventoryForSearch : inventory} categories={categories} onSave={handleUpdateStore} onResetStoreData={() => {}} currentUser={currentUser} roles={roles} onRecompressAllProductImages={() => {}} isRecompressing={isRecompressing} recompressProgress={recompressProgress} onGenerateTestData={() => {}} onReactivateAllProducts={() => {}} />}
        {currentView === View.ROLE_MANAGER && <RoleManagerView roles={roles} onAddRole={handleAddRole} onUpdateRole={handleUpdateRole} />}
        {currentView === View.INCIDENTS && <IncidentsView incidents={incidents} inventory={inventory} currentUser={currentUser} roles={roles} sales={sales} stores={stores} customers={customers} onCreateIncident={handleCreateIncident} onApproveIncident={handleApproveIncident} onResolveIncident={handleResolveIncident} onUpdateIncident={handleUpdateIncident} onDeleteIncident={handleDeleteIncident} />}
        {currentView === View.ACCOUNTING && (
          <SmartAccountantView 
            sales={sales} 
            layaways={layaways} 
            expenses={expenses} 
            expenseCategories={expenseCategories} 
            payrollHistory={payrollHistory} 
            inventory={inventory} 
            purchases={purchases} 
            financialRecords={financialRecords}
            currentStore={currentStore} 
            currentUser={currentUser} 
            onAddExpense={handleAddExpense} 
            onUpdateExpense={handleUpdateExpense} 
            onDeleteExpense={handleDeleteExpense} 
            onAddExpenseCategory={handleAddExpenseCategory} 
            onUpdateExpenseCategory={handleUpdateExpenseCategory} 
            onDeleteExpenseCategory={handleDeleteExpenseCategory}
            chatMessages={accountingChatHistory}
            onUpdateChatMessages={handleUpdateAccountingChat}
            onToggleFinancialRecordAccounting={handleToggleFinancialRecordAccounting}
            onNavigate={setCurrentView}
          />
        )}
        {currentView === View.FINANCIAL_RECONCILIATION && (
            <FinancialReconciliationView 
                stores={stores} 
                activeStoreId={currentStoreId || ''}
                onSetActiveStoreId={handleSwitchStore}
                sales={isAdmin ? allSales : sales} 
                layaways={isAdmin ? allLayaways : layaways} 
                expenses={expenses}
                incidents={isAdmin ? allIncidents : incidents}
                currentUser={currentUser!}
                onNavigate={setCurrentView}
                onAddExpense={handleAddExpense}
                onUpdateStore={handleUpdateStore}
            />
        )}
        {currentView === View.GIFT_VOUCHERS && currentUser && (
          <GiftVouchersView 
            vouchers={giftVouchers} 
            sellers={sellers} 
            stores={stores} 
            currentUser={currentUser} 
            isAdmin={isAdmin}
            onUpdateVoucherStatus={handleUpdateVoucherStatus} 
            onDeleteVoucher={handleDeleteVoucher}
          />
        )}
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
      
      <PendingIncidentsBriefingModal 
        isOpen={isBriefingModalOpen}
        onClose={() => {
            setIsBriefingModalOpen(false);
            setHasShownBriefing(true);
            if (currentUser) {
              const todayStr = new Date().toISOString().split('T')[0];
              localStorage.setItem(`lastBriefingDate_${currentUser.id}`, todayStr);
            }
        }}
        incidents={incidents}
        layaways={layaways}
        onNavigate={setCurrentView}
      />
      
      {isVersionModalOpen && (
        <VersionHistoryModal 
            isOpen={isVersionModalOpen} 
            onClose={() => setIsVersionModalOpen(false)} 
        />
      )}
    </div>
  );
};

export default App;

// VERSION: 1.1.51
