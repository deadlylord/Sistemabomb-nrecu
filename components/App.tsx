import { resolveTenantRole, tenantPermissions, tenantOperationPermissions } from '../services/tenantIdentity';
import { ensureCompanyRole } from '../services/companyRoles';
import { createTenantWriter, assertTenantData } from '../services/tenantWrites';
import { useCompanyCollection } from '../services/useCompanyCollection';
import { subscribeStoreRows } from '../services/storeSubscriptions';
import { isolateLegacyCategoryForStore } from '../services/legacyCategoryIsolation';
import { belongsToCompany, selectCompanyCategories } from '../services/companyCategories';
import { hasPlatformDeveloperAccess, isPlatformOwner, isPlatformRole, assertCompanyRole, assertPlatformOwnerAction, PLATFORM_OWNER_USER_ID, type PlatformDeveloperGrant } from '../services/developerAccess';
import { setPlatformDeveloper } from '../services/platformDevelopers';
import { operationContextKey } from '../services/operationContext';

import React, { useState, useCallback, useEffect, useMemo, useRef, lazy, Suspense } from 'react';
import { db, auth } from '../firebase';
import { 
  collection, 
  doc as nativeDoc,
  getDoc, 
  getDocs, 
  setDoc as nativeSetDoc,
  updateDoc as nativeUpdateDoc,
  deleteDoc as nativeDeleteDoc,
  writeBatch as nativeWriteBatch,
  increment, 
  query, 
  where, 
  limit, 
  onSnapshot,
  addDoc as nativeAddDoc,
  DocumentReference,
  Query,
  WriteBatch,
  arrayUnion,
  runTransaction as nativeRunTransaction,
  orderBy,
  deleteField
} from 'firebase/firestore';
import { onAuthStateChanged, signInAnonymously } from 'firebase/auth';
import { Product, CartItem, View, PaymentMethod, HeldCart, Layaway, Category, Sale, Purchase, Seller, StockTake, DailyNote, CeoDailyNote, Role, LoginRecord, Store, InventoryTransfer, Incident, IncidentType, IncidentStatus, ProductHistoryLog, ProductChangeType, PayrollRecord, Customer, Payment, PendingDetailedVerification, Expense, ExpenseCategory, GiftVoucher, FinancialRecord, Loan, Company, DEFAULT_COMPANY_ID, DEFAULT_CLIENT_ALLOWED_VIEWS } from '../types';
import Header from './Header';
import { ViewFiltersProvider } from '../services/viewFilters';
import AppErrorBoundary from './AppErrorBoundary';
import VestikaLoader from './VestikaLoader';
import { useStoreCollection } from '../services/useStoreCollection';
import StockTakeModal from './StockTakeModal';
import LoginView from './LoginView';
import ReportsModal from './ReportsView';
import { INITIAL_CATEGORIES, INITIAL_PRODUCTS, INITIAL_ROLES, INITIAL_SELLERS, INITIAL_STORES, formatCOP, toTitleCase, generateUniqueSku, normalizeText } from '../constants';
import ReceiptModal from './ReceiptModal';
import RecaudoReceiptModal from './RecaudoReceiptModal';
import { reuploadImageFromUrl, uploadImageAndGetURL } from '../services/storageService';
import { InventoryVerificationModal } from './InventoryVerificationModal';
import PendingIncidentsBriefingModal from './PendingIncidentsBriefingModal';
import { PwaInstallModal } from './PwaInstallModal';

const PosView = lazy(() => import('./PosView'));
const InventoryView = lazy(() => import('./InventoryView'));
const InventoryTransferView = lazy(() => import('./InventoryTransferView').then(module => ({ default: module.InventoryTransferView })));
const LayawayView = lazy(() => import('./LayawayView').then(module => ({ default: module.LayawayView })));
const SalesView = lazy(() => import('./SalesView'));
const PurchasesView = lazy(() => import('./PurchasesView'));
const SellersView = lazy(() => import('./SellersView'));
const StoresView = lazy(() => import('./StoresView'));
const StockTakeHistoryView = lazy(() => import('./StockTakeHistoryView'));
const CustomersView = lazy(() => import('./CustomersView'));
const SettingsView = lazy(() => import('./SettingsView').then(module => ({ default: module.SettingsView })));
const PayrollView = lazy(() => import('./PayrollView'));
const RoleManagerView = lazy(() => import('./RoleManagerView'));
const IncidentsView = lazy(() => import('./IncidentsView'));
const CeoCenterView = lazy(() => import('./CeoCenterView').then(module => ({ default: module.CeoCenterView })));
const DeveloperCenterView = lazy(() => import('./DeveloperCenterView'));
const DashboardView = lazy(() => import('./DashboardView'));
const SmartAccountantView = lazy(() => import('./SmartAccountantView'));
const FinancialReconciliationView = lazy(() => import('./FinancialReconciliationView'));
const GiftVouchersView = lazy(() => import('./GiftVouchersView'));
const TagScanningView = lazy(() => import('./TagScanningView').then(module => ({ default: module.TagScanningView })));

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
  let active = true;
  const unsubscribe = onSnapshot(query, snapshot => {
    if (!active) return;
    const list: T[] = snapshot.docs.map(doc => ({ ...(doc.data() as object), id: doc.id } as T));
    setter(list);
  }, error => {
    console.error(`Error attaching listener:`, error);
  });
  return () => { active = false; unsubscribe(); };
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

const getRoleUserType = (role?: Role): 'admin' | 'seller' | 'developer' => {
  if (!role) return 'seller';
  const normalizedName = (role.name || '').toLowerCase().trim();
  if (
    role.userType === 'developer' ||
    normalizedName === 'developer' ||
    normalizedName === 'desarrollador'
  ) return 'developer';
  if (
    role.userType === 'admin' ||
    normalizedName === 'administrator' ||
    normalizedName === 'administrador' ||
    role.permissions?.includes(View.ROLE_MANAGER) ||
    role.permissions?.includes(View.CEO_CENTER)
  ) return 'admin';
  return 'seller';
};

