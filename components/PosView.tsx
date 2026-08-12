import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Product, CartItem, PaymentMethod, HeldCart, Category, Seller, StockTake, Sale, DailyNote, CeoDailyNote, Layaway, View, Store, Incident, IncidentType, IncidentStatus, Role, Customer, Payment, Purchase, GiftVoucher } from '../types';
import ProductGrid from './ProductGrid';
import ProductPerformanceModal from './ProductPerformanceModal';
import CartPanel from './CartPanel';
import DailySalesReportModal from './DailySalesReportModal';
import { ClipboardListIcon, ChartBarIcon, SearchIcon, AlertTriangleIcon, ShoppingCartIcon, CrossIcon, TruckIcon, SparklesIcon } from './Icons';
import CreateIncidentModal from './CreateIncidentModal';
import EditProductImageModal from './EditProductImageModal';
import SellVoucherModal from './SellVoucherModal';
import CheckVoucherModal from './CheckVoucherModal';
import { formatCOP, normalizeText } from '../constants';
import EditProductModal from './EditProductModal';

interface PosViewProps {
  inventory: Product[];
  categories: Category[];
  sellers: Seller[];
  stores: Store[];
  sales: Sale[];
  purchases: Purchase[];
  layaways: Layaway[];
  allCustomers: Customer[];
  activeCart: CartItem[];
  heldCarts: HeldCart[];
  onAddToCart: (product: Product) => void;
  onUpdateCartQuantity: (productId: string, newQuantity: number) => void;
  onUpdateCartItemPrice: (productId: string, newPrice: number) => void;
  onRemoveFromCart: (productId: string) => void;
  onClearCart: () => void;
  onProcessSale: (saleData: { payments: Payment[]; customerName: string; customerPhone: string; seller: string; discountPercent?: number; discountAmount?: number; }, saleDate: Date) => void;
  onHoldSale: (data?: { customer?: { name: string; phone: string }; sellerName?: string; }) => void;
  onResumeSale: (heldCartId: string) => void;
  onCreateLayaway: (customerName: string, customerPhone: string, invoiceNumber: string, seller: string, initialPayment: { amount: number; method: PaymentMethod; }, saleDate: Date, isPreOrder: boolean, description?: string) => void;
  onSaveStockTake: (stockTakeData: Omit<StockTake, 'id' | 'createdAt' | 'storeId'>, applyNow: boolean) => void;
  dailyNotes: DailyNote[];
  onAddDailyNote: (content: string, seller: string) => void;
  onNavigate: (view: View) => void;
  currentStore: Store | undefined;
  incidents: Incident[];
  onCreateIncident: (data: Omit<Incident, 'id' | 'status' | 'createdAt' | 'storeId' | 'sellerName'> & { surplusPaid?: number; incidentDate?: string; }) => void;
  currentUser: Seller;
  roles: Role[];
  nextInvoiceNumber: number;
  onUpdateProduct: (updatedProduct: Product, imageFile?: File) => Promise<void>;
  verifiedProducts: Set<string>;
  onToggleProductVerification: (productId: string) => void;
  onClearVerifications: () => void;
  onSaveDetailedDraft: (categoryId: string, counts: Record<string, number>) => Promise<void>;
  onApplyDetailedVerification: (categoryId: string, counts: Record<string, number>) => Promise<void>;
  onUpdateStoreSettings: (updatedStore: Store) => Promise<void>;
  onOpenVerification: () => void;
  giftVouchers: GiftVoucher[];
  onCreateGiftVoucher: (voucher: Omit<GiftVoucher, 'id'>) => Promise<void>;
  onUpdateGiftVoucher: (voucherId: string, updates: Partial<GiftVoucher>) => Promise<void>;
  onRegenerateAllSkus?: () => Promise<void>;
  ceoNotes: CeoDailyNote[];
  onAddCeoNote: (data: Omit<CeoDailyNote, 'id' | 'createdAt'>) => Promise<void>;
}

