import React, { useState, useMemo, useEffect } from 'react';
import { Product, CartItem, PaymentMethod, HeldCart, Category, Seller, StockTake, Sale, DailyNote, Layaway, View, Store, Incident, IncidentType, IncidentStatus, Role, Customer, Payment, Purchase } from '../types';
import ProductGrid from './ProductGrid';
import ProductPerformanceModal from './ProductPerformanceModal';
import CartPanel from './CartPanel';
import DailySalesReportModal from './DailySalesReportModal';
import { ClipboardListIcon, ChartBarIcon, SearchIcon, AlertTriangleIcon, ShoppingCartIcon, CrossIcon, TruckIcon } from './Icons';
import CreateIncidentModal from './CreateIncidentModal';
import EditProductImageModal from './EditProductImageModal';
import { formatCOP } from '../constants';
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
  onProcessSale: (saleData: { payments: Payment[]; customerName: string; customerPhone: string; seller: string; }, saleDate: Date) => void;
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
}

const PosView: React.FC<PosViewProps> = (props) => {
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [isSalesReportModalOpen, setIsSalesReportModalOpen] = useState(false);
  const [isIncidentModalOpen, setIsIncidentModalOpen] = useState(false);
  const [editingProductImage, setEditingProductImage] = useState<Product | null>(null);
  const [editingProductDetails, setEditingProductDetails] = useState<Product | null>(null);
  const [performanceProduct, setPerformanceProduct] = useState<Product | null>(null);
  const [saleDate, setSaleDate] = useState(new Date());
  const [justAddedProductId, setJustAddedProductId] = useState<string | null>(null);
  const [isCartPulsing, setIsCartPulsing] = useState(false);
  const [isMobileCartOpen, setIsMobileCartOpen] = useState(false);
  const [customerInfo, setCustomerInfo] = useState<{name: string, phone: string} | null>(null);
  const [barcodeBuffer, setBarcodeBuffer] = useState('');

  const { onClearVerifications } = props;

  useEffect(() => {
    let timeout: NodeJS.Timeout;
    
    const handleKeyDown = (e: KeyboardEvent) => {
      // Si el foco está en un input o textarea, dejamos que el navegador lo maneje normalmente
      // a menos que sea la tecla Enter, que podría ser el final de un escaneo.
      const isInput = e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement;
      
      if (e.key === 'Enter') {
        if (barcodeBuffer.length > 2) {
          const product = props.inventory.find(p => p.sku === barcodeBuffer);
          if (product && product.stock > 0 && !product.isDisabled) {
            handleAddToCartWithAnimation(product);
            setBarcodeBuffer('');
            e.preventDefault();
          }
        }
        setBarcodeBuffer('');
      } else if (!isInput && e.key.length === 1) {
        // Solo acumulamos si no estamos en un input para evitar duplicados
        setBarcodeBuffer(prev => prev + e.key);
        
        // Limpiar el buffer si pasa mucho tiempo entre teclas (no es un escáner)
        clearTimeout(timeout);
        timeout = setTimeout(() => setBarcodeBuffer(''), 100);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      clearTimeout(timeout);
    };
  }, [barcodeBuffer, props.inventory]);

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

  const handleProcessSaleTransaction = (saleData: { payments: Payment[]; customerName: string; customerPhone: string; seller: string; }, selectedDate: Date) => {
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

  const handleProcessSaleWithClose = (saleData: { payments: Payment[]; customerName: string; customerPhone: string; seller: string; }, currentSaleDate: Date) => {
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

    setTimeout(() => {
      setJustAddedProductId(null);
      setIsCartPulsing(false);
    }, 700);
  };

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

    const { filteredInventory, performanceTrends } = useMemo(() => {
      const NOVEDADES_CATEGORY_ID = 'novedades';
      const DESCUENTOS_CATEGORY_ID = 'descuentos';
      const lowerCaseSearchTerm = searchTerm.trim().toLowerCase();
      
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

      // Pre-calculate performance map if admin and "All" category
      let performanceMap: Record<string, number> = {};
      if (isAdmin && !selectedCategoryId) {
          props.sales.forEach(sale => {
              sale.items.forEach(item => {
                  performanceMap[item.id] = (performanceMap[item.id] || 0) + item.quantity;
              });
          });
      }
  
      let result: Product[] = [];

      if (selectedCategoryId === NOVEDADES_CATEGORY_ID) {
          result = newArrivalsInventory.filter(p => {
              const matchesSearch = lowerCaseSearchTerm
                  ? p.name.toLowerCase().includes(lowerCaseSearchTerm) ||
                    (p.supplier && p.supplier.toLowerCase().includes(lowerCaseSearchTerm))
                  : true;
              return matchesSearch;
          });
      } else if (selectedCategoryId === DESCUENTOS_CATEGORY_ID) {
          result = props.inventory.filter(p => {
              const matchesDiscount = p.discountPrice !== undefined && p.discountPrice !== p.price && p.stock > 0 && !p.isDisabled;
              const matchesSearch = lowerCaseSearchTerm
                  ? p.name.toLowerCase().includes(lowerCaseSearchTerm) ||
                    (p.supplier && p.supplier.toLowerCase().includes(lowerCaseSearchTerm))
                  : true;
              return matchesDiscount && matchesSearch;
          });
      } else {
          result = props.inventory
            .filter(p => {
              if (p.isDisabled) return false;
              const matchesCategory = selectedCategoryId ? p.categoryId === selectedCategoryId : true;
              const matchesSearch = lowerCaseSearchTerm
                ? p.name.toLowerCase().includes(lowerCaseSearchTerm) ||
                  (p.supplier && p.supplier.toLowerCase().includes(lowerCaseSearchTerm))
                : true;
              return matchesCategory && matchesSearch;
            });
      }

      const sortedResult = result.sort((a, b) => {
          if (a.stock > 0 && b.stock <= 0) return -1;
          if (a.stock <= 0 && b.stock > 0) return 1;
          
          // Sort by performance if admin and "All" category
          if (isAdmin && !selectedCategoryId) {
              const perfA = performanceMap[a.id] || 0;
              const perfB = performanceMap[b.id] || 0;
              if (perfA !== perfB) return perfB - perfA; // Higher performance first
          }

          return a.name.localeCompare(b.name);
      });

      return { filteredInventory: sortedResult, performanceTrends: trends };
  }, [props.inventory, selectedCategoryId, searchTerm, newArrivalsInventory, isAdmin, props.sales]);

  const commonButtonClasses = "px-3 py-1.5 text-sm font-bold transition-colors duration-300 rounded-full";
  const activeButtonClasses = "bg-accent text-white shadow-md shadow-accent/30";
  const inactiveButtonClasses = "bg-white dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700/80 hover:text-slate-800 dark:hover:text-slate-200";
  
  const CartAndActionsContent = ({ isMobile = false }) => (
    <div className="space-y-3">
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
        <div className="bg-white dark:bg-slate-900/75 dark:backdrop-blur-xl dark:border dark:border-slate-800 p-2 rounded-xl shadow-lg flex flex-col sm:flex-row justify-between items-center gap-2">
            <div className="flex items-center gap-2">
                <label htmlFor="saleDate" className="text-xs font-medium text-slate-500 dark:text-slate-400 whitespace-nowrap">Fecha:</label>
                <input
                    type="date"
                    id="saleDate"
                    value={toYYYYMMDD(saleDate)}
                    onChange={handleDateChange}
                    className="bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-full py-1 px-3 text-xs focus:ring-2 focus:ring-accent focus:border-accent outline-none disabled:opacity-70 disabled:cursor-not-allowed"
                    aria-label="Fecha de Venta"
                    disabled={!isAdmin}
                />
            </div>
            <div className="flex items-center gap-1.5 flex-wrap justify-end">
                <a href={props.currentStore?.addiLink} target="_blank" rel="noopener noreferrer" className="bg-green-500 text-white font-bold py-1.5 px-2.5 rounded-lg flex items-center justify-center text-xs transition-colors duration-300 hover:bg-green-600">Addi</a>
                <a href={props.currentStore?.sistecreditoLink} target="_blank" rel="noopener noreferrer" className="bg-purple-500 text-white font-bold py-1.5 px-2.5 rounded-lg flex items-center justify-center text-xs transition-colors duration-300 hover:bg-purple-600">Sistecredito</a>
                <button onClick={() => setIsIncidentModalOpen(true)} className="bg-orange-500 text-white font-bold py-1.5 px-2.5 rounded-lg flex items-center justify-center space-x-1 text-xs transition-colors duration-300 hover:bg-orange-600"><AlertTriangleIcon className="w-4 h-4"/><span className="hidden sm:inline">Novedad</span></button>
                <button onClick={props.onOpenVerification} className="bg-blue-500 text-white font-bold py-1.5 px-2.5 rounded-lg flex items-center justify-center space-x-1 text-xs transition-colors duration-300 hover:bg-blue-600"><ClipboardListIcon className="w-4 h-4" /><span className="hidden sm:inline">Verificar</span></button>
                <button onClick={() => setIsSalesReportModalOpen(true)} className="bg-teal-500 text-white font-bold py-1.5 px-2.5 rounded-lg flex items-center justify-center space-x-1 text-xs transition-colors duration-300 hover:bg-teal-600"><ChartBarIcon className="w-4 h-4" /><span className="hidden sm:inline">Reporte</span></button>
            </div>
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
        />
    </div>
  );

  return (
    <div className="p-4 h-full">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="lg:col-span-7 xl:col-span-8 h-[calc(100vh-68px)] sticky top-[60px] pb-24 lg:pb-0" id="product-grid-container">
            <div className="bg-white/80 dark:bg-slate-900/75 backdrop-blur-xl border border-slate-200 dark:border-slate-800 p-3 rounded-xl shadow-lg flex flex-col h-full">
                <div className="flex-shrink-0">
                    <div className="space-y-3 mb-3">
                        <div className="relative w-full">
                            <input 
                                type="text"
                                placeholder="Buscar por nombre o proveedor..."
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                onKeyDown={e => {
                                    if (e.key === 'Enter' && searchTerm.length > 2) {
                                        const product = props.inventory.find(p => p.sku === searchTerm);
                                        if (product && product.stock > 0 && !product.isDisabled) {
                                            handleAddToCartWithAnimation(product);
                                            setSearchTerm('');
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
                                    onClick={() => setSearchTerm('')}
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
                    />
                </div>
            </div>
        </div>

        <div className="hidden lg:flex flex-col lg:col-span-5 xl:col-span-4 h-[calc(100vh-68px)] sticky top-[60px]" id="cart-and-actions-container">
             <div className="h-full overflow-y-auto pr-2 space-y-3 -mr-2">
                <CartAndActionsContent isMobile={false} />
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
                    <CartAndActionsContent isMobile={true} />
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
    </div>
  );
};

export default PosView;