const App: React.FC = () => {
  const [giftVouchers, setGiftVouchers] = useState<GiftVoucher[]>([]);
  const [currentView, setCurrentView] = useState<View>(View.DASHBOARD);
  useEffect(() => { window.scrollTo({ top: 0, left: 0, behavior: 'instant' }); }, [currentView]);
  const [inventory, setInventory] = useState<Product[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [layaways, setLayaways] = useState<Layaway[]>([]);
  const [stockTakes, setStockTakes] = useState<StockTake[]>([]);
  const [dailyNotes, setDailyNotes] = useState<DailyNote[]>([]);
  const [ceoNotes, setCeoNotes] = useState<CeoDailyNote[]>([]);
  const [loginHistory, setLoginHistory] = useState<LoginRecord[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [productHistory, setProductHistory] = useState<ProductHistoryLog[]>([]);
  const [payrollHistory, setPayrollHistory] = useState<PayrollRecord[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [expenseCategories, setExpenseCategories] = useState<ExpenseCategory[]>([]);
  const [categoryState, setCategoryState] = useState<{ companyId: string; items: Category[] }>({ companyId: '', items: [] });
  const categoryRepairs = useRef(new Set<string>());
  const [sellers, setSellers] = useState<Seller[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [activeCompanyId, setActiveCompanyId] = useState<string>(localStorage.getItem('activeCompanyId') || DEFAULT_COMPANY_ID);
  const [allSales, setAllSales] = useState<Sale[]>([]);
  const [allLayaways, setAllLayaways] = useState<Layaway[]>([]);
  const [allIncidents, setAllIncidents] = useState<Incident[]>([]);
  const [activeCart, setActiveCart] = useState<CartItem[]>([]);
  const [heldCarts, setHeldCarts] = useState<HeldCart[]>([]);
  const [inventoryTransfers, setInventoryTransfers] = useState<InventoryTransfer[]>([]);
  const [currentUser, setCurrentUser] = useState<Seller | null>(null);
  const [developerGrant, setDeveloperGrant] = useState<PlatformDeveloperGrant | null>(null);
  const [developerGrants, setDeveloperGrants] = useState<PlatformDeveloperGrant[]>([]);
  const [currentStoreId, setCurrentStoreId] = useState<string | null>(localStorage.getItem('currentStoreId'));
  const currentStoreIdRef = useRef<string | null>(currentStoreId);
  const inventoryByStoreRef = useRef<Map<string, Product[]>>(new Map());
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
  const [isVerificationInventoryLoading, setIsVerificationInventoryLoading] = useState(false);
  const [verificationInventoryError, setVerificationInventoryError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [ceoActivationScope, setCeoActivationScope] = useState('');
  const [ceoSelectedStoreId, setCeoSelectedStoreId] = useState<string>('all');
  const [ceoSales, setCeoSales] = useState<Sale[]>([]);
  const [ceoLayaways, setCeoLayaways] = useState<Layaway[]>([]);
  const [ceoPurchases, setCeoPurchases] = useState<Purchase[]>([]);
  const [ceoExpenses, setCeoExpenses] = useState<Expense[]>([]);
  const [isCeoCenterActivated, setIsCeoCenterActivated] = useState(false);
  
  const [hasShownBriefing, setHasShownBriefing] = useState(false);
  const [isBriefingModalOpen, setIsBriefingModalOpen] = useState(false);
  const [isInstallModalOpen, setIsInstallModalOpen] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      // Prevent standard browser bar from displaying
      e.preventDefault();
      // Store the event so it can be triggered later
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const [loadFullPurchases, setLoadFullPurchases] = useState(false);

  const [accountingChatScope, setAccountingChatScope] = useState('');
  const [accountingChatHistory, setAccountingChatHistory] = useState<any[]>([]);
  const [financialRecords, setFinancialRecords] = useState<FinancialRecord[]>([]);
  const [loans, setLoans] = useState<Loan[]>([]);

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

  const isOwner = isPlatformOwner(currentUser);
  const isDeveloper = hasPlatformDeveloperAccess(currentUser, developerGrant);
  // Identity stays attached to the signed-in user; operational context can only
  // be changed across companies by an authorized platform developer.
  const operationalCompanyId = isDeveloper
    ? activeCompanyId || DEFAULT_COMPANY_ID
    : currentUser?.companyId || stores.find(store => store.id === currentUser?.storeId)?.companyId || DEFAULT_COMPANY_ID;

  const selectStore = (id: string | null) => {
    currentStoreIdRef.current = id;
    setInventory(id ? inventoryByStoreRef.current.get(id) || [] : []);
    setCurrentStoreId(id);
    if (id) localStorage.setItem('currentStoreId', id);
    else localStorage.removeItem('currentStoreId');
  };

  const handleSwitchStore = (id: string) => {
    if (!currentUser || !stores.some(store => store.id === id && (store.companyId || DEFAULT_COMPANY_ID) === operationalCompanyId)) return;
    if (id === currentStoreIdRef.current) return;
    // Never leave the previous store's products visible. Administrators already
    // keep each authorized store inventory in memory, so revisiting a store is instant.
    selectStore(id);
  };

  const handleConnectCompany = (id: string) => {
    if (!isDeveloper || !companies.some(company => company.id === id)) return;
    const companyStores = stores.filter(store => (store.companyId || DEFAULT_COMPANY_ID) === id);
    const storeId = companyStores.find(store => store.id === currentStoreIdRef.current)?.id || companyStores[0]?.id || null;
    if (id !== operationalCompanyId) inventoryByStoreRef.current.clear();
    setActiveCompanyId(id);
    localStorage.setItem('activeCompanyId', id);
    selectStore(storeId);
  };
  
  const currentStore = useMemo(() => {
    const store = stores.find(s => s.id === currentStoreId && (s.companyId || DEFAULT_COMPANY_ID) === operationalCompanyId);
    const company = companies.find(c => c.id === operationalCompanyId);

    const primaryColor = store?.accentColor || company?.primaryColor || '#ff007f';
    const primaryHover = store?.accentColorHover || company?.primaryColorHover || '#d9006c';
    const secondaryColor = store?.secondaryColor || store?.accentColorHover || company?.secondaryColor || '#8b5cf6';

    const rgb = hexToRgb(primaryColor);
    if (rgb) document.documentElement.style.setProperty('--color-accent', `${rgb.r} ${rgb.g} ${rgb.b}`);
    const hoverRgb = hexToRgb(primaryHover);
    if (hoverRgb) document.documentElement.style.setProperty('--color-accent-hover', `${hoverRgb.r} ${hoverRgb.g} ${hoverRgb.b}`);
    const secRgb = hexToRgb(secondaryColor);
    if (secRgb) document.documentElement.style.setProperty('--color-accent-secondary', `${secRgb.r} ${secRgb.g} ${secRgb.b}`);

    return store;
  }, [currentStoreId, stores, companies, operationalCompanyId]);

  const currentCompany = useMemo(() => {
    if (!currentUser) return null;
    return companies.find(c => c.id === operationalCompanyId) || null;
  }, [currentUser, operationalCompanyId, companies]);

  const isAdmin = useMemo(() => {
      if (!currentUser || !roles.length) return false;
      return getRoleUserType(resolveTenantRole(currentUser, roles, stores)) === 'admin';
  }, [currentUser, roles, stores]);

  useEffect(() => {
    setDeveloperGrant(null);
    if (!isAuthReady || !currentUser || isOwner) return;
    let active = true;
    const unsubscribe = onSnapshot(nativeDoc(db, 'platformDevelopers', currentUser.id), snapshot => {
      if (active) setDeveloperGrant(snapshot.exists() ? snapshot.data() as PlatformDeveloperGrant : null);
    }, () => { if (active) setDeveloperGrant(null); });
    return () => { active = false; unsubscribe(); };
  }, [isAuthReady, currentUser?.id, isOwner]);
  useEffect(() => {
    setDeveloperGrants([]);
    if (!isAuthReady || !isOwner || currentView !== View.DEVELOPER_CENTER) return;
    let active = true;
    const unsubscribe = onSnapshot(collection(db, 'platformDevelopers'), snapshot => {
      if (active) setDeveloperGrants(snapshot.docs.map(document => document.data() as PlatformDeveloperGrant).filter(grant => grant.grantedBy === PLATFORM_OWNER_USER_ID));
    });
    return () => { active = false; unsubscribe(); };
  }, [isAuthReady, isOwner, currentView]);

  // Multi-company isolation: every operational view is scoped to exactly one company.
  // Developers can switch the operational context from Developer Center, but only
  // Developer Center itself receives the global companies/stores/users collections.
  const categories = useMemo(() => selectCompanyCategories(categoryState, operationalCompanyId), [categoryState, operationalCompanyId]);

  const visibleStores = useMemo(() => {
    return stores.filter(s => (s.companyId || DEFAULT_COMPANY_ID) === operationalCompanyId);
  }, [stores, operationalCompanyId]);

  const visibleStoreIds = useMemo(() => {
    return new Set(visibleStores.map(s => s.id));
  }, [visibleStores]);

  const isOperationalView = currentView !== View.DEVELOPER_CENTER;
  const companyStoreKey = JSON.stringify([...visibleStoreIds].sort());
  const dataScope = `${currentUser?.id || ''}:${operationalCompanyId}`;
  const operationContext = operationContextKey(currentUser?.id, operationalCompanyId, currentStoreId);
  const [settledDataContext, setSettledDataContext] = useState(operationContext);
  const dataContextReady = settledDataContext === operationContext;
  const overlayScope = `${operationContext}:${currentView}`;
  const [settledOverlayScope, setSettledOverlayScope] = useState(overlayScope);
  useEffect(() => {
    setIsReportsModalOpen(false); setIsVerificationModalOpen(false); setIsBriefingModalOpen(false);
    setShowReceiptModal(false); setSaleForReceipt(null); setShowRecaudoReceipt(false); setLastRecaudo(null);
    setVerificationInventoryError(null); setIsVerificationInventoryLoading(false);
    setSettledOverlayScope(overlayScope);
  }, [overlayScope]);
  const operationContextRef = useRef({ key: operationContext, version: 0 });
  if (operationContextRef.current.key !== operationContext) operationContextRef.current = { key: operationContext, version: operationContextRef.current.version + 1 };
  const contextAtRender = operationContextRef.current;
  useEffect(() => {
    setLastRecaudo(null); setShowRecaudoReceipt(false);
    setActiveCart([]); setVerifiedProducts(new Set()); setSaleForReceipt(null); setShowReceiptModal(false);
    setSales([]); setPurchases([]); setLayaways([]); setStockTakes([]);
    setDailyNotes([]); setLoginHistory([]); setProductHistory([]);
    setPayrollHistory([]); setCustomers([]); setHeldCarts([]); setExpenses([]);
    setIncidents([]); setGiftVouchers([]); setFinancialRecords([]); setLoans([]); setExpenseCategories([]); setAccountingChatHistory([]);
    setSettledDataContext(operationContext);
  }, [currentStoreId, dataScope]);
  useEffect(() => {
    inventoryByStoreRef.current.clear();
    setInventory([]); setInventoryTransfers([]); setCeoNotes([]);
    setCeoSales([]); setCeoLayaways([]); setCeoPurchases([]); setCeoExpenses([]);
    setIsCeoCenterActivated(false); setCeoSelectedStoreId('all'); setIsReportsModalOpen(false);
    setAllSales([]); setAllLayaways([]); setAllIncidents([]); setGlobalInventoryForSearch([]);
  }, [dataScope, companyStoreKey]);
  const tenantWriter = useMemo(() => createTenantWriter(db, { companyId: operationalCompanyId, storeIds: visibleStoreIds }), [operationalCompanyId, visibleStoreIds]);
  const { setDoc, updateDoc, deleteDoc, addDoc, runTransaction } = tenantWriter;
  const doc = ((...args: any[]) => { const ref = (nativeDoc as any)(...args); if (args.length === 1) tenantWriter.registerNew(ref); return ref; }) as typeof nativeDoc;
  const writeBatch = (_?: any) => tenantWriter.writeBatch();

  const visibleRoles = useMemo(() => roles.filter(role => (role.companyId || DEFAULT_COMPANY_ID) === operationalCompanyId && !isPlatformRole(role)).map(role => ({ ...role, permissions: role.permissions.filter(view => view !== View.DEVELOPER_CENTER) })), [roles, operationalCompanyId]);
  const roleRepairs = useRef(new Set<string>());
  const isolateSellerRole = async (seller: Seller) => {
    const companyId = seller.companyId || stores.find(store => store.id === seller.storeId)?.companyId || DEFAULT_COMPANY_ID;
    const roleId = await ensureCompanyRole(db, seller.roleId, companyId);
    if (roleId === seller.roleId) return;
    const scope = { companyId, storeIds: new Set<string>(stores.filter(store => (store.companyId || DEFAULT_COMPANY_ID) === companyId).map(store => store.id)) };
    await createTenantWriter(db, scope).updateDoc(doc(db, 'sellers', seller.id), { roleId, companyId });
  };
  useEffect(() => {
    if (!currentUser || !isAppReady) return;
    sellers.forEach(seller => {
      const companyId = seller.companyId || stores.find(store => store.id === seller.storeId)?.companyId || DEFAULT_COMPANY_ID;
      const role = roles.find(item => item.id === seller.roleId);
      if (companyId !== operationalCompanyId || !role || isPlatformRole(role) || companyId === DEFAULT_COMPANY_ID || (role.companyId || DEFAULT_COMPANY_ID) !== DEFAULT_COMPANY_ID || roleRepairs.current.has(seller.id)) return;
      roleRepairs.current.add(seller.id);
      isolateSellerRole(seller).catch(error => console.error('Error isolating user role:', error)).finally(() => roleRepairs.current.delete(seller.id));
    });
  }, [currentUser?.id, isAppReady, sellers, stores, roles, operationalCompanyId]);
  useEffect(() => {
    if (!currentUser) return;
    const seller = sellers.find(item => item.id === currentUser.id);
    const store = stores.find(item => item.id === seller?.storeId);
    const sellerCompanyId = seller?.companyId || store?.companyId || DEFAULT_COMPANY_ID;
    if (seller && (seller.isDisabled || seller.storeId !== currentUser.storeId || sellerCompanyId !== currentUser.companyId)) {
      handleLogout();
      return;
    }
    if (seller && seller.roleId !== currentUser.roleId) setCurrentUser(user => user ? { ...user, roleId: seller.roleId } : user);
  }, [sellers, stores, currentUser?.id, currentUser?.roleId, currentUser?.storeId, currentUser?.companyId]);

  const visibleSellers = useMemo(() => sellers.filter(seller => {
    try { assertTenantData('sellers', seller, { companyId: operationalCompanyId, storeIds: visibleStoreIds }); return true; } catch { return false; }
  }), [sellers, operationalCompanyId, visibleStoreIds]);

  // If a developer changes company context, never leave an operational store from
  // another company selected. This prevents store-specific listeners from reading
  // data belonging to the previous company.
  useEffect(() => {
    if (!currentUser) return;
    if (currentStoreId && visibleStoreIds.has(currentStoreId)) return;
    const nextStoreId = isDeveloper ? visibleStores[0]?.id || null : visibleStoreIds.has(currentUser.storeId) ? currentUser.storeId : null;
    if (currentStoreId !== nextStoreId) selectStore(nextStoreId);
  }, [currentUser?.id, currentUser?.storeId, isDeveloper, currentStoreId, companyStoreKey]);

  const userPermissions = useMemo(() => tenantPermissions(currentUser, roles, stores, isDeveloper ? undefined : currentCompany?.allowedViews), [currentUser, roles, stores, isDeveloper, currentCompany]);
  const recordReadOnly = !isDeveloper && !tenantOperationPermissions(currentUser, roles, stores, currentCompany?.allowedViews).includes(currentView);
  const canAccessCurrentView = isDeveloper || userPermissions.includes(currentView);

  // Enforce role permissions at the view level, not only in navigation.
  // This prevents login/default/stale views from exposing modules the role cannot access.
  useEffect(() => {
    if (!currentUser || isDeveloper || roles.length === 0) return;

    if (userPermissions.includes(currentView)) return;

    const fallbackView =
      (userPermissions.includes(View.POS) && View.POS) ||
      (userPermissions.includes(View.DASHBOARD) && View.DASHBOARD) ||
      userPermissions[0];

    if (!fallbackView && currentView === View.DEVELOPER_CENTER) setCurrentView(View.POS);
    if (fallbackView) {
      setCurrentView(fallbackView as View);
    }
  }, [currentView, currentUser, isDeveloper, roles.length, userPermissions]);

  const isVendedor = useMemo(() => {
      if (!currentUser || !roles.length) return false;
      const userRole = resolveTenantRole(currentUser, roles, stores);
      if (!userRole || !userRole.name) return false;
      const name = userRole.name.toLowerCase();
      return name === 'vendedor' || name === 'vendedores';
  }, [currentUser, roles, stores]);
  
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
  
  // Login must not wait for tenant data, database seeding or collection listeners.
  useEffect(() => {
    if (isAuthReady) setIsAppReady(true);
  }, [isAuthReady]);

  useEffect(() => {
    if (!isAppReady || !isAuthReady || !currentUser) return;
    const unsubscribers = [
      attachFirestoreListener(query(collection(db, 'stores')), setStores),
      attachFirestoreListener(query(collection(db, 'roles')), setRoles),
      attachFirestoreListener(query(collection(db, 'companies')), setCompanies),
    ];
    return () => unsubscribers.forEach(unsub => unsub());
  }, [isAppReady, isAuthReady, !!currentUser]);

  useEffect(() => {
    if (!isOperationalView || !isAppReady || !isAuthReady || !currentUser) return;
    let active = true;
    const rows = new Map<string, CeoDailyNote[]>();
    const queries = operationalCompanyId === DEFAULT_COMPANY_ID
      ? [...visibleStoreIds].map(id => query(collection(db, 'daily_notes'), where('tienda', '==', id)))
      : [query(collection(db, 'daily_notes'), where('companyId', '==', operationalCompanyId))];
    if (operationalCompanyId === DEFAULT_COMPANY_ID) queries.push(query(collection(db, 'daily_notes'), where('tienda', '==', 'all')));
    const unsubscribers = queries.map((q, index) => onSnapshot(q, snapshot => {
      if (!active) return;
      rows.set(String(index), snapshot.docs.map(document => ({ ...document.data(), id: document.id } as CeoDailyNote)).filter(note => { try { assertTenantData('daily_notes', note, { companyId: operationalCompanyId, storeIds: visibleStoreIds }); return true; } catch { return false; } }));
      setCeoNotes([...new Map([...rows.values()].flat().map(note => [note.id, note])).values()]);
    }));
    return () => { active = false; unsubscribers.forEach(unsubscribe => unsubscribe()); };
  }, [isOperationalView, isAppReady, isAuthReady, currentUser?.id, operationalCompanyId, companyStoreKey]);

  useEffect(() => {
    if (!isAppReady || !isAuthReady || !currentUser) return;
    const unsubscribers = [
      attachFirestoreListener(query(collection(db, 'sellers')), setSellers)
    ];
    return () => unsubscribers.forEach(unsub => unsub());
  }, [currentUser?.id, isAppReady, isAuthReady]);
  
  useEffect(() => {
    if (!isOperationalView || !isAppReady || !isAuthReady || !currentUser) return;
    const companyId = operationalCompanyId;
    // The original company also retains its historical untagged categories.
    const categoryQuery = companyId === DEFAULT_COMPANY_ID
      ? query(collection(db, 'categories'))
      : query(collection(db, 'categories'), where('companyId', '==', companyId));
    let active = true;
    const unsubscribe = onSnapshot(categoryQuery, snapshot => {
      if (!active) return;
      const items = snapshot.docs.map(document => ({ ...document.data(), id: document.id } as Category));
      setCategoryState({ companyId, items: items.filter(category => belongsToCompany(category, companyId)) });
    }, error => {
      if (!active) return;
      console.error('Error loading company categories:', error);
      setCategoryState({ companyId, items: [] });
    });
    return () => { active = false; unsubscribe(); };
  }, [isOperationalView, isAppReady, isAuthReady, currentUser?.id, operationalCompanyId]);

  useEffect(() => {
    if (!isOperationalView || !isAppReady || !isAuthReady || !currentUser) return;
    let active = true;
    const ids = [...visibleStoreIds];
    const rows = new Map<string, InventoryTransfer[]>();
    const unsubscribers = ids.map(id => onSnapshot(query(collection(db, 'inventoryTransfers'), where('fromStoreId', '==', id)), snapshot => {
      if (!active) return;
      rows.set(id, snapshot.docs.map(document => ({ ...document.data(), id: document.id } as InventoryTransfer)));
      setInventoryTransfers(ids.flatMap(store => rows.get(store) || []).filter(transfer => {
        try { assertTenantData('inventoryTransfers', transfer, { companyId: operationalCompanyId, storeIds: visibleStoreIds }); return true; } catch { return false; }
      }));
    }));
    return () => { active = false; unsubscribers.forEach(unsubscribe => unsubscribe()); };
  }, [isOperationalView, isAppReady, isAuthReady, currentUser?.id, operationalCompanyId, companyStoreKey]);

  useEffect(() => {
    if (!isOperationalView || !isAdmin || !currentUser) return;

    let active = true;
    const storeIds: string[] = JSON.parse(companyStoreKey);
    const unsubscribers = storeIds.map(storeId => {
      const inventoryQuery = query(collection(db, 'inventory'), where('storeId', '==', storeId));
      return onSnapshot(inventoryQuery, snapshot => {
        if (!active) return;
        const storeInventory = snapshot.docs.map(document => ({ ...document.data(), id: document.id } as Product)).filter(isOwnInventory);
        inventoryByStoreRef.current.set(storeId, storeInventory);

        // This single session cache serves Dashboard, multisite search and POS.
        // Switching stores therefore does not reconnect and reread the same catalog.
        setGlobalInventoryForSearch(storeIds.flatMap(id => inventoryByStoreRef.current.get(id) || []));
        if (currentStoreIdRef.current === storeId) setInventory(storeInventory);
      }, error => console.error(`Error loading inventory for store ${storeId}:`, error));
    });

    return () => { active = false; unsubscribers.forEach(unsubscribe => unsubscribe()); };
  }, [isOperationalView, isAdmin, currentUser?.id, companyStoreKey, dataScope]);


  const liveAnalytics = !!currentUser && isAdmin && (isReportsModalOpen || currentView === View.DASHBOARD || currentView === View.FINANCIAL_RECONCILIATION);
  const companyStoreIds = [...visibleStoreIds];
  useCompanyCollection('sales', companyStoreIds, dataScope, liveAnalytics, setAllSales);
  useCompanyCollection('layaways', companyStoreIds, dataScope, liveAnalytics, setAllLayaways);
  useCompanyCollection('incidents', companyStoreIds, dataScope, liveAnalytics, setAllIncidents);
  const liveCeo = isAppReady && isAuthReady && !!currentUser && currentView === View.CEO_CENTER && isCeoCenterActivated && ceoActivationScope === dataScope;
  const ceoStoreIds = ceoSelectedStoreId === 'all' ? companyStoreIds : companyStoreIds.filter(id => id === ceoSelectedStoreId);
  useCompanyCollection('sales', ceoStoreIds, dataScope, liveCeo, setCeoSales);
  useCompanyCollection('layaways', ceoStoreIds, dataScope, liveCeo, setCeoLayaways);
  useCompanyCollection('purchases', ceoStoreIds, dataScope, liveCeo, setCeoPurchases);
  useCompanyCollection('expenses', ceoStoreIds, dataScope, liveCeo, setCeoExpenses);

  useEffect(() => {
    if (!isGlobalMode || !isAppReady || !currentUser) {
        if (globalInventoryForSearch.length > 0 && !isAdmin) setGlobalInventoryForSearch([]);
        return;
    }
    // Multisede inventory is cached by the on-demand loader above. Store inventory
    // continues real-time in the active operational view, avoiding a second global listener.
  }, [isGlobalMode, isAppReady, currentUser, isAdmin, globalInventoryForSearch.length]);
  
  useEffect(() => {
    if (!isOperationalView || !currentUser || !currentStoreId || !visibleStoreIds.has(currentStoreId)) return;
    return subscribeStoreRows('incidents', currentStoreId, dataScope, rows => setIncidents(rows.filter(row => {
      try { assertTenantData('incidents', row, { companyId: operationalCompanyId, storeIds: visibleStoreIds }); return true; }
      catch { return false; }
    })));
  }, [isOperationalView, currentUser?.id, currentStoreId, dataScope, companyStoreKey]);

  const hasDataAccess = !!currentUser && canAccessCurrentView;
  const canLoadStore = isOperationalView && isAppReady && isAuthReady && hasDataAccess && !!currentStoreId && visibleStoreIds.has(currentStoreId);


  // The verification dialog also needs inventory when opened outside a catalog view.
  // Read the selected store afresh and ignore responses after a store/company change.
  useEffect(() => {
    if (!isVerificationModalOpen) return;
    let active = true;
    setVerificationInventoryError(null);
    setIsVerificationInventoryLoading(true);
    if (!canLoadStore || !currentStoreId) {
      setVerificationInventoryError('Selecciona una sede con acceso antes de verificar inventario.');
      setIsVerificationInventoryLoading(false);
      return;
    }
    getDocs(query(collection(db, 'inventory'), where('storeId', '==', currentStoreId)))
      .then(snapshot => {
        if (!active) return;
        const items = snapshot.docs.map(document => ({ ...document.data(), id: document.id } as Product)).filter(isOwnInventory);
        inventoryByStoreRef.current.set(currentStoreId, items);
        setInventory(items);
      })
      .catch(error => {
        if (!active) return;
        console.error('Error loading verification inventory:', error);
        setVerificationInventoryError('No se pudo cargar el inventario. Cierra y vuelve a abrir para reintentar.');
      })
      .finally(() => { if (active) setIsVerificationInventoryLoading(false); });
    return () => { active = false; };
  }, [isVerificationModalOpen, canLoadStore, currentStoreId, dataScope]);

  useEffect(() => {
    if (!canLoadStore || !currentStoreId || operationalCompanyId === DEFAULT_COMPANY_ID || categoryState.companyId !== operationalCompanyId) return;
    const companyId = operationalCompanyId;
    const storeId = currentStoreId;
    const ownIds = new Set(categories.map(category => category.id));
    const foreignIds = [...new Set<string>(inventory.filter(product => product.storeId === storeId && product.categoryId && !ownIds.has(product.categoryId)).map(product => product.categoryId))];
    foreignIds.forEach(originalId => {
      const repairKey = `${companyId}:${storeId}:${originalId}`;
      if (categoryRepairs.current.has(repairKey)) return;
      categoryRepairs.current.add(repairKey);
      const productIds = inventory.filter(product => product.storeId === storeId && product.categoryId === originalId).map(product => product.id);
      const repair = () => isolateLegacyCategoryForStore(db, companyId, storeId, originalId, productIds);
      repair().catch(error => console.error('Error isolating legacy category:', error)).finally(() => categoryRepairs.current.delete(repairKey));
    });
  }, [canLoadStore, currentStoreId, operationalCompanyId, categoryState, inventory]);

  useStoreCollection('inventory', currentStoreId, dataScope, canLoadStore && !isAdmin && (isVerificationModalOpen || [View.DASHBOARD, View.POS, View.INVENTORY, View.INVENTORY_TRANSFER, View.LAYAWAY, View.PURCHASES, View.SETTINGS, View.INCIDENTS, View.ACCOUNTING, View.TAG_SCANNING].includes(currentView)), setInventory);
  useStoreCollection('sales', currentStoreId, dataScope, canLoadStore && [View.DASHBOARD, View.POS, View.INVENTORY, View.CUSTOMERS, View.PAYROLL, View.INCIDENTS, View.ACCOUNTING, View.FINANCIAL_RECONCILIATION].includes(currentView), setSales);
  useStoreCollection('purchases', currentStoreId, dataScope, canLoadStore && [View.DASHBOARD, View.POS, View.INVENTORY, View.PURCHASES, View.ACCOUNTING].includes(currentView), setPurchases);
  useStoreCollection('layaways', currentStoreId, dataScope, canLoadStore && [View.DASHBOARD, View.POS, View.INVENTORY, View.LAYAWAY, View.CUSTOMERS, View.PAYROLL, View.ACCOUNTING, View.FINANCIAL_RECONCILIATION].includes(currentView), setLayaways);
  useStoreCollection('giftVouchers', currentStoreId, dataScope, canLoadStore && [View.DASHBOARD, View.POS, View.GIFT_VOUCHERS].includes(currentView), setGiftVouchers);

  useEffect(() => {
    if (!canLoadStore || !currentStoreId) return;

    let active = true;
    const unsubscribers: (() => void)[] = [];
    const attach = <T extends { id: string }>(query: Query, setter: React.Dispatch<React.SetStateAction<T[]>>) => {
        unsubscribers.push(attachFirestoreListener(query, setter));
    };
    const attachStore = <T extends { id: string }>(name: string, setter: React.Dispatch<React.SetStateAction<T[]>>) => {
      unsubscribers.push(subscribeStoreRows(name, currentStoreId, dataScope, rows => setter(rows as T[])));
    };

    switch (currentView) {
        case View.DASHBOARD:
            attachStore('dailyNotes', setDailyNotes);
            attachStore('stockTakes', setStockTakes);
            break;
        case View.POS:
            // Shared live data stays connected while navigating operational screens.
            attachStore('customers', setCustomers);
            attachStore('heldCarts', setHeldCarts);
            break;
        case View.INVENTORY:
            attachStore('productHistory', setProductHistory);
            break;
        case View.CUSTOMERS:
            attachStore('customers', setCustomers);
            break;
        case View.STOCK_TAKE_HISTORY:
            attachStore('stockTakes', setStockTakes);
            break;
        case View.PAYROLL:
            attachStore('loginHistory', setLoginHistory);
            attachStore('payrollHistory', setPayrollHistory);
            break;
        case View.INCIDENTS:
            attachStore('customers', setCustomers);
            break;
        case View.ACCOUNTING:
            attachStore('expenses', setExpenses);
            attachStore('expenseCategories', setExpenseCategories);
            attachStore('payrollHistory', setPayrollHistory);
            attachStore('financialRecords', setFinancialRecords);
            attachStore('loans', setLoans);
            const chatRef = doc(db, 'accountingChatHistory', currentStoreId);
            unsubscribers.push(onSnapshot(chatRef, snapshot => {
              if (!active) return;
              setAccountingChatScope(`${dataScope}:${currentStoreId}`);
              const data = snapshot.exists() ? snapshot.data() : null;
              try {
                if (!data) { setAccountingChatHistory([]); return; }
                assertTenantData('accountingChatHistory', data, { companyId: operationalCompanyId, storeIds: new Set([currentStoreId]) });
                setAccountingChatHistory(Array.isArray(data.messages) ? data.messages : []);
              } catch { setAccountingChatHistory([]); }
            }));
            break;
        case View.FINANCIAL_RECONCILIATION:
            attachStore('expenses', setExpenses);
            break;
    }
    return () => { active = false; unsubscribers.forEach(unsub => unsub()); };
  }, [canLoadStore, currentStoreId, currentView, dataScope]);
  useEffect(() => {
    if (currentUser && !hasShownBriefing && dataContextReady && currentView !== View.DEVELOPER_CENTER) {
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
  }, [currentUser, incidents, layaways, hasShownBriefing, isAdmin, dataContextReady, currentView]);

  useEffect(() => {
    if (!isAppReady || stores.length === 0) return;
    const runColorMigration = async () => {
      const batch = writeBatch(db);
      let needsUpdate = false;
      visibleStores.forEach(store => {
          if (operationalCompanyId === DEFAULT_COMPANY_ID && !store.accentColorsUpdated) {
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
    if (currentView === View.ACCOUNTING && canLoadStore && expenseCategories.length === 0 && currentStoreId) {
        const startedContext = operationContextRef.current;
        const checkAndInitCategories = async () => {
            const q = query(collection(db, 'expenseCategories'), where('storeId', '==', currentStoreId));
            const snap = await getDocs(q);
            if (operationContextRef.current !== startedContext) return;
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
  }, [currentView, expenseCategories.length, currentStoreId, canLoadStore, dataScope]);

  useEffect(() => {
    if (theme === 'dark') document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
    localStorage.setItem('theme', theme);
  }, [theme]);
  
  const getStoreName = (storeId: string) => stores.find(s => s.id === storeId)?.name || 'Tienda Desconocida';

  const toggleTheme = () => setTheme(prevTheme => (prevTheme === 'dark' ? 'light' : 'dark'));

  const createProductHistoryLog = (product: { id: string; name: string; storeId: string; [key: string]: any }, changedBy: string, changeType: ProductChangeType, details: string): ProductHistoryLog => {
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

  const handleProcessSale = async (saleData: { payments: Payment[]; customerName: string; customerPhone: string; seller: string; items?: CartItem[]; discountPercent?: number; discountAmount?: number; paymentSurchargeAmount?: number; }, saleDate: Date) => {
    if (!currentStore || !currentStoreId || !currentUser) return;
    const startedContext = operationContextRef.current;

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
            const subtotal = itemsToProcess.reduce((sum, item) => sum + item.price * item.quantity, 0);
            const discountPercent = saleData.discountPercent || 0;
            const discountAmount = saleData.discountAmount || (discountPercent > 0 ? Math.round(subtotal * (discountPercent / 100)) : 0);
            const paymentSurchargeAmount = saleData.paymentSurchargeAmount || 0;
            const totalAmount = subtotal - discountAmount + paymentSurchargeAmount;

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
                companyId: operationalCompanyId,
                discountPercent,
                discountAmount,
                paymentSurchargeAmount,
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

                    const isPromo = (item.discountPrice !== undefined && item.discountPrice === item.price) || (item.basePrice !== undefined && item.basePrice > item.price);
                    const logRef = doc(collection(db, 'productHistory'));
                    const log: ProductHistoryLog = {
                        id: logRef.id,
                        productId: item.id,
                        productName: item.name,
                        storeId: currentStoreId,
                        changedBy: saleData.seller,
                        timestamp: saleDate.toISOString(),
                        changeType: ProductChangeType.SALE,
                        details: `Venta #${currentInvoiceNumber}. Cantidad: -${item.quantity}. Precio Venta: ${formatCOP(item.price)}${isPromo ? ' (Precio Promoción)' : ''}`
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
                    const firstPaymentMethod = saleData.payments && saleData.payments[0] ? saleData.payments[0].method : undefined;
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
                        paymentMethod: firstPaymentMethod,
                    });
                }
            }
        });

        if (savedSale && operationContextRef.current === startedContext) {
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
    const startedContext = operationContextRef.current;
    const cartRef = doc(collection(db, 'heldCarts'));
    const heldCart: HeldCart = {
        id: cartRef.id,
        items: activeCart,
        storeId: currentStoreId,
        companyId: operationalCompanyId,
        customerName: data?.customer?.name ?? null,
        customerPhone: data?.customer?.phone ?? null,
        sellerName: data?.sellerName ?? null,
    };
    await setDoc(cartRef, heldCart);
    if (operationContextRef.current === startedContext) handleClearCart();
  };

  const handleResumeSale = async (heldCartId: string) => {
    const cart = heldCarts.find(c => c.id === heldCartId);
    if (cart) {
        const startedContext = operationContextRef.current;
        await deleteDoc(doc(db, 'heldCarts', heldCartId));
        if (operationContextRef.current === startedContext) setActiveCart(cart.items);
    }
  };

  const handleCreateLayaway = async (customerName: string, customerPhone: string, invoiceNumber: string, seller: string, initialPayment: { amount: number; method: PaymentMethod; }, saleDate: Date, isPreOrder: boolean, description?: string) => {
    if (!currentStoreId) return;
    const startedContext = operationContextRef.current;

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
                companyId: operationalCompanyId,
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

        if (operationContextRef.current === startedContext) handleClearCart();
    } catch (e) {
        console.error("Layaway transaction failed:", e);
        alert("Error al crear abono. Intente nuevamente.");
    }
  };

  const handleAddPaymentToLayaway = async (layawayId: string, amount: number, method: PaymentMethod, seller: string) => {
    const layaway = layaways.find(l => l.id === layawayId);
    if (!layaway) return;
    const startedContext = operationContextRef.current;
    let completedTransactionReceipt: Sale | null = null;
    const newPayment: Payment = { date: new Date().toISOString(), amount, method, seller };
    const layawayRef = doc(db, 'layaways', layawayId);
    const newPaidAmount = layaway.paidAmount + amount;
    const updateData: any = { payments: arrayUnion(newPayment), paidAmount: increment(amount) };
    
    // Si el abono se salda por completo y estaba como pre-orden, descontamos inventario y registramos log de encargo recibido
    const isPreOrderCompleting = layaway.status === 'pre-order' && newPaidAmount >= layaway.totalAmount;

    if (newPaidAmount >= layaway.totalAmount && layaway.totalAmount > 0 && (layaway.status === 'active' || layaway.status === 'pre-order')) {
      updateData.status = 'completed';
      const fullPaymentsList = [...layaway.payments, newPayment];
      completedTransactionReceipt = {
          id: layaway.id,
          invoiceNumber: Number(layaway.invoiceNumber),
          customerName: layaway.customerName,
          customerPhone: layaway.customerPhone,
          items: layaway.items,
          totalAmount: layaway.totalAmount,
          payments: fullPaymentsList,
          seller: seller,
          createdAt: new Date().toISOString(),
          storeId: layaway.storeId,
          companyId: operationalCompanyId,
      };
    }

    if (isPreOrderCompleting) {
      await runTransaction(db, async (transaction) => {
        const docSnap = await transaction.get(layawayRef);
        if (!docSnap.exists()) return;
        const currentData = docSnap.data() as Layaway;
        if (currentData.status === 'pre-order') {
          currentData.items.forEach(item => {
            if (item && item.id) {
              const productRef = doc(db, 'inventory', item.id);
              transaction.update(productRef, { stock: increment(-item.quantity) });

              const logRef = doc(collection(db, 'productHistory'));
              const log: ProductHistoryLog = {
                id: logRef.id,
                productId: item.id,
                productName: item.name,
                storeId: layaway.storeId,
                changedBy: seller,
                timestamp: new Date().toISOString(),
                changeType: ProductChangeType.PRE_ORDER_FULFILLED,
                details: `Encargo #${layaway.invoiceNumber} entregado/completado por abono final. Cantidad: -${item.quantity}.`
              };
              transaction.set(logRef, log);
            }
          });
        }
        transaction.update(layawayRef, updateData);
      });
    } else {
      await updateDoc(layawayRef, updateData);
    }
    if (completedTransactionReceipt && operationContextRef.current === startedContext) {
      setSaleForReceipt(completedTransactionReceipt);
      setShowReceiptModal(true);
    }
  };

  const handleFulfillPreOrder = async (layawayId: string) => {
      try {
          await runTransaction(db, async (transaction) => {
              const layawayRef = doc(db, 'layaways', layawayId);
              const layawayDoc = await transaction.get(layawayRef);
              if (!layawayDoc.exists()) return;
              
              const layawayData = { id: layawayDoc.id, ...layawayDoc.data() } as Layaway;
              // Validación atómica: si ya no es 'pre-order' (por ejemplo, por doble clic o ejecución paralela), cancelamos la operación
              if (layawayData.status !== 'pre-order') return;

              layawayData.items.forEach(item => {
                  if (item && item.id) {
                      const productRef = doc(db, 'inventory', item.id);
                      transaction.update(productRef, { stock: increment(-item.quantity) });

                      const logRef = doc(collection(db, 'productHistory'));
                      const log: ProductHistoryLog = {
                          id: logRef.id,
                          productId: item.id,
                          productName: item.name,
                          storeId: layawayData.storeId,
                          changedBy: currentUser?.name || 'Sistema',
                          timestamp: new Date().toISOString(),
                          changeType: ProductChangeType.PRE_ORDER_FULFILLED,
                          details: `Encargo #${layawayData.invoiceNumber} recibido. Cantidad: -${item.quantity}.`
                      };
                      transaction.set(logRef, log);
                  }
              });

              transaction.update(layawayRef, { status: 'active' });
          });
      } catch (error) {
          console.error("Error al marcar encargo como recibido:", error);
          alert("Error al procesar el encargo. Intente nuevamente.");
      }
  };

  const handleInventoryTransfer = async (data: { fromStoreId: string; toStoreId: string; productId: string; quantity: number; sellerName: string; }, existingBatch?: WriteBatch) => {
    if (!currentUser) return;
    const batch = existingBatch || writeBatch(db);
    try {
      const { fromStoreId, toStoreId, productId, quantity, sellerName } = data;
      if (!visibleStoreIds.has(fromStoreId) || !visibleStoreIds.has(toStoreId)) {
        throw new Error('Traslado bloqueado: origen y destino deben pertenecer a la empresa activa.');
      }
      const fromProductRef = doc(db, 'inventory', productId);
      const fromProductDoc = await getDoc(fromProductRef);
      if (!fromProductDoc.exists()) throw new Error("Producto no encontrado en la tienda de origen.");
      const fromProduct = { id: fromProductDoc.id, ...fromProductDoc.data() } as Product;
      if (!isOwnInventory(fromProduct) || fromProduct.storeId !== fromStoreId) throw new Error('El producto no pertenece a la sede de origen.');
      if (!Number.isFinite(quantity) || quantity <= 0) throw new Error('La cantidad debe ser positiva.');
      if (fromProduct.stock < quantity) throw new Error("Stock insuficiente.");
      const toProductQuery = query(collection(db, 'inventory'), where('name', '==', fromProduct.name), where('storeId', '==', toStoreId), limit(1));
      const toProductSnapshot = await getDocs(toProductQuery);
      if (toProductSnapshot.empty) throw new Error(`Producto "${fromProduct.name}" debe existir en la tienda de destino antes de hacer el traslado.`);
      const toProductDoc = toProductSnapshot.docs[0];
      const toProduct = { id: toProductDoc.id, ...toProductDoc.data() } as Product;
      if (!isOwnInventory(toProduct) || toProduct.storeId !== toStoreId) throw new Error('Producto destino no autorizado.');
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

  const handleDeleteTransfer = async (transferId: string) => {
    if (!currentUser) return;
    const transfer = inventoryTransfers.find(t => t.id === transferId);
    if (!transfer) {
      alert("No se encontró el registro de traslado.");
      return;
    }

    const fromStoreName = getStoreName(transfer.fromStoreId);
    const toStoreName = getStoreName(transfer.toStoreId);

    const confirmMsg = `¿Estás seguro de que deseas anular y eliminar este traslado por error?\n\n` +
      `📦 Producto: ${transfer.productName}\n` +
      `🔢 Cantidad: ${transfer.quantity} unidad(es)\n\n` +
      `• Se devolverán +${transfer.quantity} unidad(es) a: ${fromStoreName}\n` +
      `• Se restarán -${transfer.quantity} unidad(es) de: ${toStoreName}\n\n` +
      `Esta acción restaurará el stock en ambas sedes y eliminará el registro de traslado.`;

    if (!window.confirm(confirmMsg)) return;

    try {
      const batch = writeBatch(db);

      // 1. Restaurar stock en Tienda Origen (fromStore)
      let fromProductRef = doc(db, 'inventory', transfer.productId);
      let fromProductDoc = await getDoc(fromProductRef);
      let fromProduct: Product | null = null;

      if (fromProductDoc.exists() && fromProductDoc.data().storeId === transfer.fromStoreId) {
        fromProduct = { id: fromProductDoc.id, ...fromProductDoc.data() } as Product;
      } else {
        const qFrom = query(
          collection(db, 'inventory'),
          where('name', '==', transfer.productName),
          where('storeId', '==', transfer.fromStoreId),
          limit(1)
        );
        const snapFrom = await getDocs(qFrom);
        if (!snapFrom.empty) {
          fromProductDoc = snapFrom.docs[0];
          fromProductRef = fromProductDoc.ref;
          fromProduct = { id: fromProductDoc.id, ...fromProductDoc.data() } as Product;
        }
      }

      if (fromProduct && fromProductRef && fromProductDoc.exists()) {
        batch.update(fromProductRef, { stock: increment(transfer.quantity) });
        const outLog = createProductHistoryLog(
          fromProduct || { id: fromProductRef.id, name: transfer.productName, storeId: transfer.fromStoreId, cost: transfer.productCost, price: 0, categoryId: '', stock: 0 },
          currentUser.name,
          ProductChangeType.TRANSFER_DELETED,
          `+${transfer.quantity} devueltas por anulación/reversión de traslado a ${toStoreName}`
        );
        batch.set(doc(db, 'productHistory', outLog.id), outLog);
      }

      // 2. Descontar stock en Tienda Destino (toStore)
      const qTo = query(
        collection(db, 'inventory'),
        where('name', '==', transfer.productName),
        where('storeId', '==', transfer.toStoreId),
        limit(1)
      );
      const snapTo = await getDocs(qTo);
      if (!snapTo.empty) {
        const toProductDoc = snapTo.docs[0];
        const toProduct = { id: toProductDoc.id, ...toProductDoc.data() } as Product;
        batch.update(toProductDoc.ref, { stock: increment(-transfer.quantity) });
        const inLog = createProductHistoryLog(
          toProduct,
          currentUser.name,
          ProductChangeType.TRANSFER_DELETED,
          `-${transfer.quantity} descontadas por anulación/reversión de traslado desde ${fromStoreName}`
        );
        batch.set(doc(db, 'productHistory', inLog.id), inLog);
      }

      // 3. Eliminar el documento de traslado
      batch.delete(doc(db, 'inventoryTransfers', transferId));

      // 4. Si existe una novedad asociada (IncidentType.INVENTORY_TRANSFER_REQUEST), también eliminarla
      const linkedIncidents = incidents.filter(i => 
        i.type === IncidentType.INVENTORY_TRANSFER_REQUEST &&
        i.fromStoreId === transfer.fromStoreId &&
        i.toStoreId === transfer.toStoreId &&
        (i.productName === transfer.productName || i.productId === transfer.productId)
      );
      linkedIncidents.forEach(inc => {
        batch.delete(doc(db, 'incidents', inc.id));
      });

      await batch.commit();
      alert('Traslado eliminado y stock revertido correctamente en ambas sedes.');
    } catch (error: any) {
      console.error("Error al anular y eliminar traslado:", error);
      alert(`Error al eliminar traslado: ${error.message}`);
    }
  };

  const handleResetBalances = async () => {
    if (!window.confirm("Esto marcará todos los traslados visibles como 'liquidados' y reiniciará los saldos. ¿Continuar?")) return;
    try {
        const batch = writeBatch(db);
        const unsettledTransfers = inventoryTransfers.filter(t => !t.settled && visibleStoreIds.has(t.fromStoreId) && visibleStoreIds.has(t.toStoreId));
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
    if (operationContextRef.current !== contextAtRender) throw new Error('La sede cambió. Vuelve a abrir la novedad.');
    const startedContext = operationContextRef.current;
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
        companyId: operationalCompanyId,
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
    }
    batch.set(newIncidentRef, cleanObject(newIncident));
    await batch.commit();
    if (operationContextRef.current === startedContext && newIncident.type === IncidentType.RECAUDO) { setLastRecaudo(newIncident); setShowRecaudoReceipt(true); }
  };

  const handleApproveIncident = async (incidentId: string) => {
    if (operationContextRef.current !== contextAtRender) throw new Error('La sede cambió. Vuelve a abrir la novedad.');
    if (!currentUser) return;
    const incident = incidents.find(i => i.id === incidentId);
    if (!incident) return;
    // Procesamiento único: leer el estado real antes de modificar stock.
    if (incident.type === IncidentType.DAMAGED || incident.type === IncidentType.PRODUCT_EXCHANGE) {
      try {
        await runTransaction(db, async transaction => {
          const incidentRef = doc(db, 'incidents', incidentId);
          const current = await transaction.get(incidentRef);
          if (!current.exists()) return;
          const latest = current.data() as Incident;
          if (!visibleStoreIds.includes(latest.storeId)) throw new Error('Novedad fuera de las sedes autorizadas.');
          const damage = latest.type === IncidentType.DAMAGED;
          const expected = damage ? IncidentStatus.DAÑADO_REPORTADO : IncidentStatus.CAMBIO_SOLICITADO;
          if (latest.status !== expected) return;
          const status = damage ? IncidentStatus.EN_ARREGLO_CAMBIO : IncidentStatus.CAMBIO_PROCESADO;
          const changes = damage
            ? [{ productId: latest.productId, productName: latest.productName || 'Producto', quantity: -1, type: ProductChangeType.DAMAGED }]
            : [
                ...(latest.returnedItems || []).map(item => ({ productId: item.productId, productName: item.productName, quantity: Number(item.quantity), type: ProductChangeType.EXCHANGE_IN })),
                ...(latest.takenItems || []).map(item => ({ productId: item.productId, productName: item.productName, quantity: -Number(item.quantity), type: ProductChangeType.EXCHANGE_OUT }))
              ];
          if (changes.some(change => !change.productId || !Number.isFinite(change.quantity) || change.quantity === 0)) throw new Error('Novedad con productos o cantidades inválidas.');
          const refs = [...new Set(changes.map(change => change.productId as string))].map(id => ({ id, ref: doc(db, 'inventory', id) }));
          const snapshots = await Promise.all(refs.map(async item => ({ id: item.id, snapshot: await transaction.get(item.ref), ref: item.ref })));
          for (const item of snapshots) {
            if (!item.snapshot.exists() || item.snapshot.data()?.storeId !== latest.storeId) throw new Error('Producto del cambio no encontrado en su sede.');
          }
          const saleRef = !damage && latest.originalSaleId ? doc(db, 'sales', latest.originalSaleId) : null;
          const saleSnapshot = saleRef ? await transaction.get(saleRef) : null;
          const timestamp = new Date().toISOString();
          for (const item of snapshots) {
            const related = changes.filter(change => change.productId === item.id);
            const delta = related.reduce((sum, change) => sum + change.quantity, 0);
            const before = Number(item.snapshot.data()?.stock || 0);
            if (delta) transaction.update(item.ref, { stock: before + delta });
            let running = before;
            for (const change of related) {
              const logRef = doc(collection(db, 'productHistory'));
              transaction.set(logRef, {
                id: logRef.id, productId: item.id, productName: change.productName,
                storeId: latest.storeId, changedBy: currentUser.name, timestamp,
                changeType: change.type, incidentId, stockBefore: running,
                stockAfter: running + change.quantity, quantityChange: change.quantity,
                details: `Novedad ${incidentId}. Stock: ${running} → ${running + change.quantity} (${change.quantity > 0 ? '+' : ''}${change.quantity})`
              });
              running += change.quantity;
            }
          }
          transaction.update(incidentRef, {
            status, resolutionDate: timestamp,
            history: [...(latest.history || []), { status, changedBy: currentUser.name, timestamp, notes: 'Novedad aprobada y procesada' }]
          });
          if (saleRef && saleSnapshot?.exists()) {
            const sale = saleSnapshot.data() as Sale;
            const updatedItems = (Array.isArray(sale.items) ? sale.items : Object.values(sale.items || {})).map(item => ({ ...item })) as CartItem[];
            for (const ret of latest.returnedItems || []) {
              const index = updatedItems.findIndex(item => item.id === ret.productId);
              if (index >= 0) {
                updatedItems[index].quantity -= ret.quantity;
                if (updatedItems[index].quantity <= 0) updatedItems.splice(index, 1);
              }
            }
            for (const taken of latest.takenItems || []) {
              const index = updatedItems.findIndex(item => item.id === taken.productId);
              if (index >= 0) updatedItems[index].quantity += taken.quantity;
              else updatedItems.push({
                id: taken.productId, name: taken.productName, sku: taken.sku || '',
                categoryId: taken.categoryId || '', price: taken.price, cost: taken.cost,
                quantity: taken.quantity, storeId: sale.storeId, description: 'Artículo por cambio', imageUrl: ''
              } as CartItem);
            }
            const subtotal = updatedItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
            const discount = sale.discountPercent ? Math.round(subtotal * sale.discountPercent / 100) : (sale.discountAmount || 0);
            transaction.update(saleRef, { items: updatedItems, totalAmount: subtotal - discount + (sale.paymentSurchargeAmount || 0), discountAmount: discount });
          }
        });
      } catch (error: any) {
        console.error('Error aprobando novedad con inventario:', error);
        alert(`No se pudo procesar la novedad: ${error.message}`);
      }
      return;
    }
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
    if (!currentUser) return;
    if (operationContextRef.current !== contextAtRender) throw new Error('La sede cambió. Vuelve a abrir la novedad.');
    const incidentRef = doc(db, 'incidents', incidentId);
    try {
      await runTransaction(db, async transaction => {
        const snapshot = await transaction.get(incidentRef);
        if (!snapshot.exists()) return;
        const incident = snapshot.data() as Incident;
        if (!visibleStoreIds.includes(incident.storeId)) throw new Error('La novedad no pertenece a una sede autorizada.');
        const isDamage = incident.type === IncidentType.DAMAGED && incident.status === IncidentStatus.EN_ARREGLO_CAMBIO;
        const isWarranty = incident.type === IncidentType.WARRANTY && incident.status === IncidentStatus.WARRANTY_ACTIVE;
        if (!isDamage && !isWarranty) return; // Ya resuelta: no sumar stock otra vez.
        const productRef = isDamage && incident.productId ? doc(db, 'inventory', incident.productId) : null;
        const productSnapshot = productRef ? await transaction.get(productRef) : null;
        if (productRef && (!productSnapshot?.exists() || productSnapshot.data()?.storeId !== incident.storeId)) throw new Error('Producto no encontrado en la sede de la novedad.');
        const timestamp = new Date().toISOString();
        const status = isDamage ? IncidentStatus.DEVUELTO_Y_RESUELTO : IncidentStatus.WARRANTY_RETURNED;
        if (productRef && productSnapshot) {
          const before = Number(productSnapshot.data()?.stock || 0);
          transaction.update(productRef, { stock: before + 1 });
          const logRef = doc(collection(db, 'productHistory'));
          transaction.set(logRef, {
            id: logRef.id, productId: incident.productId, productName: incident.productName || 'Producto',
            storeId: incident.storeId, changedBy: currentUser.name, timestamp,
            changeType: ProductChangeType.DAMAGED_RETURNED,
            incidentId, stockBefore: before, stockAfter: before + 1, quantityChange: 1,
            details: `Prenda dañada retornada de arreglo. Stock: ${before} → ${before + 1} (+1). Novedad: ${incidentId}`
          });
        }
        transaction.update(incidentRef, {
          status, resolutionDate: timestamp,
          history: [...(incident.history || []), { status, changedBy: currentUser.name, timestamp, notes: 'Novedad resuelta/finalizada' }]
        });
      });
    } catch (error: any) {
      console.error('Error resolviendo novedad:', error);
      alert(`No se pudo marcar el regreso: ${error.message}`);
    }
  };

  const handleUpdateIncident = async (incident: Incident) => {
    if (operationContextRef.current !== contextAtRender) throw new Error('La sede cambió. Vuelve a abrir la novedad.');
    const incidentRef = doc(db, 'incidents', incident.id);
    await runTransaction(db, async transaction => {
      const snapshot = await transaction.get(incidentRef);
      if (!snapshot.exists()) throw new Error('La novedad ya no existe.');
      const previous = snapshot.data() as Incident;
      if (previous.storeId !== incident.storeId || !visibleStoreIds.includes(previous.storeId)) throw new Error('La novedad no pertenece a esta sede.');
      const oldImpact = previous.type === IncidentType.DAMAGED && previous.status === IncidentStatus.EN_ARREGLO_CAMBIO ? -1 : 0;
      const newImpact = incident.type === IncidentType.DAMAGED && incident.status === IncidentStatus.EN_ARREGLO_CAMBIO ? -1 : 0;
      if (previous.type === IncidentType.DAMAGED && incident.productId !== previous.productId) throw new Error('No se puede cambiar el producto de una novedad dañada; crea una nueva novedad.');
      const stockChange = newImpact - oldImpact;
      const productRef = stockChange && previous.productId ? doc(db, 'inventory', previous.productId) : null;
      const productSnapshot = productRef ? await transaction.get(productRef) : null;
      if (productRef && (!productSnapshot?.exists() || productSnapshot.data()?.storeId !== previous.storeId)) throw new Error('Producto no encontrado en esta sede.');
      const timestamp = new Date().toISOString();
      if (productRef && productSnapshot) {
        const before = Number(productSnapshot.data()?.stock || 0);
        transaction.update(productRef, { stock: before + stockChange });
        const logRef = doc(collection(db, 'productHistory'));
        transaction.set(logRef, {
          id: logRef.id, productId: previous.productId, productName: previous.productName || 'Producto',
          storeId: previous.storeId, changedBy: currentUser?.name || 'Sistema', timestamp,
          changeType: stockChange > 0 ? ProductChangeType.DAMAGED_RETURNED : ProductChangeType.DAMAGED,
          incidentId: incident.id, stockBefore: before, stockAfter: before + stockChange, quantityChange: stockChange,
          details: `Estado modificado de ${previous.status} a ${incident.status}. Stock: ${before} → ${before + stockChange}`
        });
      }
      const history = previous.status !== incident.status
        ? [...(previous.history || []), { status: incident.status, changedBy: currentUser?.name || 'Sistema', timestamp, notes: 'Estado actualizado manualmente por administrador' }]
        : previous.history || [];
      transaction.set(incidentRef, cleanObject({ ...incident, history, companyId: previous.companyId, storeId: previous.storeId }), { merge: true });
    });
  };

  const handleDeleteIncident = async (incidentId: string) => {
    if (operationContextRef.current !== contextAtRender) throw new Error('La sede cambió. Vuelve a abrir la novedad.');
    if (operationContextRef.current !== contextAtRender) throw new Error('La sede cambió. Vuelve a abrir la novedad.');
    if (!currentUser) return;
    const incident = incidents.find(i => i.id === incidentId);
    if (!incident) return;

    // 1. Si es un traslado completado que movió inventario
    if (incident.type === IncidentType.INVENTORY_TRANSFER_REQUEST && 
        incident.status === IncidentStatus.TRASLADO_COMPLETADO) {
      
      const fromStoreName = getStoreName(incident.fromStoreId || '');
      const toStoreName = getStoreName(incident.toStoreId || '');
      const qty = incident.quantity || 1;

      const confirmMsg = `Esta novedad corresponde a un traslado de inventario que ya fue procesado.\n\n` +
        `📦 Producto: ${incident.productName || 'Producto'}\n` +
        `🔢 Cantidad: ${qty} unidad(es)\n\n` +
        `¿Deseas ELIMINAR esta novedad y REVERTIR el stock?\n` +
        `• Se devolverán +${qty} unidad(es) a: ${fromStoreName}\n` +
        `• Se restarán -${qty} unidad(es) de: ${toStoreName}\n` +
        `• Se eliminará también el registro del historial de traslados.`;

      if (!window.confirm(confirmMsg)) return;

      try {
        const batch = writeBatch(db);

        // 1.1 Restaurar stock en Tienda Origen (fromStore)
        if (incident.fromStoreId) {
          let fromProductRef = incident.productId ? doc(db, 'inventory', incident.productId) : null;
          let fromProductDoc = fromProductRef ? await getDoc(fromProductRef) : null;
          let fromProduct: Product | null = null;

          if (fromProductDoc && fromProductDoc.exists() && fromProductDoc.data().storeId === incident.fromStoreId) {
            fromProduct = { id: fromProductDoc.id, ...fromProductDoc.data() } as Product;
          } else if (incident.productName) {
            const qFrom = query(
              collection(db, 'inventory'),
              where('name', '==', incident.productName),
              where('storeId', '==', incident.fromStoreId),
              limit(1)
            );
            const snapFrom = await getDocs(qFrom);
            if (!snapFrom.empty) {
              fromProductDoc = snapFrom.docs[0];
              fromProductRef = fromProductDoc.ref;
              fromProduct = { id: fromProductDoc.id, ...fromProductDoc.data() } as Product;
            }
          }

          if (fromProduct && fromProductRef && fromProductDoc && fromProductDoc.exists()) {
            batch.update(fromProductRef, { stock: increment(qty) });
            const log = createProductHistoryLog(
              fromProduct || { id: fromProductRef.id, name: incident.productName || 'Producto', storeId: incident.fromStoreId, cost: 0, price: 0, categoryId: '', stock: 0 },
              currentUser.name,
              ProductChangeType.TRANSFER_DELETED,
              `+${qty} devueltas por anulación de novedad de traslado a ${toStoreName}`
            );
            batch.set(doc(db, 'productHistory', log.id), log);
          }
        }

        // 1.2 Descontar stock en Tienda Destino (toStore)
        if (incident.toStoreId && incident.productName) {
          const qTo = query(
            collection(db, 'inventory'),
            where('name', '==', incident.productName),
            where('storeId', '==', incident.toStoreId),
            limit(1)
          );
          const snapTo = await getDocs(qTo);
          if (!snapTo.empty) {
            const toProductDoc = snapTo.docs[0];
            const toProduct = { id: toProductDoc.id, ...toProductDoc.data() } as Product;
            batch.update(toProductDoc.ref, { stock: increment(-qty) });
            const log = createProductHistoryLog(
              toProduct,
              currentUser.name,
              ProductChangeType.TRANSFER_DELETED,
              `-${qty} descontadas por anulación de novedad de traslado desde ${fromStoreName}`
            );
            batch.set(doc(db, 'productHistory', log.id), log);
          }
        }

        // 1.3 Buscar y eliminar registros en inventoryTransfers asociados
        if (incident.fromStoreId && incident.toStoreId) {
          const qTransfers = query(
            collection(db, 'inventoryTransfers'),
            where('fromStoreId', '==', incident.fromStoreId),
            where('toStoreId', '==', incident.toStoreId)
          );
          const snapTransfers = await getDocs(qTransfers);
          snapTransfers.docs.forEach(tDoc => {
            const tData = tDoc.data();
            if (tData.productName === incident.productName || tData.productId === incident.productId) {
              batch.delete(tDoc.ref);
            }
          });
        }

        // 1.4 Eliminar la novedad
        batch.delete(doc(db, 'incidents', incidentId));

        await batch.commit();
        alert('Novedad eliminada, stock revertido y traslado anulado exitosamente.');
        return;
      } catch (error: any) {
        console.error("Error al revertir traslado desde novedad:", error);
        alert(`Error al eliminar novedad: ${error.message}`);
        return;
      }
    }

    // 2. Si es una novedad de prenda dañada que estaba en arreglo
    if (incident.type === IncidentType.DAMAGED && incident.status === IncidentStatus.EN_ARREGLO_CAMBIO && incident.productId) {
      if (window.confirm('¿Eliminar novedad de prenda dañada? Se restaurará +1 unidad al inventario.')) {
        try {
          const batch = writeBatch(db);
          batch.update(doc(db, 'inventory', incident.productId), { stock: increment(1) });
          const logRef = doc(collection(db, 'productHistory'));
          const log: ProductHistoryLog = {
            id: logRef.id,
            productId: incident.productId,
            productName: incident.productName || 'Producto',
            storeId: incident.storeId,
            changedBy: currentUser.name,
            timestamp: new Date().toISOString(),
            changeType: ProductChangeType.DAMAGED_RETURNED,
            details: `Novedad de prenda dañada eliminada. Stock restaurado: +1`
          };
          batch.set(logRef, log);
          batch.delete(doc(db, 'incidents', incidentId));
          await batch.commit();
          alert('Novedad eliminada y stock restaurado.');
          return;
        } catch (error: any) {
          console.error("Error al eliminar novedad de daño:", error);
          alert(`Error al eliminar novedad: ${error.message}`);
          return;
        }
      }
      return;
    }

    // 3. Novedades estándar
    if (window.confirm('¿Eliminar novedad permanentemente?')) {
      await deleteDoc(doc(db, 'incidents', incidentId));
    }
  };
  
  const handleUpdateLayaway = async (updatedLayaway: Layaway, originalLayaway: Layaway) => {
      if (!currentUser) return;
      const batch = writeBatch(db);

      // Si existía un documento duplicado accidental en la colección 'sales' por ediciones anteriores, lo eliminamos
      const duplicateSaleRef = doc(db, 'sales', updatedLayaway.id);
      batch.delete(duplicateSaleRef);

      const isOrigActive = originalLayaway.status === 'active' || originalLayaway.status === 'completed';
      const isNewActive = updatedLayaway.status === 'active' || updatedLayaway.status === 'completed';
      const itemsChanged = JSON.stringify(originalLayaway.items) !== JSON.stringify(updatedLayaway.items);

      // Liberar stock original solo si antes estuvo reservado y ahora deja de estarlo o cambiaron las prendas
      if (isOrigActive && (!isNewActive || itemsChanged)) {
          originalLayaway.items.forEach(item => {
              if (item && item.id) {
                  const productRef = doc(db, 'inventory', item.id);
                  batch.update(productRef, { stock: increment(item.quantity) });

                  const logRef = doc(collection(db, 'productHistory'));
                  const log: ProductHistoryLog = {
                      id: logRef.id,
                      productId: item.id,
                      productName: item.name,
                      storeId: originalLayaway.storeId,
                      changedBy: currentUser.name,
                      timestamp: new Date().toISOString(),
                      changeType: ProductChangeType.LAYAWAY_DELETED,
                      details: `Abono #${originalLayaway.invoiceNumber} editado (producto liberado). Stock devuelto: +${item.quantity}`
                  };
                  batch.set(logRef, log);
              }
          });
      }

      // Descontar nuevo stock solo si ahora pasa a estar activo/completado y antes no lo estaba o si cambiaron las prendas
      if (isNewActive && (!isOrigActive || itemsChanged)) {
          updatedLayaway.items.forEach(item => {
              if (item && item.id) {
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
                      details: `Abono #${updatedLayaway.invoiceNumber} editado (producto reservado). Stock restado: -${item.quantity}`
                  };
                  batch.set(logRef, log);
              }
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
      
      const allKnownProducts = [...inventory, ...globalInventoryForSearch];

      originalSale.items.forEach(item => {
          if (item && item.id && !item.id.startsWith('voucher-')) {
              // Only update if product still exists in DB (to avoid batch failure)
              if (allKnownProducts.some(p => p.id === item.id)) {
                  const productRef = doc(db, 'inventory', item.id);
                  batch.update(productRef, { stock: increment(item.quantity) });
              }
          }
      });

      updatedSale.items.forEach(item => {
          if (item && item.id && !item.id.startsWith('voucher-')) {
              if (allKnownProducts.some(p => p.id === item.id)) {
                  const productRef = doc(db, 'inventory', item.id);
                  batch.update(productRef, { stock: increment(-item.quantity) });
              }
          } else if (item && item.id && item.id.startsWith('voucher-')) {
              // Si están editando la fecha de la venta y contiene un bono, actualizamos la fecha del bono
              if (updatedSale.createdAt !== originalSale.createdAt) {
                  const voucherCode = item.id.replace('voucher-', '');
                  const voucher = giftVouchers.find(v => v.code === voucherCode);
                  if (voucher) {
                      batch.update(doc(db, 'giftVouchers', voucher.id), {
                          createdAt: updatedSale.createdAt
                      });
                  }
              }
          }
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
    const batch = writeBatch(db);
    batch.set(draftRef, cleanObject(draftData));

    const historyRef = doc(collection(db, 'detailedVerificationHistory'));
    
    const historicalCounts: Record<string, { physical: number; system: number }> = {};
    Object.keys(systemSnapshot).forEach(pid => {
        historicalCounts[pid] = {
            physical: counts[pid] !== undefined ? counts[pid] : 0, 
            system: systemSnapshot[pid] || 0
        };
    });

    batch.set(historyRef, cleanObject({
        ...draftData,
        id: historyRef.id,
        draftId: draftId,
        counts: historicalCounts, 
        updatedAt: now 
    }));
    await batch.commit();
  };

  const handleApplyDetailedVerification = async (categoryId: string, counts: Record<string, number>) => {
    if (!currentStoreId || !currentUser || !isAdmin) return;
    const batch = writeBatch(db);
    Object.entries(counts).forEach(([pid, count]) => {
      const productRef = doc(db, 'inventory', pid);
      const product = inventory.find(p => p.id === pid && p.storeId === currentStoreId && p.categoryId === categoryId);
      if (!product || !isOwnInventory(product)) throw new Error('El conteo contiene un producto de otra sede o categoría.');
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
      await setDoc(newRef, { id: newRef.id, content, seller, createdAt: new Date().toISOString(), storeId: currentStoreId, companyId: operationalCompanyId });
  };

  const handleSaveCeoNote = async (data: Omit<CeoDailyNote, 'id' | 'createdAt'>) => {
    const newRef = doc(collection(db, 'daily_notes'));
    await setDoc(newRef, {
      ...data,
      id: newRef.id,
      createdAt: new Date().toISOString(),
      companyId: operationalCompanyId
    });
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

  const isOwnInventory = (data: Product) => {
    try { assertTenantData('inventory', data, { companyId: operationalCompanyId, storeIds: visibleStoreIds }); return true; } catch { return false; }
  };

  const findCompanyProducts = async (name: string) => {
    const snapshots = await Promise.all([...visibleStoreIds].map(storeId => getDocs(query(collection(db, 'inventory'), where('storeId', '==', storeId), where('name', '==', name)))));
    const docs = snapshots.flatMap(snapshot => snapshot.docs).filter(document => isOwnInventory(document.data() as Product));
    return { docs, empty: docs.length === 0 };
  };

  const handleAddProduct = async (newProductData: any, selectedStoreIds: string[], imageFile?: File) => {
      const inputName = newProductData.name;
      const allowedStoreIds = new Set(visibleStores.map(s => s.id));
      const invalidStoreIds = selectedStoreIds.filter(id => !allowedStoreIds.has(id));
      if (invalidStoreIds.length > 0) throw new Error('Intento bloqueado: no se pueden crear productos en tiendas de otra empresa.');
      
      await assertCategoryAccess(newProductData.categoryId);
      const rawSnapshot = await findCompanyProducts(inputName);
      // Product identity propagation must never cross company boundaries.
      const companyDocs = rawSnapshot.docs.filter(d => allowedStoreIds.has((d.data() as Product).storeId));
      const snapshot = { ...rawSnapshot, docs: companyDocs, empty: companyDocs.length === 0 } as typeof rawSnapshot;
      
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
                  const currentStock = (existingDoc.data() as Product).stock || 0;
                  batch.update(existingDoc.ref, { 
                      stock: increment(newProductData.stock)
                  });
                  const logRef = doc(collection(db, 'productHistory'));
                  batch.set(logRef, {
                      id: logRef.id,
                      productId: existingDoc.id,
                      productName: inputName,
                      storeId,
                      companyId: operationalCompanyId,
                      changedBy: currentUser?.name || 'Administrador',
                      timestamp: new Date().toISOString(),
                      changeType: ProductChangeType.MANUAL_EDIT,
                      details: `Incremento de stock por adición: +${newProductData.stock} (antes: ${currentStock})`
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
                  companyId: operationalCompanyId,
                  isDisabled: false 
              }));

              const logRef = doc(collection(db, 'productHistory'));
              batch.set(logRef, {
                  id: logRef.id,
                  productId: newRef.id,
                  productName: inputName,
                  storeId,
                  changedBy: currentUser?.name || 'Administrador',
                  timestamp: new Date().toISOString(),
                  changeType: ProductChangeType.CREATED,
                  details: `Creación de producto. Stock inicial: ${newProductData.stock || 0}`
              });
          }
      });
      await batch.commit();
  };

  const handleUpdateProduct = async (updatedProduct: Product, imageFile?: File) => {
      await assertCategoryAccess(updatedProduct.categoryId);
      const productRef = doc(db, 'inventory', updatedProduct.id);
      
      const currentSnap = await getDoc(productRef);
      if (!currentSnap.exists() || !isOwnInventory(currentSnap.data() as Product)) throw new Error('Producto no autorizado.');
      const nameInDb = currentSnap.exists() ? currentSnap.data().name : updatedProduct.name;
      const oldStock = currentSnap.exists() ? (currentSnap.data().stock || 0) : 0;
      const oldPrice = currentSnap.exists() ? (currentSnap.data().price || 0) : 0;
      
      let newImageUrl = updatedProduct.imageUrl;
      if (imageFile) {
        newImageUrl = await uploadImageAndGetURL(imageFile);
      }

      const batch = writeBatch(db);
      
      const rawSnapshot = await findCompanyProducts(nameInDb);
      const companyDocs = rawSnapshot.docs.filter(d => visibleStoreIds.has((d.data() as Product).storeId));
      const snapshot = { ...rawSnapshot, docs: companyDocs, empty: companyDocs.length === 0 } as typeof rawSnapshot;
      
      if (!visibleStoreIds.has(updatedProduct.storeId)) throw new Error('Intento bloqueado: el producto pertenece a otra empresa.');
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
        if (!product || !product.name) return;
        const uniqueKey = (product.name || '').trim().toLowerCase();
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
      if (!currentUser || !storeId || !visibleStoreIds.has(storeId)) {
        throw new Error('Selecciona una tienda autorizada antes de importar.');
      }
      if (!products.length) return;
      const batch = writeBatch(db);
      const existingSkus = new Set<string>(inventory.map(p => p.sku).filter(Boolean) as string[]);
      const skuByName = new Map<string, string>();
      
      // Llenamos el mapa con los SKUs de los productos que ya existen en inventario
      inventory.forEach(p => {
        if (p.name && p.sku) {
          skuByName.set(p.name.trim().toLowerCase(), p.sku);
        }
      });
      
      // Resolve categories once and save new categories atomically with products.
      const categoryByName = new Map<string, Category>(categories.map(category => [normalizeText(category.name), category]));
      let writeCount = 0;
      products.forEach(p => {
          const categoryName = (p.categoryName || '').trim();
          if (!p.name?.trim() || !categoryName || ![p.price, p.cost, p.stock].every(value => Number.isFinite(value) && value >= 0) || !Number.isInteger(p.stock)) {
            throw new Error(`Datos inválidos para "${p.name || 'Producto'}". Revisa nombre, categoría, precio, costo y stock.`);
          }
          const categoryKey = normalizeText(categoryName);
          let matchedCategory = categoryByName.get(categoryKey);
          if (!matchedCategory) {
            const categoryRef = doc(collection(db, 'categories'));
            matchedCategory = { id: categoryRef.id, name: toTitleCase(categoryName), companyId: operationalCompanyId };
            categoryByName.set(categoryKey, matchedCategory);
            batch.set(categoryRef, matchedCategory);
            writeCount++;
          }
          writeCount += 2;
          if (writeCount > 500) {
            throw new Error('La carga es demasiado grande. Divide los productos en grupos de máximo 150.');
          }

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
          const { categoryName: _categoryName, ...productData } = p;
          batch.set(newRef, cleanObject({
            ...productData,
            id: newRef.id,
            sku,
            categoryId: matchedCategory.id,
            storeId,
            companyId: operationalCompanyId,
            isDisabled: false
          }));

          const logRef = doc(collection(db, 'productHistory'));
          batch.set(logRef, {
              id: logRef.id,
              productId: newRef.id,
              productName: p.name || 'Producto',
              storeId,
              companyId: operationalCompanyId,
              changedBy: currentUser?.name || 'Administrador',
              timestamp: new Date().toISOString(),
              changeType: ProductChangeType.CREATED,
              details: `Creación masiva de producto. Stock inicial: ${p.stock || 0}`
          });
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
    const requestedStoreIds = Object.keys(storeEntries);
    if (requestedStoreIds.some(id => !visibleStoreIds.has(id))) {
      throw new Error('Intento bloqueado: una compra incluye una tienda de otra empresa.');
    }
    
    await assertCategoryAccess(productInfo.categoryId);
    // Reuse product metadata only inside the active company.
    const rawGlobalSnap = await findCompanyProducts(inputName);
    const companyGlobalDocs = rawGlobalSnap.docs.filter(d => visibleStoreIds.has((d.data() as Product).storeId));
    const globalSnap = { ...rawGlobalSnap, docs: companyGlobalDocs, empty: companyGlobalDocs.length === 0 } as typeof rawGlobalSnap;
    
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
                    companyId: operationalCompanyId,
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
                storeId: storeId,
                companyId: operationalCompanyId
            }));

            const logRef = doc(collection(db, 'productHistory'));
            const log = {
                id: logRef.id,
                productId,
                productName: inputName,
                storeId,
                companyId: operationalCompanyId,
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

    const existing = await getDoc(purchaseRef);
    if (!existing.exists()) throw new Error('Compra no encontrada.');
    assertTenantData('purchases', existing.data(), { companyId: operationalCompanyId, storeIds: visibleStoreIds });
    if (existing.data().storeId !== updatedPurchase.storeId || existing.data().productId !== updatedPurchase.productId) throw new Error('No se puede cambiar la sede o el producto de una compra existente.');
    const qtyDiff = updatedPurchase.quantity - existing.data().quantity;

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

  const assertCategoryAccess = async (id: string) => {
    const snapshot = await getDoc(doc(db, 'categories', id));
    if (!snapshot.exists() || !belongsToCompany({ ...snapshot.data(), id } as Category, operationalCompanyId)) {
      throw new Error('La categoría no pertenece a la empresa seleccionada.');
    }
  };
  const handleAddCategory = async (name: string) => {
    const newRef = doc(collection(db, 'categories'));
    await setDoc(newRef, { id: newRef.id, name, companyId: operationalCompanyId });
  };
  const handleUpdateCategory = async (id: string, name: string) => {
    await assertCategoryAccess(id);
    await updateDoc(doc(db, 'categories', id), { name, companyId: operationalCompanyId });
  };
  const handleDeleteCategory = async (id: string) => {
    try {
      await assertCategoryAccess(id);
      // Check persisted products, including disabled/zero-stock products and
      // stores not currently loaded in the category manager.
      const references = await getDocs(query(collection(db, 'inventory'), where('categoryId', '==', id), limit(1)));
      if (!references.empty) {
        alert('No se puede eliminar esta categoría: todavía tiene productos vinculados. Reasígnalos antes de eliminarla.');
        return;
      }
      await deleteDoc(doc(db, 'categories', id));
    } catch (error) {
      console.error('Error deleting category:', error);
      alert('No se pudo eliminar la categoría. Verifica la conexión y la empresa seleccionada.');
    }
  };
  
  const handleAddExpenseCategory = async (name: string) => {
    if (!currentStoreId) return;
    const newRef = doc(collection(db, 'expenseCategories'));
    await setDoc(newRef, { id: newRef.id, name, storeId: currentStoreId });
  };
  const handleUpdateExpenseCategory = async (id: string, name: string) => await updateDoc(doc(db, 'expenseCategories', id), { name });
  const handleDeleteExpenseCategory = async (id: string) => await deleteDoc(doc(db, 'expenseCategories', id));

  const handleAddStore = async (store: Store) => {
    const userCompanyId = operationalCompanyId;
    const storeToSave: Store = {
      ...store,
      companyId: isDeveloper ? (store.companyId || userCompanyId) : userCompanyId
    };
    await setDoc(doc(db, 'stores', storeToSave.id), cleanObject(storeToSave) as any);
  };
  const handleUpdateStore = async (updatedStore: Store) => {
    try {
      await updateDoc(doc(db, 'stores', updatedStore.id), cleanObject(updatedStore) as any);
      
      // Sincronizar configuración de etiquetas en todos los locales
      if (updatedStore.labelConfig) {
        const batch = writeBatch(db);
        visibleStores.forEach(s => {
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

  // Handlers for Developer Center & Multi-Tenant Management
  const handleCreateCompany = async (
    companyData: Partial<Company>, 
    initialStoreName: string, 
    adminUserData?: { name: string; username: string; password: string }
  ) => {
    if (!isDeveloper) throw new Error('Solo Developer puede gestionar empresas y sus usuarios iniciales.');
    const companyRef = doc(collection(db, 'companies'));
    const companyId = companyRef.id;

    const newCompany: Company = {
      id: companyId,
      name: companyData.name || 'Nueva Empresa',
      nit: companyData.nit || '',
      phone: companyData.phone || '',
      email: companyData.email || '',
      address: companyData.address || '',
      maxStores: Math.max(1, Number(companyData.maxStores) || 2),
      maxAdmins: Math.max(1, Number(companyData.maxAdmins) || 1),
      maxSellers: Math.max(0, Number(companyData.maxSellers) || 0),
      status: 'active',
      createdAt: new Date().toISOString(),
      allowedViews: companyData.allowedViews && companyData.allowedViews.length > 0 
        ? companyData.allowedViews 
        : DEFAULT_CLIENT_ALLOWED_VIEWS
    };

    const batch = nativeWriteBatch(db);
    batch.set(companyRef, cleanObject(newCompany));

    // Create initial Store for this company
    const storeRef = doc(collection(db, 'stores'));
    const initialStore: Store = {
      id: storeRef.id,
      name: initialStoreName || 'Sede Principal',
      companyId: companyId,
      logo: null,
      contactInfo: companyData.phone || '',
      footerText: '¡Gracias por su compra!',
      whatsappFooterText: 'Gracias por preferirnos.',
      addiLink: '',
      sistecreditoLink: '',
      accentColor: '#4f46e5',
      accentColorHover: '#4338ca',
      nextInvoiceNumber: 1,
      initialBalances: { cash: 0, qr: 0 }
    };
    batch.set(storeRef, cleanObject(initialStore));

    // Create initial Admin user if provided
    if (adminUserData) {
      const adminRole = roles.find(r => r.name === 'Administrator' && (r.companyId || DEFAULT_COMPANY_ID) === DEFAULT_COMPANY_ID);
      if (!adminRole) throw new Error('No existe el rol Administrator.');
      const roleRef = doc(db, 'roles', `${companyId}__role__${adminRole.id}`);
      batch.set(roleRef, { ...adminRole, id: roleRef.id, companyId });
      const sellerRef = doc(collection(db, 'sellers'));
      const newAdmin: Seller = {
        id: sellerRef.id,
        name: adminUserData.name || 'Administrador',
        username: adminUserData.username,
        password: adminUserData.password,
        roleId: roleRef.id,
        storeId: storeRef.id,
        companyId: companyId,
        isDisabled: false
      };
      batch.set(sellerRef, cleanObject(newAdmin));
    }

    await batch.commit();
  };

  const handleUpdateCompany = async (company: Company) => {
    if (!isDeveloper) throw new Error('Solo Developer puede gestionar empresas y sus usuarios iniciales.');
    await nativeUpdateDoc(doc(db, 'companies', company.id), cleanObject(company) as any);
  };

  const handleDeleteCompany = async (companyId: string) => {
    if (!isDeveloper) throw new Error('Solo Developer puede gestionar empresas y sus usuarios iniciales.');
    if (companyId === DEFAULT_COMPANY_ID) {
      alert('No se puede eliminar la empresa principal.');
      return;
    }
    await nativeDeleteDoc(doc(db, 'companies', companyId));
  };

  const handleCreateStoreForCompany = async (companyId: string, storeData: Partial<Store>) => {
    if (!isDeveloper) throw new Error('Solo Developer puede gestionar empresas y sus usuarios iniciales.');
    const storeRef = doc(collection(db, 'stores'));
    const newStore: Store = {
      id: storeRef.id,
      name: storeData.name || 'Nueva Sede',
      companyId: companyId,
      logo: storeData.logo || null,
      contactInfo: storeData.contactInfo || '',
      footerText: storeData.footerText || '¡Gracias por su compra!',
      whatsappFooterText: storeData.whatsappFooterText || 'Gracias por preferirnos.',
      addiLink: storeData.addiLink || '',
      sistecreditoLink: storeData.sistecreditoLink || '',
      accentColor: storeData.accentColor || '#ff007f',
      accentColorHover: storeData.accentColorHover || '#d9006c',
      nextInvoiceNumber: storeData.nextInvoiceNumber || 1,
      initialBalances: storeData.initialBalances || { cash: 0, qr: 0 }
    };
    await nativeSetDoc(storeRef, cleanObject(newStore));
  };

  const assertUserLimit = (companyId: string, roleId: string, excludedUserId?: string) => {
    const role = roles.find(r => r.id === roleId);
    const userType = getRoleUserType(role);
    if (isPlatformRole(role)) throw new Error('Developer solo se asigna desde Developer Center por Carlos.');

    const company = companies.find(c => c.id === companyId);
    if (!company) throw new Error('No se encontró la empresa del usuario.');

    const companyUsers = sellers.filter(s => {
      if (s.id === excludedUserId) return false;
      const sellerCompanyId = s.companyId || stores.find(store => store.id === s.storeId)?.companyId || DEFAULT_COMPANY_ID;
      return s.id !== PLATFORM_OWNER_USER_ID && s.platformRole !== 'developer' && sellerCompanyId === companyId && getRoleUserType(roles.find(r => r.id === s.roleId)) === userType;
    });
    const configuredLimit = userType === 'admin' ? company.maxAdmins : company.maxSellers;
    const effectiveLimit = configuredLimit === undefined ? companyUsers.length : configuredLimit;
    const label = userType === 'admin' ? 'administradores' : 'vendedores';

    if (companyUsers.length >= effectiveLimit) {
      throw new Error(`La empresa alcanzó el límite de ${label} (${effectiveLimit}). El desarrollador debe ampliar la licencia.`);
    }
  };

  const handleCreateAdminUser = async (
    companyId: string,
    storeId: string,
    adminData: { name: string; username: string; password: string }
  ) => {
    if (!isDeveloper) throw new Error('Solo Developer puede gestionar empresas y sus usuarios iniciales.');
    const adminRole = roles.find(r => r.name === 'Administrator' && (r.companyId || DEFAULT_COMPANY_ID) === DEFAULT_COMPANY_ID);
    if (!adminRole) throw new Error('No existe el rol Administrator.');
    assertUserLimit(companyId, adminRole.id);
    const store = await getDoc(doc(db, 'stores', storeId));
    if (!store.exists() || (store.data().companyId || DEFAULT_COMPANY_ID) !== companyId) throw new Error('La sede pertenece a otra empresa.');
    const isolatedRoleId = await ensureCompanyRole(db, adminRole.id, companyId);
    const sellerRef = doc(collection(db, 'sellers'));
    const newAdmin: Seller = {
      id: sellerRef.id,
      name: adminData.name,
      username: adminData.username,
      password: adminData.password,
      roleId: isolatedRoleId,
      storeId: storeId,
      companyId: companyId,
      isDisabled: false
    };
    await nativeSetDoc(sellerRef, cleanObject(newAdmin));
  };
  const assertCanManageUser = async (id: string) => {
    if (isOwner) return;
    if (id === PLATFORM_OWNER_USER_ID) throw new Error('Solo Carlos puede modificar su cuenta de propietario.');
    const grant = await getDoc(nativeDoc(db, 'platformDevelopers', id));
    if (grant.exists() && grant.data().active) throw new Error('Solo Carlos puede modificar una cuenta de plataforma.');
  };
  const handleSetPlatformDeveloper = async (userId: string, active: boolean) => {
    await setPlatformDeveloper(db, currentUser, currentView, userId, active);
  };
  const handleCreatePlatformDeveloper = async (data: { name: string; username: string; password: string; storeId: string }) => {
    assertPlatformOwnerAction(currentUser, currentView);
    if (!data.name.trim() || !data.username.trim() || !data.password.trim()) throw new Error('Completa nombre, usuario y contraseña.');
    if (sellers.some(seller => (seller.username || seller.name || '').trim().toLowerCase() === data.username.trim().toLowerCase())) throw new Error('Ese usuario ya existe.');
    const store = await getDoc(nativeDoc(db, 'stores', data.storeId));
    if (!store.exists()) throw new Error('Selecciona una sede existente para el usuario.');
    const companyId = store.data().companyId || DEFAULT_COMPANY_ID;
    const adminRole = roles.find(role => role.name === 'Administrator' && (role.companyId || DEFAULT_COMPANY_ID) === DEFAULT_COMPANY_ID);
    if (!adminRole) throw new Error('No se encontró el rol base de la empresa.');
    const roleId = await ensureCompanyRole(db, adminRole.id, companyId);
    const ref = nativeDoc(collection(db, 'sellers'));
    const batch = nativeWriteBatch(db);
    batch.set(ref, { id: ref.id, name: data.name.trim(), username: data.username.trim(), password: data.password.trim(), storeId: data.storeId, companyId, roleId, platformRole: 'developer', isDisabled: false });
    batch.set(nativeDoc(db, 'platformDevelopers', ref.id), { userId: ref.id, role: 'developer', active: true, grantedBy: PLATFORM_OWNER_USER_ID, grantedAt: new Date().toISOString() });
    await batch.commit();
  };
  const handleAddSeller = async (name: string, password: string, roleId: string, storeId: string, username?: string) => {
    const userCompanyId = operationalCompanyId;
    if (!visibleStoreIds.has(storeId)) throw new Error('No se puede crear un usuario en una tienda de otra empresa.');
    const assignedRole = roles.find(role => role.id === roleId);
    assertCompanyRole(assignedRole);
    assertTenantData('roles', assignedRole, { companyId: operationalCompanyId, storeIds: visibleStoreIds });
    assertUserLimit(userCompanyId, roleId);
    const newRef = doc(collection(db, 'sellers'));
    const newSellerData: any = {
      id: newRef.id,
      name,
      password,
      roleId,
      storeId,
      companyId: userCompanyId,
      isDisabled: false
    };
    if (username) newSellerData.username = username;
    await setDoc(newRef, cleanObject(newSellerData));
  };
  const handleUpdateSeller = async (id: string, name: string, password: string, roleId: string, storeId: string, username?: string) => {
    await assertCanManageUser(id);
    const assignedRole = roles.find(role => role.id === roleId);
    assertCompanyRole(assignedRole);
    assertTenantData('roles', assignedRole, { companyId: operationalCompanyId, storeIds: visibleStoreIds });
    const targetSeller = sellers.find(s => s.id === id);
    const userCompanyId = operationalCompanyId;
    if (!visibleStoreIds.has(storeId)) throw new Error('La sede pertenece a otra empresa.');
    assertTenantData('sellers', targetSeller, { companyId: operationalCompanyId, storeIds: visibleStoreIds });
    if (!targetSeller) throw new Error('No se encontró el usuario.');
    const oldType = getRoleUserType(roles.find(r => r.id === targetSeller.roleId));
    const newType = getRoleUserType(roles.find(r => r.id === roleId));
    if (oldType !== newType) assertUserLimit(userCompanyId, roleId, id);
    const data: any = { name, roleId, storeId, companyId: userCompanyId };
    if (password) data.password = password;
    if (username !== undefined) data.username = username;
    await updateDoc(doc(db, 'sellers', id), cleanObject(data));
  };
  const handleDeleteSeller = async (id: string) => { await assertCanManageUser(id); if (id === PLATFORM_OWNER_USER_ID) throw new Error('No puedes eliminar al propietario Carlos.'); if(window.confirm('¿Eliminar vendedor?')) await deleteDoc(doc(db, 'sellers', id)); };
  const handleToggleSellerStatus = async (id: string) => { await assertCanManageUser(id); if (id === PLATFORM_OWNER_USER_ID) throw new Error('No puedes desactivar al propietario Carlos.'); const seller = sellers.find(s => s.id === id); if (seller) await updateDoc(doc(db, 'sellers', id), { isDisabled: !seller.isDisabled }); };
  const handleAddRole = async (name: string, userType: 'admin' | 'seller' | 'developer' = 'seller') => { assertCompanyRole({ id: '', name, permissions: [], userType }); const newRef = doc(collection(db, 'roles')); await setDoc(newRef, { id: newRef.id, name, permissions: [], userType, companyId: operationalCompanyId }); };
  const handleUpdateRole = async (updatedRole: Role) => {
    const original = roles.find(role => role.id === updatedRole.id);
    assertTenantData('roles', original, { companyId: operationalCompanyId, storeIds: visibleStoreIds });
    assertTenantData('roles', updatedRole, { companyId: operationalCompanyId, storeIds: visibleStoreIds });
    const hasSharedLegacyUsers = sellers.some(seller => seller.roleId === updatedRole.id && (seller.companyId || stores.find(store => store.id === seller.storeId)?.companyId || DEFAULT_COMPANY_ID) !== operationalCompanyId);
    if (hasSharedLegacyUsers && !isOwner) throw new Error('Carlos debe separar los roles históricos antes de editar este rol compartido.');
    const resolvedType = getRoleUserType(updatedRole);
    assertCompanyRole(updatedRole);
    if (isPlatformRole(roles.find(role => role.id === updatedRole.id))) throw new Error('Este rol de plataforma no se modifica desde roles de empresa.');
    await Promise.all(sellers.filter(seller => seller.roleId === updatedRole.id && (seller.companyId || stores.find(store => store.id === seller.storeId)?.companyId || DEFAULT_COMPANY_ID) !== operationalCompanyId).map(isolateSellerRole));
    await setDoc(doc(db, 'roles', updatedRole.id), cleanObject({ ...updatedRole, userType: resolvedType }));
  };
  
  const handleSavePayroll = async (payrollData: any) => {
      if (!canLoadStore || !currentStoreId || !currentUser || payrollData.storeId !== currentStoreId || payrollData.companyId !== operationalCompanyId) throw new Error('El cálculo no corresponde a la empresa y sede activas.');
      const newRef = doc(collection(db, 'payrollHistory'));
      const paidAt = payrollData.paidAt || new Date().toISOString();
      await setDoc(newRef, cleanObject({ ...payrollData, id: newRef.id, paidAt, paidBy: currentUser.name, storeId: currentStoreId, companyId: operationalCompanyId }));
  };

  const handleDeletePayroll = async (payrollId: string) => {
      if (!canLoadStore || !currentStoreId || !currentUser) throw new Error('Selecciona una sede autorizada.');
      const ref = doc(db, 'payrollHistory', payrollId);
      const snapshot = await getDoc(ref);
      const data = snapshot.data();
      if (!data || data.storeId !== currentStoreId || (data.companyId && data.companyId !== operationalCompanyId)) throw new Error('El pago pertenece a otra empresa o sede.');
      await deleteDoc(ref);
  };
  
  const handleBulkAddCustomers = async (newCustomers: any[]) => {
      if (!currentStoreId || operationContextRef.current !== contextAtRender || !visibleStoreIds.has(currentStoreId)) throw new Error('Selecciona una sede de la empresa activa.');
      const batch = writeBatch(db);
      newCustomers.forEach(c => {
          const newRef = doc(collection(db, 'customers'));
          batch.set(newRef, cleanObject({ ...c, id: newRef.id, storeId: currentStoreId, companyId: operationalCompanyId, createdAt: new Date().toISOString() }));
      });
      await batch.commit();
  };
  const handleUpdateCustomer = async (id: string, name: string, phone: string) => {
    if (!currentStoreId || operationContextRef.current !== contextAtRender) throw new Error('La sede cambió. Vuelve a abrir el cliente.');
    await createTenantWriter(db, { companyId: operationalCompanyId, storeIds: new Set([currentStoreId]) }).updateDoc(doc(db, 'customers', id), { name, phone });
  };

  const handleAddExpense = async (expenseData: Omit<Expense, 'id'>) => {
      if (!currentStoreId || !currentUser) return;
      const newRef = doc(collection(db, 'financialRecords'));
      // Mapeamos Expense a FinancialRecord
      const financialRecord: FinancialRecord = {
        id: newRef.id,
        date: expenseData.date === 'TEMPLATE' ? new Date().toISOString() : expenseData.date,
        storeId: currentStoreId,
        companyId: operationalCompanyId,
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
        await setDoc(templateRef, { ...expenseData, id: templateRef.id, storeId: currentStoreId, companyId: operationalCompanyId });
      } else {
        const batch = writeBatch(db);
        batch.set(newRef, cleanObject(financialRecord));

        // Log history
        const historyRef = doc(collection(db, 'financialRecordsHistory'));
        batch.set(historyRef, {
            id: historyRef.id,
            recordId: newRef.id,
            action: 'create',
            timestamp: new Date().toISOString(),
            changedBy: currentUser?.name || 'Sistema',
            newState: financialRecord,
            storeId: currentStoreId,
            companyId: operationalCompanyId,
            accountType: 'cash'
        });
        await batch.commit();
      }
  };

  const handleUpdateExpense = async (expense: Expense) => {
    if (expense.isRecurring) {
      await updateDoc(doc(db, 'expenses', expense.id), { ...expense });
      return;
    }
    await runTransaction(db, async transaction => {
      const recordRef = doc(db, 'financialRecords', expense.id);
      const snapshot = await transaction.get(recordRef);
      if (!snapshot.exists()) throw new Error('No se encontró el gasto.');
      const previousState = snapshot.data() as FinancialRecord;
      const updateData = { description: expense.description, amount: -Math.abs(expense.amount), subCategory: expense.category, date: expense.date };
      transaction.update(recordRef, updateData);
      const historyRef = doc(collection(db, 'financialRecordsHistory'));
      transaction.set(historyRef, { id: historyRef.id, recordId: expense.id, action: 'update', timestamp: new Date().toISOString(), changedBy: currentUser?.name || 'Sistema', previousState, newState: { ...previousState, ...updateData }, storeId: previousState.storeId, accountType: previousState.accountType || 'cash' });
    });
  };

  const handleDeleteExpense = async (id: string) => {
    if (!window.confirm('¿Eliminar este registro de gasto?')) return;
    await runTransaction(db, async transaction => {
      const expenseRef = doc(db, 'expenses', id);
      const expense = await transaction.get(expenseRef);
      if (expense.exists()) { transaction.delete(expenseRef); return; }
      const financialRef = doc(db, 'financialRecords', id);
      const snapshot = await transaction.get(financialRef);
      if (!snapshot.exists()) return;
      const previousState = snapshot.data() as FinancialRecord;
      const historyRef = doc(collection(db, 'financialRecordsHistory'));
      transaction.set(historyRef, { id: historyRef.id, recordId: id, action: 'delete', timestamp: new Date().toISOString(), changedBy: currentUser?.name || 'Sistema', previousState, storeId: previousState.storeId, accountType: previousState.accountType || 'cash' });
      transaction.delete(financialRef);
    });
  };

  const handleToggleFinancialRecordAccounting = async (id: string, exclude: boolean) => {
    const recordRef = doc(db, 'financialRecords', id);
    await updateDoc(recordRef, { excludeFromAccounting: exclude });
  };

  const handleUpdateAccountingChat = async (messages: any[]) => {
    if (!currentStoreId || operationContextRef.current !== contextAtRender) return;
    const chatRef = doc(db, 'accountingChatHistory', currentStoreId);
    await setDoc(chatRef, { messages, lastUpdated: new Date().toISOString(), storeId: currentStoreId, companyId: operationalCompanyId });
  };

  const handleAddLoan = async (loanData: Omit<Loan, 'id' | 'storeId' | 'createdAt'>) => {
    if (!currentStoreId) return;
    const ref = doc(collection(db, 'loans'));
    const finalLoan: Loan = {
      ...loanData,
      id: ref.id,
      storeId: currentStoreId,
      companyId: operationalCompanyId,
      createdAt: new Date().toISOString()
    };
    await setDoc(ref, cleanObject(finalLoan));
  };

  const handleUpdateLoan = async (loan: Loan) => {
    await updateDoc(doc(db, 'loans', loan.id), { ...cleanObject(loan) });
  };

  const handleDeleteLoan = async (id: string) => {
    if (!window.confirm('¿Deseas eliminar este préstamo?')) return;
    await deleteDoc(doc(db, 'loans', id));
  };

  const handleLogin = async (identifier: string, passwordAttempt: string) => {
    const cleanId = (identifier || '').trim().toLowerCase();
    const cleanPass = (passwordAttempt || '').trim();
    // Fetch seller records only after the user submits credentials, not at startup.
    // Preserve legacy case-insensitive username/name matching until secure auth migration.
    let loginSellers: Seller[];
    try {
      const snapshot = await getDocs(collection(db, 'sellers'));
      loginSellers = snapshot.docs.map(document => ({ ...document.data(), id: document.id } as Seller));
    } catch (error) {
      console.error('Could not load login identities:', error);
      alert('No se pudieron verificar los usuarios. Intenta nuevamente.');
      return;
    }
    const matches = loginSellers.filter(s =>
      s && (
        (s.username && s.username.trim().toLowerCase() === cleanId) ||
        (s.name && s.name.trim().toLowerCase() === cleanId)
      )
    );
    const seller = matches.find(s => (s.password || '').trim() === cleanPass);

    if (seller) {
      if (seller.isDisabled) {
        alert('Este usuario se encuentra desactivado. Contacta al administrador.');
        return;
      }

      let sellerStore = stores.find(s => s.id === seller.storeId);
      if (!sellerStore && seller.storeId) {
        try {
          const storeSnapshot = await getDoc(doc(db, 'stores', seller.storeId));
          if (storeSnapshot.exists()) sellerStore = { ...storeSnapshot.data(), id: storeSnapshot.id } as Store;
        } catch (error) {
          console.error('Could not load seller store:', error);
        }
      }
      const resolvedCompanyId = seller.companyId || sellerStore?.companyId || DEFAULT_COMPANY_ID;

      if (!sellerStore || (sellerStore.companyId || DEFAULT_COMPANY_ID) !== resolvedCompanyId) { alert('La empresa del usuario no coincide con su sede. Contacta al administrador.'); return; }
      // Compatibility bridge: legacy users continue to work, but every successful
      // login now repairs/persists the tenant identity needed for the secure-auth migration.
      if (!seller.companyId || seller.companyId !== resolvedCompanyId) {
        try {
          await nativeUpdateDoc(doc(db, 'sellers', seller.id), { companyId: resolvedCompanyId });
        } catch (error) {
          console.error('Could not persist seller companyId:', error);
        }
      }

      const sessionUser: Seller = { ...seller, companyId: resolvedCompanyId };
      setCurrentUser(sessionUser);
      setActiveCompanyId(resolvedCompanyId);
      localStorage.setItem('activeCompanyId', resolvedCompanyId);
      selectStore(seller.storeId);

      // Roles are not subscribed before login; fetch only this seller's role.
      let sellerRole = roles.find(role => role.id === seller.roleId);
      if (!sellerRole && seller.roleId) {
        try {
          const roleSnapshot = await getDoc(doc(db, 'roles', seller.roleId));
          if (roleSnapshot.exists()) sellerRole = { ...roleSnapshot.data(), id: roleSnapshot.id } as Role;
        } catch (error) {
          console.error('Could not fetch login role:', error);
        }
      }
      if (sellerRole && (sellerRole.name || '').toLowerCase() === 'vendedor') setCurrentView(View.POS);
      else setCurrentView(View.DASHBOARD);

      const newLoginRecord: Omit<LoginRecord, 'id'> = {
        sellerId: seller.id,
        sellerName: seller.name,
        date: new Date().toISOString(),
        storeId: seller.storeId,
        companyId: resolvedCompanyId
      };
      await nativeAddDoc(collection(db, 'loginHistory'), newLoginRecord);
    } else {
      alert('Usuario o contraseña incorrecta.');
    }
  };
  
  const handleLogout = () => { currentStoreIdRef.current = null; inventoryByStoreRef.current.clear(); setCurrentUser(null); setCurrentStoreId(null); localStorage.removeItem('currentStoreId'); setIsGlobalMode(false); setActiveCart([]); setInventory([]); setHasShownBriefing(false); };

  if (!currentUser) return <div className="min-h-screen w-full flex items-center justify-center p-4"><LoginView onLogin={handleLogin} isAppReady={isAppReady} /></div>;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 transition-colors duration-300">
      <Header currentView={currentView} setCurrentView={setCurrentView} theme={theme} toggleTheme={toggleTheme} currentUser={currentUser} currentStore={currentStore} currentCompany={currentCompany} userPermissions={userPermissions} onLogout={handleLogout} stores={visibleStores} onSwitchStore={handleSwitchStore} roles={visibleRoles} isGlobalMode={isGlobalMode} onToggleGlobalMode={() => setIsGlobalMode(!isGlobalMode)} incidents={dataContextReady ? incidents : []} onOpenBriefing={() => setIsBriefingModalOpen(true)} isDeveloper={isDeveloper} />
      <ViewFiltersProvider key={`filters:${dataScope}`}>
      <main key={`${dataScope}:${currentStoreId}:${currentView}`} className="w-full max-w-[1920px] mx-auto px-2 sm:px-4 lg:px-5 py-3 sm:py-4 pb-20 lg:pb-8 lg:pl-72 overflow-x-hidden">
        {!canAccessCurrentView && <div role="status" className="p-6 text-center">Esperando los permisos de acceso. Si continúa, consulta al administrador.</div>}
        {canAccessCurrentView && dataContextReady && <AppErrorBoundary key={`${dataScope}:${currentStoreId}:${currentView}`}>

        <Suspense fallback={<VestikaLoader />} >
        {currentView === View.DASHBOARD && <DashboardView key={`${dataScope}:${currentStoreId}`} companyId={operationalCompanyId} stores={visibleStores} allLayaways={allLayaways.filter(l => visibleStoreIds.has(l.storeId))} allIncidents={allIncidents.filter(i => visibleStoreIds.has(i.storeId))} currentUser={currentUser} roles={visibleRoles} onSwitchStore={handleSwitchStore} onNavigate={setCurrentView} onOpenReports={() => setIsReportsModalOpen(true)} sales={sales} layaways={layaways} expenses={expenses} inventory={inventory} categories={categories} sellers={visibleSellers} dailyNotes={dailyNotes} currentStore={currentStore} onUpdateSale={handleUpdateSale} onUpdateLayaway={handleUpdateLayaway} onDeleteSale={handleDeleteSale} onReprintSale={handleReprintSale} onOpenVerification={() => setIsVerificationModalOpen(true)} purchases={purchases} allSales={allSales.filter(s => visibleStoreIds.has(s.storeId))} allInventory={globalInventoryForSearch.filter(p => visibleStoreIds.has(p.storeId))} allStockTakes={stockTakes} />}
        {currentView === View.POS && <PosView inventory={isGlobalMode ? globalInventoryForSearch.filter(p => visibleStoreIds.has(p.storeId)) : inventory} categories={categories} sellers={visibleSellers} stores={visibleStores} sales={sales} purchases={purchases} layaways={layaways} allCustomers={customers} activeCart={activeCart} heldCarts={heldCarts} onAddToCart={handleAddToCart} onUpdateCartQuantity={handleUpdateCartQuantity} onUpdateCartItemPrice={handleUpdateCartItemPrice} onRemoveFromCart={handleRemoveFromCart} onClearCart={handleClearCart} onProcessSale={handleProcessSale} onHoldSale={handleHoldSale} onResumeSale={handleResumeSale} onCreateLayaway={handleCreateLayaway} onSaveStockTake={handleSaveStockTake} dailyNotes={dailyNotes} onAddDailyNote={handleAddDailyNote} onNavigate={setCurrentView} canAccessTagScanning={isDeveloper || userPermissions.includes(View.TAG_SCANNING)} currentStore={currentStore} incidents={incidents} onCreateIncident={handleCreateIncident} currentUser={currentUser} roles={visibleRoles} nextInvoiceNumber={currentStore?.nextInvoiceNumber || 1} onUpdateProduct={handleUpdateProduct} verifiedProducts={verifiedProducts} onToggleProductVerification={handleToggleProductVerification} onClearVerifications={handleClearVerifications} onSaveDetailedDraft={handleSaveDetailedDraft} onApplyDetailedVerification={handleApplyDetailedVerification} onUpdateStoreSettings={handleUpdateStore} onOpenVerification={() => setIsVerificationModalOpen(true)} giftVouchers={giftVouchers} onCreateGiftVoucher={handleCreateGiftVoucher} onUpdateGiftVoucher={handleUpdateGiftVoucher} onRegenerateAllSkus={handleRegenerateAllSkus} ceoNotes={ceoNotes} onAddCeoNote={handleSaveCeoNote} />}
        {currentView === View.INVENTORY && <InventoryView key={`${dataScope}:${currentStoreId}`} companyId={operationalCompanyId} inventory={inventory} allInventory={isGlobalMode ? globalInventoryForSearch.filter(p => visibleStoreIds.has(p.storeId)) : inventory} sales={sales} purchases={purchases} layaways={layaways} categories={categories} stores={visibleStores} currentStoreId={currentStoreId || ''} onAddProduct={handleAddProduct} onUpdateProduct={handleUpdateProduct} onBulkAddProducts={handleBulkAddProducts} onDeleteProduct={handleDeleteProduct} onAddCategory={handleAddCategory} onUpdateCategory={handleUpdateCategory} onDeleteCategory={handleDeleteCategory} onNavigate={setCurrentView} productHistory={productHistory} currentUser={currentUser} roles={visibleRoles} showDisabledProducts={shouldIncludeDisabledProducts} onShowDisabledProductsChange={setShouldIncludeDisabledProducts} onReactivateInconsistentProducts={(ids) => ids.forEach(id => updateDoc(doc(db, 'inventory', id), { isDisabled: false }))} onRegenerateAllSkus={handleRegenerateAllSkus} onDeleteProductHistoryLog={(logId) => deleteDoc(doc(db, 'productHistory', logId))} />}
        {currentView === View.INVENTORY_TRANSFER && <InventoryTransferView readOnly={recordReadOnly} inventory={inventory} stores={visibleStores} currentUser={currentUser} transfers={inventoryTransfers.filter(t => visibleStoreIds.has(t.fromStoreId) && visibleStoreIds.has(t.toStoreId) && (!recordReadOnly || t.fromStoreId === currentStoreId || t.toStoreId === currentStoreId))} onTransfer={(data) => handleInventoryTransfer(data)} onDeleteTransfer={handleDeleteTransfer} onResetBalances={handleResetBalances} />}
        {currentView === View.LAYAWAY && <LayawayView readOnly={recordReadOnly} layaways={layaways} sellers={visibleSellers} inventory={inventory} onAddPayment={handleAddPaymentToLayaway} onFulfillPreOrder={handleFulfillPreOrder} onDeleteLayaway={handleDeleteLayaway} onUpdateLayaway={handleUpdateLayaway} currentUser={currentUser} roles={visibleRoles} />}
        {currentView === View.PURCHASES && <PurchasesView purchases={purchases} inventory={inventory} allInventoryForSearch={globalInventoryForSearch.filter(p => visibleStoreIds.has(p.storeId))} categories={categories} stores={visibleStores} currentStoreId={currentStoreId || ''} onMultiStorePurchase={handleMultiStorePurchase} onUpdatePurchase={handleUpdatePurchase} onDeletePurchase={handleDeletePurchase} onUpdateProduct={handleUpdateProduct} onLoadFullHistory={() => setLoadFullPurchases(true)} isFullHistoryLoaded={loadFullPurchases} />}
        {currentView === View.SELLERS && <SellersView sellers={visibleSellers.filter(user => isOwner || user.id !== PLATFORM_OWNER_USER_ID && user.platformRole !== 'developer')} roles={visibleRoles} stores={visibleStores} onAddSeller={handleAddSeller} onUpdateSeller={handleUpdateSeller} onDeleteSeller={handleDeleteSeller} onToggleSellerStatus={handleToggleSellerStatus} isDeveloper={false} />}
        {currentView === View.STORES && <StoresView stores={visibleStores} onAddStore={handleAddStore} onUpdateStore={handleUpdateStore} onDeleteStore={handleDeleteStore} isDeveloper={isDeveloper} />}
        {currentView === View.CUSTOMERS && <CustomersView key={`${dataScope}:${currentStoreId}`} companyId={operationalCompanyId} storeId={currentStoreId || ''} sales={sales} layaways={layaways} allCustomers={customers} onBulkAddCustomers={handleBulkAddCustomers} onUpdateCustomer={handleUpdateCustomer} />}
        {currentView === View.STOCK_TAKE_HISTORY && <StockTakeHistoryView stockTakes={stockTakes} sellers={visibleSellers} onDeleteStockTake={(id) => deleteDoc(doc(db, 'stockTakes', id))} onAddNoteToStockTake={(id, note) => updateDoc(doc(db, 'stockTakes', id), { notes: arrayUnion({ content: note, author: currentUser.name, date: new Date().toISOString() }) })} onApplyStockTake={handleApplyHistoricalStockTake} currentUser={currentUser} roles={visibleRoles} />}
        {currentView === View.PAYROLL && canLoadStore && <PayrollView key={`${dataScope}:${currentStoreId}`} companyId={operationalCompanyId} sellers={visibleSellers} sales={sales} layaways={layaways} loginHistory={loginHistory} payrollHistory={payrollHistory} onSavePayroll={handleSavePayroll} onDeletePayroll={handleDeletePayroll} currentUser={currentUser} currentStore={currentStore} />}
        {currentView === View.SETTINGS && <SettingsView key={dataScope} companyId={operationalCompanyId} stores={visibleStores} allInventory={isGlobalMode ? globalInventoryForSearch.filter(p => visibleStoreIds.has(p.storeId)) : inventory} categories={categories} onSave={handleUpdateStore} onResetStoreData={() => {}} currentUser={currentUser} roles={visibleRoles} onRecompressAllProductImages={() => {}} isRecompressing={isRecompressing} recompressProgress={recompressProgress} onGenerateTestData={() => {}} onReactivateAllProducts={() => {}} />}
        {currentView === View.ROLE_MANAGER && <RoleManagerView roles={visibleRoles} onAddRole={handleAddRole} onUpdateRole={handleUpdateRole} isDeveloper={false} />}
        {currentView === View.INCIDENTS && <IncidentsView readOnly={recordReadOnly} key={`${dataScope}:${currentStoreId}`} companyId={operationalCompanyId} activeStoreId={currentStoreId || ''} incidents={incidents} inventory={inventory} currentUser={currentUser} roles={visibleRoles} sales={sales} stores={visibleStores} customers={customers} onCreateIncident={handleCreateIncident} onApproveIncident={handleApproveIncident} onResolveIncident={handleResolveIncident} onUpdateIncident={handleUpdateIncident} onDeleteIncident={handleDeleteIncident} />}
        {currentView === View.ACCOUNTING && canLoadStore && (
          <SmartAccountantView key={`${dataScope}:${currentStoreId}`}
            sales={sales} 
            layaways={layaways} 
            expenses={expenses} 
            payrollHistory={payrollHistory} 
            inventory={inventory} 
            purchases={purchases} 
            financialRecords={financialRecords}
            loans={loans}
            currentStore={currentStore} 
            currentUser={currentUser} 
            onAddExpense={handleAddExpense} 
            onUpdateExpense={handleUpdateExpense} 
            onDeleteExpense={handleDeleteExpense} 
            onAddLoan={handleAddLoan}
            onUpdateLoan={handleUpdateLoan}
            onDeleteLoan={handleDeleteLoan}
            chatMessages={accountingChatScope === `${dataScope}:${currentStoreId}` ? accountingChatHistory : []}
            onUpdateChatMessages={handleUpdateAccountingChat}
            onToggleFinancialRecordAccounting={handleToggleFinancialRecordAccounting}
            onNavigate={setCurrentView}
          />
        )}
        {currentView === View.FINANCIAL_RECONCILIATION && (
            <FinancialReconciliationView key={dataScope} companyId={operationalCompanyId} isAdmin={isAdmin}
                stores={visibleStores} 
                activeStoreId={currentStoreId || ''}
                onSetActiveStoreId={handleSwitchStore}
                sales={isAdmin ? allSales.filter(s => visibleStoreIds.has(s.storeId)) : sales} 
                layaways={isAdmin ? allLayaways.filter(l => visibleStoreIds.has(l.storeId)) : layaways} 
                expenses={expenses}
                incidents={isAdmin ? allIncidents.filter(i => visibleStoreIds.has(i.storeId)) : incidents}
                currentUser={currentUser!}
                onNavigate={setCurrentView}
                onAddExpense={handleAddExpense}
                onUpdateStore={handleUpdateStore}
            />
        )}
        {currentView === View.GIFT_VOUCHERS && currentUser && (
          <GiftVouchersView 
            vouchers={giftVouchers} 
            sellers={visibleSellers} 
            stores={visibleStores} 
            currentUser={currentUser} 
            isAdmin={isAdmin}
            onUpdateVoucherStatus={handleUpdateVoucherStatus} 
            onDeleteVoucher={handleDeleteVoucher}
            sales={sales}
          />
        )}
        {currentView === View.CEO_CENTER && currentUser && (!isCeoCenterActivated || ceoActivationScope !== dataScope) && (
          <div className="max-w-2xl mx-auto mt-10 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-8 text-center shadow-sm">
            <div className="text-4xl mb-4">💎</div>
            <h2 className="text-xl font-black text-slate-900 dark:text-white">CEO Center</h2>
            <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">El análisis está en pausa para mantener el sistema ligero. Los datos y cálculos del CEO Center solo se cargarán cuando tú los solicites.</p>
            <button onClick={() => { setCeoSelectedStoreId(currentStoreId && visibleStoreIds.has(currentStoreId) ? currentStoreId : visibleStores[0]?.id || 'all'); setCeoActivationScope(dataScope); setIsCeoCenterActivated(true); }} className="mt-6 px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-black shadow-lg">Cargar y analizar CEO Center</button>
          </div>
        )}
        {currentView === View.CEO_CENTER && currentUser && isCeoCenterActivated && ceoActivationScope === dataScope && (
          <CeoCenterView
            companyId={operationalCompanyId}
            selectedStoreId={ceoSelectedStoreId}
            onSelectStore={setCeoSelectedStoreId}
            sales={ceoSales}
            layaways={ceoLayaways}
            inventory={isAdmin ? globalInventoryForSearch.filter(p => visibleStoreIds.has(p.storeId)) : inventory}
            purchases={ceoPurchases}
            expenses={ceoExpenses}
            stores={visibleStores}
            sellers={visibleSellers}
            ceoNotes={ceoNotes}
            currentUser={currentUser}
            onAddCeoNote={handleSaveCeoNote}
            onNavigate={setCurrentView}
            categories={categories}
          />
        )}
        {currentView === View.TAG_SCANNING && currentUser && currentStore && (
          <TagScanningView
            key={`${dataScope}:${currentStoreId}`}
            inventory={inventory}
            store={currentStore}
            currentUser={currentUser}
            categories={categories}
            isAdmin={isAdmin}
          />
        )}
        {currentView === View.DEVELOPER_CENTER && isDeveloper && (
          <DeveloperCenterView
            isOwner={isOwner}
            developerGrants={developerGrants}
            onSetPlatformDeveloper={handleSetPlatformDeveloper}
            onCreatePlatformDeveloper={handleCreatePlatformDeveloper}
            companies={companies}
            stores={stores}
            sellers={sellers}
            roles={roles.filter(role => !isPlatformRole(role)).map(role => ({ ...role, permissions: role.permissions.filter(view => view !== View.DEVELOPER_CENTER) }))}
            activeCompanyId={activeCompanyId}
            onSetActiveCompanyId={handleConnectCompany}
            onCreateCompany={handleCreateCompany}
            onUpdateCompany={handleUpdateCompany}
            onDeleteCompany={handleDeleteCompany}
            onCreateStoreForCompany={handleCreateStoreForCompany}
            onUpdateStore={handleUpdateStore}
            onDeleteStore={handleDeleteStore}
            onCreateAdminUser={handleCreateAdminUser}
            onUpdateUser={handleUpdateSeller}
            onDeleteUser={handleDeleteSeller}
            onToggleUserStatus={handleToggleSellerStatus}
          />
        )}
        </Suspense>

        </AppErrorBoundary>}
      </main>
      </ViewFiltersProvider>
      {dataContextReady && settledOverlayScope === overlayScope && <React.Fragment key={overlayScope}>
      <ReportsModal key={`reports:${overlayScope}`} companyId={operationalCompanyId} isOpen={isReportsModalOpen} onClose={() => setIsReportsModalOpen(false)} allSales={allSales.filter(s => visibleStoreIds.has(s.storeId))} allInventory={globalInventoryForSearch.length > 0 ? globalInventoryForSearch.filter(p => visibleStoreIds.has(p.storeId)) : inventory} stores={visibleStores} categories={categories} />
      {showReceiptModal && saleForReceipt && <ReceiptModal sale={saleForReceipt} store={currentStore || null} company={currentCompany} onClose={() => setShowReceiptModal(false)} />}
      {currentUser && showRecaudoReceipt && lastRecaudo && lastRecaudo.storeId === currentStoreId && (!lastRecaudo.companyId || lastRecaudo.companyId === operationalCompanyId) && <RecaudoReceiptModal incident={lastRecaudo} store={currentStore || null} onClose={() => setShowRecaudoReceipt(false)} />}
      {isVerificationModalOpen && (
          <InventoryVerificationModal
              isOpen={isVerificationModalOpen}
              isLoadingInventory={isVerificationInventoryLoading}
              inventoryError={verificationInventoryError}
              isAdmin={isAdmin}
              isVendedor={isVendedor}
              currentStore={currentStore}
              onClose={() => setIsVerificationModalOpen(false)}
              inventory={inventory}
              categories={categories}
              sellers={visibleSellers}
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
      </React.Fragment>}
    </div>
  );
};

export default App;

// VERSION: 1.1.54