const PosView: React.FC<PosViewProps> = (props) => {
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [businessSortMode, setBusinessSortMode] = useState<'inteligente' | 'tendencias' | 'recompra' | 'alfabetico'>('inteligente');
  const [searchTerm, setSearchTerm] = useState('');
  const [isSalesReportModalOpen, setIsSalesReportModalOpen] = useState(false);
  const [isIncidentModalOpen, setIsIncidentModalOpen] = useState(false);
  const [isSellVoucherModalOpen, setIsSellVoucherModalOpen] = useState(false);
  const [isCheckVoucherModalOpen, setIsCheckVoucherModalOpen] = useState(false);
  const [editingProductImage, setEditingProductImage] = useState<Product | null>(null);
  const [editingProductDetails, setEditingProductDetails] = useState<Product | null>(null);
  const [performanceProduct, setPerformanceProduct] = useState<Product | null>(null);
  const [saleDate, setSaleDate] = useState(new Date());
  const [justAddedProductId, setJustAddedProductId] = useState<string | null>(null);
  const [isCartPulsing, setIsCartPulsing] = useState(false);
  const [isMobileCartOpen, setIsMobileCartOpen] = useState(false);
  const [customerInfo, setCustomerInfo] = useState<{name: string, phone: string} | null>(null);
  
  const [isCeoNoteModalOpen, setIsCeoNoteModalOpen] = useState(false);
  const [energyLevel, setEnergyLevel] = useState<'green' | 'yellow' | 'red' | null>(null);
  const [energyObservation, setEnergyObservation] = useState('');
  const [customerQuestion, setCustomerQuestion] = useState('');
  const [isSubmittingCeoNote, setIsSubmittingCeoNote] = useState(false);
  const [isControlPanelCollapsed, setIsControlPanelCollapsed] = useState(true);

  const handleAddCeoDailyNotes = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!energyLevel && !customerQuestion.trim()) {
      alert("Por favor selecciona un nivel de energía o escribe una pregunta de cliente.");
      return;
    }
    if (energyLevel && energyObservation.length > 100) {
      alert("La observación de energía no puede superar los 100 caracteres.");
      return;
    }

    setIsSubmittingCeoNote(true);
    try {
      if (energyLevel) {
        await props.onAddCeoNote({
          fecha: new Date().toISOString().split('T')[0],
          tienda: props.currentStore?.id || 'all',
          energia: energyLevel,
          observacion: energyObservation.trim(),
          usuario: props.currentUser.name
        });
      }
      if (customerQuestion.trim()) {
        await props.onAddCeoNote({
          fecha: new Date().toISOString().split('T')[0],
          tienda: props.currentStore?.id || 'all',
          pregunta_cliente: customerQuestion.trim(),
          usuario: props.currentUser.name
        });
      }
      setEnergyLevel(null);
      setEnergyObservation('');
      setCustomerQuestion('');
      setIsCeoNoteModalOpen(false);
      alert("¡Registro diario enviado con éxito al CEO Center!");
    } catch (err) {
      console.error("Error saving daily note:", err);
      alert("Hubo un error al registrar las notas.");
    } finally {
      setIsSubmittingCeoNote(false);
    }
  };

  const barcodeBufferRef = useRef('');
  const searchInputRef = useRef<HTMLInputElement>(null);
  const lastKeyTimeRef = useRef<number>(0);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const { onClearVerifications } = props;

  useEffect(() => {
    // Auto-focus search input on mount
    searchInputRef.current?.focus();
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const now = Date.now();
      const diff = now - lastKeyTimeRef.current;
      lastKeyTimeRef.current = now;

      const isInput = 
        e.target instanceof HTMLInputElement || 
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement ||
        (e.target instanceof HTMLElement && e.target.isContentEditable);
      const isSearchInput = e.target === searchInputRef.current;
      
      if (isInput && !isSearchInput) {
        return;
      }
      
      if (e.key === 'Enter') {
        const buffer = barcodeBufferRef.current;
        if (buffer.length > 2) {
          const product = props.inventory.find(p => p.sku === buffer);
          if (product && product.stock > 0 && !product.isDisabled) {
            handleAddToCartWithAnimation(product);
            barcodeBufferRef.current = '';
            e.preventDefault();
            searchInputRef.current?.focus();
            return;
          }
        }
        barcodeBufferRef.current = '';
      } else if (e.key.length === 1) {
        if (!isSearchInput) {
          let key = e.key;
          if (key === "'" || key === ",") key = "-";

          if (diff < 40 && isInput && barcodeBufferRef.current.length > 0) {
            searchInputRef.current?.focus();
            setSearchTerm(barcodeBufferRef.current + key);
            barcodeBufferRef.current = '';
          } else {
            barcodeBufferRef.current += key;
          }
          
          if (timeoutRef.current) clearTimeout(timeoutRef.current);
          timeoutRef.current = setTimeout(() => {
            barcodeBufferRef.current = '';
          }, 150);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [props.inventory]);

  useEffect(() => {
    return () => {
      onClearVerifications();
    };
  }, [onClearVerifications]);

  const adminRole = useMemo(() => props.roles.find(r => r.name === 'Administrator'), [props.roles]);
  const isAdmin = useMemo(() => props.currentUser.roleId === adminRole?.id, [props.currentUser, adminRole]);
  
  const handleClearTransaction = () => {
    props.onClearCart();
    setCustomerInfo(null);
  };

  const handleProcessSaleTransaction = (saleData: { payments: Payment[]; customerName: string; customerPhone: string; seller: string; discountPercent?: number; discountAmount?: number; }, selectedDate: Date) => {
    const now = new Date();
    const finalDate = (selectedDate.toDateString() === now.toDateString()) ? now : selectedDate;
    props.onProcessSale(saleData, finalDate);
    setCustomerInfo(null);
  };

  const handleHoldSaleTransaction = (data?: { customer?: { name: string; phone: string }; sellerName?: string; }) => {
    props.onHoldSale(data);
    setCustomerInfo(null);
  };

  const handleCreateLayawayTransaction = (customerName: string, customerPhone: string, invoiceNumber: string, seller: string, initialPayment: { amount: number; method: PaymentMethod; }, selectedDate: Date, isPreOrder: boolean, description?: string) => {
    const now = new Date();
    const finalDate = (selectedDate.toDateString() === now.toDateString()) ? now : selectedDate;
    props.onCreateLayaway(customerName, customerPhone, invoiceNumber, seller, initialPayment, finalDate, isPreOrder, description);
    setCustomerInfo(null);
  };

  const handleResumeSaleTransaction = (heldCart: HeldCart) => {
    if (heldCart.customerName && heldCart.customerPhone) {
        setCustomerInfo({ name: heldCart.customerName, phone: heldCart.customerPhone });
    } else {
        setCustomerInfo(null);
    }
    props.onResumeSale(heldCart.id);
  };

  const newArrivalsInventory = useMemo(() => {
      const sortedPurchases = [...props.purchases].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      const uniqueProductIds = Array.from(new Set(sortedPurchases.map(p => p.productId)));
      const recentProductIds = uniqueProductIds.slice(0, 24); 

      return recentProductIds.map(id => 
          props.inventory.find(p => p.id === id)
      ).filter((p): p is Product => !!p && p.stock > 0 && !p.isDisabled);
  }, [props.purchases, props.inventory]);

  const categoriesWithStock = useMemo(() => {
      const NOVEDADES_CATEGORY_ID = 'novedades';
      const DESCUENTOS_CATEGORY_ID = 'descuentos';
      const novedadesCategory: Category = { id: NOVEDADES_CATEGORY_ID, name: '✨ Novedades' };
      const descuentosCategory: Category = { id: DESCUENTOS_CATEGORY_ID, name: '🏷️ Descuentos %' };
  
      const stockedCategoryIds = new Set(
          props.inventory.filter(p => p.stock > 0 && !p.isDisabled).map(p => p.categoryId)
      );
      const regularCategories = props.categories.filter(cat => stockedCategoryIds.has(cat.id));
      
      const hasDiscounts = props.inventory.some(p => p.discountPrice !== undefined && p.discountPrice !== p.price && p.stock > 0 && !p.isDisabled);
      
      const extraCategories: Category[] = [];
      if (newArrivalsInventory.length > 0) extraCategories.push(novedadesCategory);
      if (hasDiscounts) extraCategories.push(descuentosCategory);

      return [...extraCategories, ...regularCategories];
    }, [props.inventory, props.categories, newArrivalsInventory]);

  const totalItems = useMemo(() => props.activeCart.reduce((sum, item) => sum + item.quantity, 0), [props.activeCart]);
  const totalPrice = useMemo(() => props.activeCart.reduce((sum, item) => sum + item.price * item.quantity, 0), [props.activeCart]);

  const handleClearCartWithClose = () => {
    handleClearTransaction();
    setIsMobileCartOpen(false);
  };

  const handleProcessSaleWithClose = (saleData: { payments: Payment[]; customerName: string; customerPhone: string; seller: string; discountPercent?: number; discountAmount?: number; }, currentSaleDate: Date) => {
      handleProcessSaleTransaction(saleData, currentSaleDate);
      setIsMobileCartOpen(false);
  };

  const handleHoldSaleWithClose = (data?: { customer?: { name: string; phone: string }; sellerName?: string; }) => {
      handleHoldSaleTransaction(data);
      setIsMobileCartOpen(false);
  };
  
  const handleResumeSaleWithClose = (heldCart: HeldCart) => {
    handleResumeSaleTransaction(heldCart);
    setIsMobileCartOpen(true); 
  };

  const handleCreateLayawayWithClose = (customerName: string, customerPhone: string, invoiceNumber: string, seller: string, initialPayment: { amount: number; method: PaymentMethod; }, currentSaleDate: Date, isPreOrder: boolean, description?: string) => {
      handleCreateLayawayTransaction(customerName, customerPhone, invoiceNumber, seller, initialPayment, currentSaleDate, isPreOrder, description);
      setIsMobileCartOpen(false);
  };

  const handleAddToCartWithAnimation = (product: Product) => {
    props.onAddToCart(product);
    setJustAddedProductId(product.id);
    setIsCartPulsing(true);
    setSearchTerm(''); 

    if (searchInputRef.current) {
      searchInputRef.current.value = '';
      searchInputRef.current.focus();
    }

    setTimeout(() => {
      if (searchInputRef.current) {
        searchInputRef.current.value = '';
        searchInputRef.current.focus();
      }
    }, 30);

    setTimeout(() => {
      setJustAddedProductId(null);
      setIsCartPulsing(false);
    }, 700);
  };

  // Efecto para buscar y añadir automáticamente un producto al detectar coincidencia exacta del SKU/Código de barras
  useEffect(() => {
    const trimmed = searchTerm.trim();
    if (trimmed.length >= 3) {
      const normalizedTerm = normalizeText(trimmed);
      const product = props.inventory.find(p => 
        p.sku && normalizeText(p.sku) === normalizedTerm
      );
      if (product && product.stock > 0 && !product.isDisabled) {
        handleAddToCartWithAnimation(product);
      }
    }
  }, [searchTerm, props.inventory]);

  const pendingPreOrders = useMemo(() => {
    return props.layaways.filter(l => l.status === 'pre-order');
  }, [props.layaways]);

  const { pendingApprovals, activeWarranties } = useMemo(() => {
      const approvals = props.incidents.filter(i => 
        i.status === IncidentStatus.DAÑADO_REPORTADO || 
        i.status === IncidentStatus.CAMBIO_SOLICITADO
      );
      const warranties = props.incidents.filter(i => i.status === IncidentStatus.WARRANTY_ACTIVE);
      return { pendingApprovals: approvals, activeWarranties: warranties };
  }, [props.incidents]);

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const dateString = e.target.value; 
    if (dateString) {
      const now = new Date();
      const [year, month, day] = dateString.split('-').map(Number);
      const newSaleDate = new Date(year, month - 1, day, now.getHours(), now.getMinutes(), now.getSeconds());
      setSaleDate(newSaleDate);
    } else {
      setSaleDate(new Date());
    }
  };

  const toYYYYMMDD = (date: Date) => {
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

    const { filteredInventory, performanceTrends, recentSalesMap, trendingProductIds } = useMemo(() => {
      const NOVEDADES_CATEGORY_ID = 'novedades';
      const DESCUENTOS_CATEGORY_ID = 'descuentos';
      
      // Calculate performance trends
      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

      const trends: Record<string, 'up' | 'down' | 'stable'> = {};
      const recentSalesMap: Record<string, number> = {};
      const previousSalesMap: Record<string, number> = {};

      props.sales.forEach(sale => {
          const saleDate = new Date(sale.createdAt);
          if (saleDate >= thirtyDaysAgo) {
              sale.items.forEach(item => {
                  recentSalesMap[item.id] = (recentSalesMap[item.id] || 0) + item.quantity;
              });
          } else if (saleDate >= sixtyDaysAgo) {
              sale.items.forEach(item => {
                  previousSalesMap[item.id] = (previousSalesMap[item.id] || 0) + item.quantity;
              });
          }
      });

      props.inventory.forEach(p => {
          const recent = recentSalesMap[p.id] || 0;
          const previous = previousSalesMap[p.id] || 0;
          if (recent > previous) trends[p.id] = 'up';
          else if (recent < previous) trends[p.id] = 'down';
          else trends[p.id] = 'stable';
      });

      // Calculate trending products (percentil superior 80% of products with active sales in last 30 days)
      const nonZeroQuantities = Object.values(recentSalesMap).filter(qty => qty > 0).sort((a, b) => a - b);
      let threshold = Infinity;
      if (nonZeroQuantities.length > 0) {
          const pctIndex = Math.floor(nonZeroQuantities.length * 0.8);
          threshold = nonZeroQuantities[pctIndex];
      }
      const trendingProductIds = new Set<string>();
      props.inventory.forEach(p => {
          const qty = recentSalesMap[p.id] || 0;
          if (qty > 0 && qty >= threshold) {
              trendingProductIds.add(p.id);
          }
      });
  
      let result: Product[] = [];

      const normalizedSearch = normalizeText(searchTerm);

      if (selectedCategoryId === NOVEDADES_CATEGORY_ID) {
          result = newArrivalsInventory.filter(p => {
              const matchesSearch = normalizedSearch
                  ? normalizeText(p.name).includes(normalizedSearch) ||
                    (p.supplier && normalizeText(p.supplier).includes(normalizedSearch)) ||
                    normalizeText(p.sku).includes(normalizedSearch)
                  : true;
              const isExactSkuMatch = p.sku && normalizeText(p.sku) === normalizedSearch;
              return isExactSkuMatch || matchesSearch;
          });
      } else if (selectedCategoryId === DESCUENTOS_CATEGORY_ID) {
          result = props.inventory.filter(p => {
              const matchesDiscount = p.discountPrice !== undefined && p.discountPrice !== p.price && p.stock > 0 && !p.isDisabled;
              const normalizedSku = normalizeText(p.sku);
              const isExactSkuMatch = p.sku && normalizedSku === normalizedSearch;
              
              const matchesSearch = normalizedSearch
                  ? normalizeText(p.name).includes(normalizedSearch) ||
                    (p.supplier && normalizeText(p.supplier).includes(normalizedSearch)) ||
                    normalizedSku.includes(normalizedSearch)
                  : true;
              return isExactSkuMatch || (matchesDiscount && matchesSearch);
          });
      } else {
          result = props.inventory
            .filter(p => {
              if (p.isDisabled) return false;
              const normalizedSku = normalizeText(p.sku);
              const isExactSkuMatch = p.sku && normalizedSku === normalizedSearch;
              
              const matchesCategory = selectedCategoryId ? p.categoryId === selectedCategoryId : true;
              const matchesSearch = normalizedSearch
                ? normalizeText(p.name).includes(normalizedSearch) ||
                  (p.supplier && normalizeText(p.supplier).includes(normalizedSearch)) ||
                  normalizedSku.includes(normalizedSearch)
                : true;
              return isExactSkuMatch || (matchesCategory && matchesSearch);
            });
      }

      const sortedResult = [...result].sort((a, b) => {
          const isAOutOfStock = a.stock <= 0;
          const isBOutOfStock = b.stock <= 0;

          // Out-of-stock items go to the bottom for normal sellers OR when Alfabético is active
          const forceOutOfStockToBottom = !isAdmin || businessSortMode === 'alfabetico';

          if (forceOutOfStockToBottom) {
              if (!isAOutOfStock && isBOutOfStock) return -1;
              if (isAOutOfStock && !isBOutOfStock) return 1;
          }

          if (isAdmin) {
              const salesA = recentSalesMap[a.id] || 0;
              const salesB = recentSalesMap[b.id] || 0;

              if (businessSortMode === 'inteligente') {
                  // Hybrid scoring: recent sales * 10, with extra bonuses for low stock & out-of-stock with active demand
                  const getIntelligentScore = (p: Product) => {
                      const sales = recentSalesMap[p.id] || 0;
                      if (sales === 0) return 0;
                      let score = sales * 10;
                      if (p.stock > 0 && p.stock <= 2) {
                          score += 150; // High priority: popular items almost sold out
                      } else if (p.stock <= 0) {
                          score += 80;  // High priority: out of stock with high demand for admin replenishment
                      }
                      return score;
                  };

                  const scoreA = getIntelligentScore(a);
                  const scoreB = getIntelligentScore(b);
                  if (scoreA !== scoreB) return scoreB - scoreA;
              } else if (businessSortMode === 'tendencias') {
                  if (salesA !== salesB) return salesB - salesA;
              } else if (businessSortMode === 'recompra') {
                  // Highlight critical stock (<= 2) that has active demand (recent sales > 0)
                  const isRecompraA = a.stock <= 2 && salesA > 0;
                  const isRecompraB = b.stock <= 2 && salesB > 0;

                  if (isRecompraA && !isRecompraB) return -1;
                  if (!isRecompraA && isRecompraB) return 1;
                  if (isRecompraA && isRecompraB) {
                      if (salesA !== salesB) return salesB - salesA;
                  }
              }
          }

          return a.name.localeCompare(b.name);
      });

      return { 
          filteredInventory: sortedResult, 
          performanceTrends: trends, 
          recentSalesMap, 
          trendingProductIds 
      };
  }, [props.inventory, selectedCategoryId, searchTerm, newArrivalsInventory, isAdmin, props.sales, businessSortMode]);

  const commonButtonClasses = "px-3 py-1.5 text-sm font-bold transition-colors duration-300 rounded-full";
  const activeButtonClasses = "bg-accent text-white shadow-md shadow-accent/30";
  const inactiveButtonClasses = "bg-white dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700/80 hover:text-slate-800 dark:hover:text-slate-200";
  
  const CartAndActionsContent = ({ isMobile = false }) => (
    <div className="space-y-3">
        {/* Quick link to Tag Scanning Audit */}
        <div className="bg-indigo-100 dark:bg-indigo-900/70 border border-indigo-500/50 text-indigo-700 dark:text-indigo-300 p-2.5 rounded-xl shadow-sm" role="alert">
            <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                    <span className="text-base flex-shrink-0">🏷️</span>
                    <div className="text-[11px] leading-tight min-w-0">
                        <p className="font-black uppercase tracking-tight text-indigo-800 dark:text-indigo-200">Auditoría de Prendas</p>
                        <p className="opacity-90 truncate text-[9px]">Escanear y descartar prendas para hallar sin etiquetas.</p>
                    </div>
                </div>
                <button
                    onClick={() => props.onNavigate(View.TAG_SCANNING)}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white font-black py-1 px-2.5 text-[9px] uppercase tracking-wider rounded-lg flex-shrink-0 transition-all shadow-sm shadow-indigo-600/10"
                >
                    Comenzar
                </button>
            </div>
        </div>

        {(pendingApprovals.length > 0 || activeWarranties.length > 0 || pendingPreOrders.length > 0) && (
            <div className="space-y-2">
                {(pendingApprovals.length > 0 || activeWarranties.length > 0) && (
                    <div className="bg-orange-100 dark:bg-orange-900/70 border border-orange-500/50 text-orange-700 dark:text-orange-300 p-2 rounded-lg" role="alert">
                        <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                                <AlertTriangleIcon className="w-5 h-5 text-orange-500 flex-shrink-0" />
                                <div className="text-xs">
                                    {pendingApprovals.length > 0 && <p><strong>{pendingApprovals.length}</strong> aprobación(es) pendiente(s).</p>}
                                    {activeWarranties.length > 0 && <p><strong>{activeWarranties.length}</strong> garantía(s) activa(s).</p>}
                                </div>
                            </div>
                            <button
                                onClick={() => props.onNavigate(View.INCIDENTS)}
                                className="bg-orange-500 text-white font-bold py-1 px-2 text-xs rounded-md hover:bg-orange-600 flex-shrink-0"
                            >
                                Ver
                            </button>
                        </div>
                    </div>
                )}
                {pendingPreOrders.length > 0 && (
                  <div className="bg-yellow-100 dark:bg-yellow-900/70 border border-yellow-500/50 text-yellow-700 dark:text-yellow-300 p-2 rounded-lg" role="alert">
                      <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                              <TruckIcon className="w-5 h-5 text-yellow-500 flex-shrink-0" />
                              <p className="text-xs"><strong>{pendingPreOrders.length}</strong> encargo(s) por recibir.</p>
                          </div>
                          <button
                              onClick={() => props.onNavigate(View.LAYAWAY)}
                              className="bg-yellow-500 text-white font-bold py-1 px-2 text-xs rounded-md hover:bg-yellow-600 flex-shrink-0"
                          >
                              Ver
                          </button>
                      </div>
                  </div>
                )}
            </div>
        )}
        {props.heldCarts.length > 0 && (
          <div className="bg-white dark:bg-slate-900/75 dark:backdrop-blur-xl dark:border dark:border-slate-800 p-3 rounded-xl shadow-lg">
              <h3 className="text-base font-bold text-accent mb-2">Ventas en Espera</h3>
              <div className="flex flex-wrap gap-2">
                  {props.heldCarts.map((cart, index) => {
                      const identifier = cart.sellerName || `Venta ${index + 1}`;
                      return (
                          <button 
                              key={cart.id} 
                              onClick={() => isMobile ? handleResumeSaleWithClose(cart) : handleResumeSaleTransaction(cart)}
                              className="bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-300 px-3 py-1.5 text-sm rounded-md hover:bg-accent hover:text-white dark:hover:text-white transition-colors"
                              title={cart.customerName ? `Cliente: ${cart.customerName}`: ''}
                          >
                              Retomar {identifier} ({cart.items.length} items)
                          </button>
                      )
                  })}
              </div>
          </div>
        )}
        <div className="bg-white dark:bg-slate-900/75 dark:backdrop-blur-xl dark:border dark:border-slate-800 rounded-2xl shadow-lg border border-slate-100 dark:border-slate-800 overflow-hidden">
            {/* Cabecera colapsable */}
            <button 
                onClick={() => setIsControlPanelCollapsed(!isControlPanelCollapsed)}
                className="w-full flex items-center justify-between p-3 text-left hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
                type="button"
            >
                <div className="flex items-center gap-2">
                    <span className="text-sm">⚙️</span>
                    <span className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">Panel de Control POS</span>
                </div>
                <span className="text-[10px] font-bold text-accent bg-accent/10 px-2 py-0.5 rounded-full select-none">
                    {isControlPanelCollapsed ? 'Ver opciones ▾' : 'Ocultar ▴'}
                </span>
            </button>

            {!isControlPanelCollapsed && (
                <div className="p-3 pt-1 border-t border-slate-100 dark:border-slate-800/50 space-y-3.5 animate-fade-in">
                    {/* Fecha de venta */}
                    <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
                        <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500">Fecha de Venta</span>
                        <div className="flex items-center gap-1.5">
                            <input
                                type="date"
                                id="saleDate"
                                value={toYYYYMMDD(saleDate)}
                                onChange={handleDateChange}
                                className="bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-full py-0.5 px-2.5 text-xs font-bold text-slate-700 dark:text-slate-200 focus:ring-2 focus:ring-accent focus:border-accent outline-none disabled:opacity-70 disabled:cursor-not-allowed"
                                aria-label="Fecha de Venta"
                                disabled={!isAdmin}
                            />
                        </div>
                    </div>

                    {/* Enlaces de financiación */}
                    <div className="space-y-1">
                        <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500">Enlaces de Financiación / Créditos</span>
                        <div className="grid grid-cols-2 gap-2">
                            <a 
                                href={props.currentStore?.addiLink} 
                                target="_blank" 
                                rel="noopener noreferrer" 
                                className="bg-emerald-600 hover:bg-emerald-700 text-white font-black py-2 px-2.5 rounded-xl flex items-center justify-center gap-1 text-[10px] uppercase tracking-wider transition-all duration-200 shadow-sm border border-emerald-500/10 text-center"
                            >
                                <span>Portal Addi ↗</span>
                            </a>
                            <a 
                                href={props.currentStore?.sistecreditoLink} 
                                target="_blank" 
                                rel="noopener noreferrer" 
                                className="bg-indigo-600 hover:bg-indigo-700 text-white font-black py-2 px-2.5 rounded-xl flex items-center justify-center gap-1 text-[10px] uppercase tracking-wider transition-all duration-200 shadow-sm border border-indigo-500/10 text-center"
                            >
                                <span>Sistecredito ↗</span>
                            </a>
                        </div>
                    </div>

                    {/* Operaciones de tienda */}
                    <div className="space-y-1">
                        <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500">Operaciones de Tienda</span>
                        <div className="grid grid-cols-2 gap-2">
                            <button 
                                onClick={props.onOpenVerification} 
                                className="bg-blue-50/70 hover:bg-blue-500 hover:text-white dark:bg-slate-800/50 dark:hover:bg-blue-650 text-blue-600 dark:text-blue-400 font-bold py-2 px-2 rounded-xl flex items-center justify-center gap-1 text-[9px] uppercase tracking-wider transition-all border border-blue-200/50 dark:border-slate-700 text-center"
                                type="button"
                            >
                                <ClipboardListIcon className="w-4 h-4 shrink-0" />
                                <span>Verificar Inventario</span>
                            </button>
                            <button 
                                onClick={() => setIsCeoNoteModalOpen(true)} 
                                className="bg-pink-50/70 hover:bg-pink-500 hover:text-white dark:bg-slate-800/50 dark:hover:bg-pink-650 text-pink-600 dark:text-pink-400 font-bold py-2 px-2 rounded-xl flex items-center justify-center gap-1 text-[9px] uppercase tracking-wider transition-all border border-pink-200/50 dark:border-slate-700 text-center"
                                type="button"
                            >
                                <SparklesIcon className="w-4 h-4 shrink-0" />
                                <span>Registro CEO</span>
                            </button>
                            <button 
                                onClick={() => setIsIncidentModalOpen(true)} 
                                className="bg-orange-50/70 hover:bg-orange-500 hover:text-white dark:bg-slate-800/50 dark:hover:bg-orange-650 text-orange-600 dark:text-orange-400 font-bold py-2 px-2 rounded-xl flex items-center justify-center gap-1 text-[9px] uppercase tracking-wider transition-all border border-orange-200/50 dark:border-slate-700 text-center"
                                type="button"
                            >
                                <AlertTriangleIcon className="w-4 h-4 shrink-0" />
                                <span>Novedades</span>
                            </button>
                            <button 
                                onClick={() => setIsSalesReportModalOpen(true)} 
                                className="bg-teal-50/70 hover:bg-teal-500 hover:text-white dark:bg-slate-800/50 dark:hover:bg-teal-650 text-teal-600 dark:text-teal-400 font-bold py-2 px-2 rounded-xl flex items-center justify-center gap-1 text-[9px] uppercase tracking-wider transition-all border border-teal-200/50 dark:border-slate-700 text-center"
                                type="button"
                            >
                                <ChartBarIcon className="w-4 h-4 shrink-0" />
                                <span>Reporte Diario</span>
                            </button>
                        </div>
                    </div>

                    {/* Bonos de regalo */}
                    <div className="space-y-1">
                        <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500">Bonos de Regalo</span>
                        <div className="grid grid-cols-2 gap-2">
                            <button 
                                onClick={() => setIsSellVoucherModalOpen(true)} 
                                className="bg-purple-50/70 hover:bg-purple-500 hover:text-white dark:bg-slate-800/50 dark:hover:bg-purple-650 text-purple-600 dark:text-purple-400 font-bold py-2 px-2 rounded-xl flex items-center justify-center gap-1 text-[9px] uppercase tracking-wider transition-all border border-purple-200/50 dark:border-slate-700/50 text-center"
                                type="button"
                            >
                                <ShoppingCartIcon className="w-4 h-4 shrink-0" />
                                <span>Vender Bono</span>
                            </button>
                            <button 
                                onClick={() => setIsCheckVoucherModalOpen(true)} 
                                className="bg-slate-100 hover:bg-slate-200 dark:bg-slate-800/50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold py-2 px-2 rounded-xl flex items-center justify-center gap-1 text-[9px] uppercase tracking-wider transition-all border border-slate-200/50 dark:border-slate-700/80 text-center"
                                type="button"
                            >
                                <SearchIcon className="w-4 h-4 shrink-0" />
                                <span>Consultar Bono</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
        <CartPanel
            cartItems={props.activeCart}
            sellers={props.sellers}
            customers={props.allCustomers}
            onUpdateQuantity={props.onUpdateCartQuantity}
            onUpdateCartItemPrice={props.onUpdateCartItemPrice}
            onRemoveFromCart={props.onRemoveFromCart}
            onClearCart={isMobile ? handleClearCartWithClose : handleClearTransaction}
            onProcessSale={isMobile ? handleProcessSaleWithClose : handleProcessSaleTransaction}
            onHoldSale={isMobile ? handleHoldSaleWithClose : handleHoldSaleTransaction}
            onCreateLayaway={isMobile ? handleCreateLayawayWithClose : handleCreateLayawayTransaction}
            saleDate={saleDate}
            nextInvoiceNumber={props.nextInvoiceNumber}
            isCartPulsing={isCartPulsing}
            initialCustomerInfo={customerInfo}
            currentStore={props.currentStore}
            giftVouchers={props.giftVouchers}
            onUpdateGiftVoucher={props.onUpdateGiftVoucher}
        />
    </div>
  );

  return (
    <div className="p-4 h-full">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="lg:col-span-8 xl:col-span-9 h-[calc(100vh-68px)] sticky top-[60px] pb-24 lg:pb-0" id="product-grid-container">
            <div className="bg-white/80 dark:bg-slate-900/75 backdrop-blur-xl border border-slate-200 dark:border-slate-800 p-3 rounded-xl shadow-lg flex flex-col h-full">
                <div className="flex-shrink-0">
                    <div className="space-y-3 mb-3">
                        <div className="relative w-full">
                            <input 
                                ref={searchInputRef}
                                type="text"
                                placeholder="Buscar por nombre o proveedor..."
                                value={searchTerm}
                                onChange={e => {
                                    let val = e.target.value;
                                    // Corrección para escáneres con configuración de teclado incorrecta
                                    // Reemplazamos comilla simple o coma por guion si parece ser un SKU
                                    val = val.replace(/[']/g, '-').replace(/[,]/g, '-');
                                    setSearchTerm(val);
                                }}
                                onKeyDown={e => {
                                    const trimmedSearch = searchTerm.trim();
                                    if (e.key === 'Enter') {
                                        e.preventDefault();
                                        if (trimmedSearch.length > 0) {
                                            const normalizedTerm = normalizeText(trimmedSearch);
                                            // 1. Buscar coincidencia de SKU exacta (Código de barras)
                                            let product = props.inventory.find(p => 
                                                p.sku && normalizeText(p.sku) === normalizedTerm
                                            );
                                            
                                            // 2. Buscar por ID de producto exacto
                                            if (!product) {
                                                product = props.inventory.find(p => 
                                                    p.id === trimmedSearch
                                                );
                                            }
                                            
                                            // 3. Buscar si hay una sola coincidencia exacta en los resultados visibles y está en stock
                                            if (!product && filteredInventory.length === 1) {
                                                const candidate = filteredInventory[0];
                                                if (candidate.stock > 0 && !candidate.isDisabled) {
                                                    product = candidate;
                                                }
                                            }
                                            
                                            if (product && product.stock > 0 && !product.isDisabled) {
                                                handleAddToCartWithAnimation(product);
                                            } else {
                                                // Si no coincide o no hay stock, limpiar el buscador para permitir intentar una nueva búsqueda/escaneo
                                                setSearchTerm('');
                                                if (searchInputRef.current) {
                                                    searchInputRef.current.value = '';
                                                    searchInputRef.current.focus();
                                                }
                                            }
                                        }
                                    }
                                }}
                                className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-full py-2 px-4 pl-10 pr-10 focus:ring-2 focus:ring-accent focus:border-accent outline-none"
                            />
                            <div className="absolute top-0 left-0 inline-flex items-center justify-center h-full w-10 text-slate-400">
                                <SearchIcon />
                            </div>
                            {searchTerm && (
                                <button
                                    onClick={() => {
                                        setSearchTerm('');
                                        searchInputRef.current?.focus();
                                    }}
                                    className="absolute top-0 right-0 inline-flex items-center justify-center h-full w-10 text-gray-500 hover:text-gray-800 dark:hover:text-white"
                                    aria-label="Limpiar búsqueda"
                                >
                                    <CrossIcon className="w-5 h-5" />
                                </button>
                            )}
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5">
                            <span className="text-sm font-semibold text-slate-500 dark:text-slate-400 mr-2">Categorías:</span>
                            <button
                                onClick={() => setSelectedCategoryId(null)}
                                className={`${commonButtonClasses} ${selectedCategoryId === null ? activeButtonClasses : inactiveButtonClasses}`}
                            >
                                Todos
                            </button>
                            {categoriesWithStock.map(cat => (
                                <button
                                    key={cat.id}
                                    onClick={() => setSelectedCategoryId(cat.id)}
                                    className={`${commonButtonClasses} ${selectedCategoryId === cat.id ? activeButtonClasses : inactiveButtonClasses}`}
                                >
                                    {cat.name}
                                </button>
                            ))}
                        </div>
                        {isAdmin && (
                            <div className="flex flex-wrap items-center gap-1.5 pt-1.5 border-t border-slate-200/30 dark:border-slate-800/30">
                                <span className="text-xs font-black text-slate-500 dark:text-slate-400 mr-2 uppercase tracking-wider flex items-center gap-1">
                                  📊 Orden de Negocio (30 días):
                                </span>
                                <button
                                    onClick={() => setBusinessSortMode('inteligente')}
                                    className={`px-3 py-1 text-xs font-bold rounded-full transition-all ${
                                        businessSortMode === 'inteligente'
                                            ? 'bg-accent text-white ring-2 ring-accent/30'
                                            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                                    }`}
                                    title="Híbrido de ventas recientes y bajas existencias"
                                >
                                    🔥 Inteligente
                                </button>
                                <button
                                    onClick={() => setBusinessSortMode('tendencias')}
                                    className={`px-3 py-1 text-xs font-bold rounded-full transition-all ${
                                        businessSortMode === 'tendencias'
                                            ? 'bg-accent text-white ring-2 ring-accent/30'
                                            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                                    }`}
                                    title="Más vendidos en los últimos 30 días"
                                >
                                    📈 Tendencias
                                </button>
                                <button
                                    onClick={() => setBusinessSortMode('recompra')}
                                    className={`px-3 py-1 text-xs font-bold rounded-full transition-all ${
                                        businessSortMode === 'recompra'
                                            ? 'bg-accent text-white ring-2 ring-accent/30'
                                            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                                    }`}
                                    title="Productos en demanda con stock crítico"
                                >
                                    🚨 Recompra Urgente
                                </button>
                                <button
                                    onClick={() => setBusinessSortMode('alfabetico')}
                                    className={`px-3 py-1 text-xs font-bold rounded-full transition-all ${
                                        businessSortMode === 'alfabetico'
                                            ? 'bg-accent text-white ring-2 ring-accent/30'
                                            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                                    }`}
                                    title="Orden alfabético de la A a la Z"
                                >
                                    🔤 Alfabético
                                </button>
                            </div>
                        )}
                    </div>
                </div>
                <div className="flex-grow overflow-y-auto pr-2 -mr-3">
                    <ProductGrid 
                        products={filteredInventory} 
                        performanceTrends={performanceTrends}
                        onAddToCart={handleAddToCartWithAnimation} 
                        onEditImage={setEditingProductImage}
                        onEditProduct={setEditingProductDetails}
                        onShowPerformance={setPerformanceProduct}
                        isAdmin={isAdmin}
                        justAddedProductId={justAddedProductId}
                        verifiedProducts={props.verifiedProducts}
                        onToggleProductVerification={props.onToggleProductVerification}
                        recentSalesMap={recentSalesMap}
                        trendingProductIds={trendingProductIds}
                    />
                </div>
            </div>
        </div>

        <div className="hidden lg:flex flex-col lg:col-span-4 xl:col-span-3 h-[calc(100vh-68px)] sticky top-[60px]" id="cart-and-actions-container">
             <div className="h-full overflow-y-auto pr-2 space-y-3 -mr-2">
                {CartAndActionsContent({ isMobile: false })}
            </div>
        </div>
      </div>

      {totalItems > 0 && (
        <div 
            onClick={() => setIsMobileCartOpen(true)}
            className="lg:hidden fixed bottom-0 left-0 right-0 bg-accent p-3 shadow-[0_-5px_15px_-5px_rgba(0,0,0,0.3)] z-40 cursor-pointer"
        >
            <div className="container mx-auto flex justify-between items-center text-white">
                <div className="flex items-center space-x-2">
                    <ShoppingCartIcon className="w-6 h-6" />
                    <span className="font-bold text-base">{totalItems} {totalItems === 1 ? 'producto' : 'productos'}</span>
                </div>
                <div className="flex items-center space-x-3">
                    <span className="font-extrabold text-lg">{formatCOP(totalPrice)}</span>
                    <span className="font-bold text-base">Ver Carrito →</span>
                </div>
            </div>
        </div>
      )}

      {isMobileCartOpen && (
        <div className="lg:hidden fixed inset-0 bg-white dark:bg-slate-950 z-[100] flex flex-col animate-slide-up">
            <div className="flex-shrink-0 flex justify-between items-center p-4 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 sticky top-0 z-[110] shadow-sm">
                <h2 className="text-xl font-bold text-accent">Tu Carrito</h2>
                <button 
                    onClick={() => setIsMobileCartOpen(false)}
                    className="p-3 -m-2 rounded-full bg-slate-100 dark:bg-slate-800 text-accent hover:bg-slate-200 dark:hover:bg-slate-700 active:scale-90 transition-all border border-slate-200 dark:border-slate-700"
                    aria-label="Cerrar carrito"
                >
                    <CrossIcon className="w-7 h-7" />
                </button>
            </div>
            <div className="flex-grow overflow-y-auto bg-slate-50 dark:bg-slate-950 pb-24">
                <div className="p-4">
                    {CartAndActionsContent({ isMobile: true })}
                </div>
            </div>
        </div>
      )}
      
      {isSalesReportModalOpen && (
          <DailySalesReportModal
              isOpen={isSalesReportModalOpen}
              onClose={() => setIsSalesReportModalOpen(false)}
              sales={props.sales}
              layaways={props.layaways}
              sellers={props.sellers}
              dailyNotes={props.dailyNotes}
              incidents={props.incidents}
              onAddDailyNote={props.onAddDailyNote}
              saleDate={saleDate}
              isAdmin={isAdmin}
          />
      )}
      {isIncidentModalOpen && (
        <CreateIncidentModal
            isOpen={isIncidentModalOpen}
            onClose={() => setIsIncidentModalOpen(false)}
            inventory={props.inventory}
            sales={props.sales}
            stores={props.stores}
            currentUser={props.currentUser}
            roles={props.roles}
            onCreateIncident={props.onCreateIncident}
            customers={props.allCustomers}
        />
      )}
      {isSellVoucherModalOpen && (
        <SellVoucherModal
            isOpen={isSellVoucherModalOpen}
            onClose={() => setIsSellVoucherModalOpen(false)}
            sellers={props.sellers}
            customers={props.allCustomers}
            currentStore={props.currentStore}
            onCreateGiftVoucher={props.onCreateGiftVoucher}
            onProcessSale={props.onProcessSale}
        />
      )}
      {isCheckVoucherModalOpen && (
        <CheckVoucherModal
            isOpen={isCheckVoucherModalOpen}
            onClose={() => setIsCheckVoucherModalOpen(false)}
            giftVouchers={props.giftVouchers}
            sales={props.sales}
        />
      )}
      {editingProductImage && (
        <EditProductImageModal 
            isOpen={!!editingProductImage}
            onClose={() => setEditingProductImage(null)}
            product={editingProductImage}
            onUpdateProduct={props.onUpdateProduct}
        />
      )}
      {editingProductDetails && (
        <EditProductModal 
            isOpen={!!editingProductDetails}
            onClose={() => setEditingProductDetails(null)}
            product={editingProductDetails}
            categories={props.categories}
            onUpdateProduct={props.onUpdateProduct}
        />
      )}
      {performanceProduct && (
        <ProductPerformanceModal 
            isOpen={!!performanceProduct}
            onClose={() => setPerformanceProduct(null)}
            product={performanceProduct}
            sales={props.sales}
            purchases={props.purchases}
            onUpdateProduct={props.onUpdateProduct}
            isAdmin={isAdmin}
        />
      )}
      
      {isCeoNoteModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-[200] animate-fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl animate-scale-in">
            <div className="bg-gradient-to-r from-pink-500 to-indigo-500 p-6 text-white flex justify-between items-center">
              <div>
                <h3 className="text-lg font-black tracking-tight">Registro Diario para CEO Center 💎</h3>
                <p className="text-xs text-white/85 font-medium mt-1">Comparte el pulso diario de la tienda con la dirección</p>
              </div>
              <button 
                onClick={() => setIsCeoNoteModalOpen(false)}
                className="p-1 rounded-full hover:bg-white/10 transition-colors text-white"
              >
                <CrossIcon className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddCeoDailyNotes} className="p-6 space-y-6">
              {/* Sección Energía */}
              <div className="space-y-3">
                <label className="block text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  ¿Cómo está la energía de la tienda hoy?
                </label>
                <div className="grid grid-cols-3 gap-3">
                  <button
                    type="button"
                    onClick={() => setEnergyLevel('green')}
                    className={`flex flex-col items-center justify-center p-3 rounded-2xl border-2 transition-all duration-200 ${
                      energyLevel === 'green'
                        ? 'bg-green-500/10 border-green-500 text-green-700 dark:text-green-400 scale-105'
                        : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800'
                    }`}
                  >
                    <span className="text-2xl mb-1">🟢</span>
                    <span className="text-xs font-bold">Excelente</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setEnergyLevel('yellow')}
                    className={`flex flex-col items-center justify-center p-3 rounded-2xl border-2 transition-all duration-200 ${
                      energyLevel === 'yellow'
                        ? 'bg-yellow-500/10 border-yellow-500 text-yellow-700 dark:text-yellow-400 scale-105'
                        : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800'
                    }`}
                  >
                    <span className="text-2xl mb-1">🟡</span>
                    <span className="text-xs font-bold">Atención</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setEnergyLevel('red')}
                    className={`flex flex-col items-center justify-center p-3 rounded-2xl border-2 transition-all duration-200 ${
                      energyLevel === 'red'
                        ? 'bg-red-500/10 border-red-500 text-red-700 dark:text-red-400 scale-105'
                        : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800'
                    }`}
                  >
                    <span className="text-2xl mb-1">🔴</span>
                    <span className="text-xs font-bold">Revisar</span>
                  </button>
                </div>

                {energyLevel && (
                  <div className="space-y-1 animate-fade-in">
                    <label className="block text-[10px] font-bold text-slate-400">
                      Observación / Justificación de la energía (Máx 100 caracteres)
                    </label>
                    <input
                      type="text"
                      maxLength={100}
                      value={energyObservation}
                      onChange={(e) => setEnergyObservation(e.target.value)}
                      placeholder="Ej. El equipo tiene súper buena actitud, o Falta personal..."
                      className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-accent focus:border-accent outline-none"
                    />
                    <div className="text-right text-[9px] text-slate-400">
                      {energyObservation.length}/100
                    </div>
                  </div>
                )}
              </div>

              {/* Sección Preguntas de Clientes */}
              <div className="space-y-2">
                <label className="block text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Preguntas Frecuentes o Comentarios de Clientes
                </label>
                <textarea
                  value={customerQuestion}
                  onChange={(e) => setCustomerQuestion(e.target.value)}
                  placeholder="Ej. ¿Tienen el vestido rojo en talla L? o ¿Cuándo llegan los nuevos bolsos?..."
                  rows={3}
                  className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-accent focus:border-accent outline-none resize-none"
                />
                <p className="text-[10px] text-slate-400">
                  Esta información ayuda al CEO Center a tomar decisiones sobre compras, reabastecimiento y catálogo.
                </p>
              </div>

              {/* Acciones */}
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCeoNoteModalOpen(false)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 font-bold text-xs hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingCeoNote}
                  className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-pink-500 to-indigo-500 text-white font-black text-xs hover:opacity-90 transition-opacity flex items-center justify-center gap-1 shadow-md shadow-indigo-500/10 disabled:opacity-55"
                >
                  {isSubmittingCeoNote ? (
                    <span>Guardando...</span>
                  ) : (
                    <>
                      <SparklesIcon className="w-4 h-4" />
                      <span>Enviar al CEO Center</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default PosView;