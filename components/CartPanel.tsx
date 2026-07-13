
import React, { useState, useEffect } from 'react';
import { CartItem, PaymentMethod, Seller, Customer, Payment, Store, GiftVoucher } from '../types';
import { TrashIcon, PlusIcon, MinusIcon, PauseIcon, TagIcon, TruckIcon } from './Icons';
import PaymentModal from './PaymentModal';
import { formatCOP, toTitleCase } from '../constants';

interface CartPanelProps {
  cartItems: CartItem[];
  sellers: Seller[];
  customers: Customer[];
  onUpdateQuantity: (productId: string, newQuantity: number) => void;
  onUpdateCartItemPrice: (productId: string, newPrice: number) => void;
  onRemoveFromCart: (productId: string) => void;
  onClearCart: () => void;
  onProcessSale: (saleData: { payments: Payment[]; customerName: string; customerPhone: string; seller: string; }, saleDate: Date) => void;
  onHoldSale: (data?: { customer?: { name: string; phone: string }; sellerName?: string; }) => void;
  onCreateLayaway: (customerName: string, customerPhone: string, invoiceNumber: string, seller: string, initialPayment: { amount: number; method: PaymentMethod; }, saleDate: Date, isPreOrder: boolean, description?: string) => void;
  saleDate: Date;
  nextInvoiceNumber: number;
  isCartPulsing: boolean;
  initialCustomerInfo: {name: string, phone: string} | null;
  currentStore: Store | undefined;
  giftVouchers: GiftVoucher[];
  onUpdateGiftVoucher: (voucherId: string, updates: Partial<GiftVoucher>) => Promise<void>;
}

const CartPanel: React.FC<CartPanelProps> = ({ cartItems, sellers, customers, onUpdateQuantity, onUpdateCartItemPrice, onRemoveFromCart, onClearCart, onProcessSale, onHoldSale, onCreateLayaway, saleDate, nextInvoiceNumber, isCartPulsing, initialCustomerInfo, currentStore, giftVouchers, onUpdateGiftVoucher }) => {
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isLayawayModalOpen, setIsLayawayModalOpen] = useState(false);
  const [isPreOrder, setIsPreOrder] = useState(false);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [layawaySeller, setLayawaySeller] = useState('');
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editedPrice, setEditedPrice] = useState('');
  const [initialAmount, setInitialAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | ''>('');
  const [showChangeCalculator, setShowChangeCalculator] = useState(false);
  const [receivedAmount, setReceivedAmount] = useState('');
  const [layawayDescription, setLayawayDescription] = useState('');
  const [layawayError, setLayawayError] = useState('');
  
  // Discount State
  const [discountPercent, setDiscountPercent] = useState<number>(0);
  const [customDiscount, setCustomDiscount] = useState<string>('');
  const [showCustomDiscount, setShowCustomDiscount] = useState<boolean>(false);

  useEffect(() => {
    if (cartItems.length === 0) {
        setReceivedAmount('');
        setDiscountPercent(0);
        setCustomDiscount('');
        setShowCustomDiscount(false);
    }
  }, [cartItems]);

  const subtotal = cartItems.reduce((total, item) => total + item.price * item.quantity, 0);
  const discountAmount = discountPercent > 0 ? Math.round(subtotal * (discountPercent / 100)) : 0;
  const totalPrice = subtotal - discountAmount;
  const received = parseFloat(receivedAmount) || 0;
  const change = showChangeCalculator && received > 0 ? received - totalPrice : 0;

  const handleDiscountChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    if (val === 'custom') {
      setShowCustomDiscount(true);
      setDiscountPercent(parseFloat(customDiscount) || 0);
    } else {
      setShowCustomDiscount(false);
      const percent = parseFloat(val) || 0;
      setDiscountPercent(percent);
    }
  };

  const handleCustomDiscountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setCustomDiscount(val);
    const percent = parseFloat(val) || 0;
    if (percent >= 0 && percent <= 100) {
      setDiscountPercent(percent);
    } else if (!val) {
      setDiscountPercent(0);
    }
  };

  const handleProcessSaleClick = () => {
    setIsPaymentModalOpen(true);
  };
  
  const handleLayawayClick = (preOrder: boolean) => {
    setIsPreOrder(preOrder);
    setIsLayawayModalOpen(true);
  };

  const handleLayawayPhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const phone = e.target.value.replace(/[^0-9]/g, '');
    if (phone.length <= 10) {
        setCustomerPhone(phone);
        if (phone.length === 10) {
            const foundCustomer = customers.find(c => c.phone === phone);
            if (foundCustomer) {
              setCustomerName(foundCustomer.name);
            }
        }
    }
  };
  
  const handleLayawayConfirm = () => {
    setLayawayError('');
    const amount = parseFloat(initialAmount);
    if (customerPhone.trim().length !== 10) {
      setLayawayError("El número de celular debe tener exactamente 10 dígitos.");
      return;
    }
    const finalName = toTitleCase(customerName.trim());
    if (finalName && customerPhone.trim() && invoiceNumber.trim() && layawaySeller && paymentMethod && amount > 0) {
      onCreateLayaway(finalName, customerPhone, invoiceNumber, layawaySeller, { amount, method: paymentMethod }, saleDate, isPreOrder, layawayDescription);
      setIsLayawayModalOpen(false);
      setCustomerName('');
      setCustomerPhone('');
      setInvoiceNumber('');
      setLayawaySeller('');
      setInitialAmount('');
      setPaymentMethod('');
      setLayawayDescription('');
    } else {
      setLayawayError("Por favor, completa todos los campos, incluyendo un abono inicial mayor a cero.");
    }
  };

  const handlePriceClick = (item: CartItem) => {
    setEditingItemId(item.id);
    setEditedPrice(item.price.toString());
  };
  
  const handlePriceBlur = (itemId: string) => {
    const newPrice = parseFloat(editedPrice);
    if (!isNaN(newPrice) && newPrice >= 0) {
      onUpdateCartItemPrice(itemId, newPrice);
    }
    setEditingItemId(null);
  };

  const handlePriceKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, itemId: string) => {
    if (e.key === 'Enter') {
      handlePriceBlur(itemId);
    }
  };

  return (
    <>
      <div className={`bg-white dark:bg-slate-900/75 dark:backdrop-blur-xl dark:border dark:border-slate-800 p-4 rounded-xl shadow-lg ${isCartPulsing ? 'animate-flash-bg' : ''}`}>
        <div className="flex justify-between items-center border-b-2 dark:border-accent/30 border-accent/20 pb-2 mb-3">
          <div>
            <h2 className="text-xl font-bold text-accent">Carrito</h2>
            <span className="text-sm font-mono text-slate-500 dark:text-slate-400">Factura #{nextInvoiceNumber}</span>
          </div>
          {cartItems.length > 0 && (
            <button onClick={onClearCart} className="text-sm text-slate-500 dark:text-slate-400 hover:text-red-500 transition-colors">
              Vaciar Carrito
            </button>
          )}
        </div>

        {cartItems.length === 0 ? (
          <p className="text-slate-500 dark:text-slate-400 text-center py-8">Tu carrito está vacío.</p>
        ) : (
          <>
            <div className="space-y-3">
              {cartItems.map(item => (
                <div key={item.id} className="flex items-center justify-between bg-slate-100 dark:bg-slate-800/80 p-2 rounded-lg">
                  <div className="flex-1 mr-2">
                    <p className="font-bold text-sm text-slate-800 dark:text-slate-200 truncate w-full">{item.name}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 truncate w-full">{item.supplier || 'N/A'}</p>
                    {editingItemId === item.id ? (
                        <input
                            type="number"
                            step="1000"
                            value={editedPrice}
                            onChange={(e) => setEditedPrice(e.target.value)}
                            onBlur={() => handlePriceBlur(item.id)}
                            onKeyDown={(e) => handlePriceKeyDown(e, item.id)}
                            className="w-24 bg-slate-200 dark:bg-slate-700 text-accent text-sm p-1 rounded outline-none ring-2 ring-accent"
                            autoFocus
                        />
                    ) : (
                    <div className="flex flex-col items-start">
                        <div className="flex items-baseline gap-2">
                            {item.price === 0 ? (
                                <span className="text-[10px] bg-accent text-white px-2 py-0.5 rounded-full font-black uppercase tracking-tighter">Obsequio</span>
                            ) : (
                                <p className="text-sm text-accent cursor-pointer font-bold" onClick={() => handlePriceClick(item)}>
                                    {formatCOP(item.price)}
                                </p>
                            )}
                            {item.basePrice && item.basePrice > item.price && (
                                <span className="text-[10px] text-slate-400 line-through">{formatCOP(item.basePrice)}</span>
                            )}
                        </div>
                        {item.discountPrice && item.discountPrice === item.price && item.price > 0 && (
                            <span className="text-[10px] text-orange-500 font-black uppercase tracking-tighter animate-pulse">Liquidación</span>
                        )}
                    </div>
                    )}
                  </div>
                  <div className="flex items-center space-x-1.5">
                    <button onClick={() => onUpdateQuantity(item.id, item.quantity - 1)} className="p-1 rounded-full bg-slate-200 dark:bg-slate-700 hover:bg-accent text-slate-800 dark:text-slate-200 hover:text-white"><MinusIcon /></button>
                    <span className="w-6 text-center font-bold text-sm">{item.quantity}</span>
                    <button onClick={() => onUpdateQuantity(item.id, item.quantity + 1)} className="p-1 rounded-full bg-slate-200 dark:bg-slate-700 hover:bg-accent text-slate-800 dark:text-slate-200 hover:text-white"><PlusIcon /></button>
                  </div>
                  <button onClick={() => onRemoveFromCart(item.id)} className="ml-2 text-slate-500 dark:text-slate-400 hover:text-red-500">
                    <TrashIcon />
                  </button>
                </div>
              ))}
            </div>

            <div id="cart-total-display" className="mt-4 border-t-2 dark:border-accent/30 border-accent/20 pt-3">
              {/* Descuento de Compra */}
              <div className="mb-3 bg-slate-50 dark:bg-slate-800/40 p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <TagIcon className="w-4 h-4 text-accent" /> Descuento de Compra
                  </span>
                  <div className="flex items-center gap-2">
                    <select
                      value={showCustomDiscount ? 'custom' : discountPercent.toString()}
                      onChange={handleDiscountChange}
                      className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-md p-1.5 text-xs font-semibold focus:ring-2 focus:ring-accent outline-none text-slate-800 dark:text-slate-100"
                    >
                      <option value="0">Sin Descuento (0%)</option>
                      <option value="5">Bono 5%</option>
                      <option value="10">Bono 10%</option>
                      <option value="15">Bono 15%</option>
                      <option value="20">Bono 20%</option>
                      <option value="25">Bono 25%</option>
                      <option value="30">Bono 30%</option>
                      <option value="40">Bono 40%</option>
                      <option value="50">Bono 50%</option>
                      <option value="custom">Otro %</option>
                    </select>
                  </div>
                </div>

                {showCustomDiscount && (
                  <div className="flex items-center justify-end gap-2">
                    <label htmlFor="custom-discount-percent" className="text-xs text-slate-500 dark:text-slate-400 font-medium">Porcentaje:</label>
                    <div className="relative w-24">
                      <input
                        id="custom-discount-percent"
                        type="number"
                        min="0"
                        max="100"
                        placeholder="Ej: 8"
                        value={customDiscount}
                        onChange={handleCustomDiscountChange}
                        className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-md p-1.5 pr-6 text-right font-bold text-xs focus:ring-2 focus:ring-accent focus:border-accent outline-none text-slate-800 dark:text-slate-100"
                      />
                      <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">%</span>
                    </div>
                  </div>
                )}
              </div>

              <div className="mb-2">
                  <label htmlFor="change-toggle" className="flex items-center justify-end cursor-pointer">
                      <span className="mr-3 text-sm font-medium text-slate-600 dark:text-slate-400">Calcular Devolución</span>
                      <div className="relative">
                          <input type="checkbox" id="change-toggle" className="sr-only" checked={showChangeCalculator} onChange={() => setShowChangeCalculator(!showChangeCalculator)} />
                          <div className="block bg-slate-200 dark:bg-slate-700 w-12 h-6 rounded-full"></div>
                          <div className={`dot absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${showChangeCalculator ? 'translate-x-6 bg-accent' : ''}`}></div>
                      </div>
                  </label>
              </div>

              {showChangeCalculator && (
                  <div className="mb-3">
                      <label htmlFor="receivedAmount" className="block text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">Valor Recibido</label>
                      <input
                          type="number"
                          id="receivedAmount"
                          value={receivedAmount}
                          onChange={e => setReceivedAmount(e.target.value)}
                          className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-md p-2 text-right font-bold text-lg focus:ring-2 focus:ring-accent focus:border-accent outline-none"
                          placeholder="0"
                          min="0"
                          step="1000"
                      />
                  </div>
              )}

              {discountPercent > 0 && (
                <div className="space-y-1 mb-2 border-b dark:border-slate-800 pb-2 text-right">
                  <div className="flex justify-between items-center text-sm text-slate-500 dark:text-slate-400 font-medium">
                    <span>Subtotal:</span>
                    <span>{formatCOP(subtotal)}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm text-red-500 dark:text-red-400 font-medium">
                    <span>Descuento ({discountPercent}%):</span>
                    <span>-{formatCOP(discountAmount)}</span>
                  </div>
                </div>
              )}

              <div className="flex justify-between items-center text-2xl font-bold mb-3">
                <span className="text-slate-800 dark:text-slate-200">Total:</span>
                <span className="text-accent">{formatCOP(totalPrice)}</span>
              </div>

              {showChangeCalculator && received > 0 && (
                  <div className={`flex justify-between items-center text-xl font-bold mb-3 ${change < 0 ? 'text-red-500' : 'text-blue-500'}`}>
                      <span>{change < 0 ? 'Faltan:' : 'Devolución:'}</span>
                      <span>{formatCOP(Math.abs(change))}</span>
                  </div>
              )}
              
              <div className="space-y-2">
                <button
                  onClick={handleProcessSaleClick}
                  className="w-full bg-accent text-white font-bold py-3 px-4 rounded-lg transition-transform duration-300 hover:scale-105 hover:bg-accent-hover shadow-lg shadow-accent/20"
                >
                  Procesar Venta
                </button>
                <div className="grid grid-cols-2 gap-2">
                    <button onClick={() => onHoldSale()} className="w-full bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-300 font-bold py-2 px-3 rounded-lg flex items-center justify-center space-x-2 hover:bg-slate-300 dark:hover:bg-slate-700 transition-colors">
                        <PauseIcon />
                        <span>En Espera</span>
                    </button>
                    <button onClick={() => handleLayawayClick(false)} className="w-full bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-300 font-bold py-2 px-3 rounded-lg flex items-center justify-center space-x-2 hover:bg-slate-300 dark:hover:bg-slate-700 transition-colors">
                        <TagIcon />
                        <span>Crear Abono</span>
                    </button>
                    <button onClick={() => handleLayawayClick(true)} className="col-span-2 w-full bg-yellow-500 text-white font-bold py-2 px-3 rounded-lg flex items-center justify-center space-x-2 hover:bg-yellow-600 transition-colors">
                        <TruckIcon />
                        <span>Abono por Traer (Encargo)</span>
                    </button>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      <PaymentModal
        isOpen={isPaymentModalOpen}
        onClose={() => setIsPaymentModalOpen(false)}
        total={totalPrice}
        sellers={sellers}
        customers={customers}
        onProcessSale={onProcessSale}
        saleDate={saleDate}
        onHoldSale={onHoldSale}
        initialCustomerInfo={initialCustomerInfo}
        currentStore={currentStore}
        giftVouchers={giftVouchers}
        onUpdateGiftVoucher={onUpdateGiftVoucher}
        discountPercent={discountPercent}
        discountAmount={discountAmount}
      />

      {isLayawayModalOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-900/80 dark:backdrop-blur-xl dark:border dark:border-slate-700 rounded-lg shadow-xl p-6 w-full max-w-sm">
                <h3 className="text-xl font-bold text-accent mb-4">
                  {isPreOrder ? 'Crear Abono por Traer (Encargo)' : 'Crear Abono'}
                </h3>
                <p className="text-slate-500 dark:text-slate-400 mb-4">
                  {isPreOrder
                    ? 'El stock NO se descontará hasta que marques el producto como recibido.'
                    : 'Ingresa los datos para asociarlos a este abono.'}
                </p>
                {layawayError && (
                  <div className="mb-4 bg-red-100 border border-red-400 text-red-700 px-4 py-2.5 rounded-lg text-xs" role="alert">
                    <span>{layawayError}</span>
                  </div>
                )}
                <div className="space-y-4">
                  {isPreOrder && (
                      <div>
                          <label htmlFor="layawayDescription" className="block text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">
                              Descripción del Pedido (Talla, color, etc.)
                          </label>
                          <textarea
                              id="layawayDescription"
                              value={layawayDescription}
                              onChange={e => setLayawayDescription(e.target.value)}
                              rows={2}
                              className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-md p-2 focus:ring-2 focus:ring-accent focus:border-accent outline-none"
                              placeholder="Detalles específicos del encargo..."
                          />
                      </div>
                  )}
                  <div>
                    <label htmlFor="customerPhone" className="block text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">Celular del Cliente</label>
                    <input
                        type="tel"
                        id="customerPhone"
                        value={customerPhone}
                        onChange={handleLayawayPhoneChange}
                        className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-md p-2 focus:ring-2 focus:ring-accent focus:border-accent outline-none"
                        placeholder="Celular (10 dígitos)"
                        required
                        maxLength={10}
                    />
                  </div>
                  <div>
                    <label htmlFor="customerName" className="block text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">Nombre del Cliente</label>
                    <input
                        type="text"
                        id="customerName"
                        value={customerName}
                        onChange={e => setCustomerName(e.target.value)}
                        onBlur={() => setCustomerName(prev => toTitleCase(prev))}
                        className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-md p-2 focus:ring-2 focus:ring-accent focus:border-accent outline-none"
                        placeholder="Ej: Ana Pérez"
                        required
                    />
                  </div>
                  <div>
                    <label htmlFor="invoiceNumber" className="block text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">Número de Factura</label>
                    <input
                        type="text"
                        id="invoiceNumber"
                        value={invoiceNumber}
                        onChange={e => setInvoiceNumber(e.target.value)}
                        className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-md p-2 focus:ring-2 focus:ring-accent focus:border-accent outline-none"
                        placeholder="Ej: F-00123"
                        required
                    />
                  </div>
                  <div>
                    <label htmlFor="layawaySeller" className="block text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">Vendedor (Obligatorio)</label>
                    <select
                        id="layawaySeller"
                        value={layawaySeller}
                        onChange={e => setLayawaySeller(e.target.value)}
                        className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-md p-2 focus:ring-2 focus:ring-accent focus:border-accent outline-none"
                        required
                    >
                        <option value="" disabled>Selecciona un vendedor</option>
                        {sellers.filter(s => !s.isDisabled).map(seller => (
                            <option key={seller.id} value={seller.name}>{seller.name}</option>
                        ))}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="initialAmount" className="block text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">Abono Inicial (Obligatorio)</label>
                    <input
                        type="number"
                        id="initialAmount"
                        value={initialAmount}
                        onChange={e => setInitialAmount(e.target.value)}
                        className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-md p-2 focus:ring-2 focus:ring-accent focus:border-accent outline-none"
                        placeholder="0"
                        min="0"
                        step="1000"
                        required
                    />
                  </div>
                  <div>
                    <label htmlFor="paymentMethod" className="block text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">Método de Pago</label>
                    <select
                        id="paymentMethod"
                        value={paymentMethod}
                        onChange={e => setPaymentMethod(e.target.value as PaymentMethod)}
                        className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-md p-2 focus:ring-2 focus:ring-accent focus:border-accent outline-none"
                        required
                    >
                        <option value="" disabled>Selecciona un método</option>
                        {Object.values(PaymentMethod).map(method => {
                            let label = method;
                            if (method === PaymentMethod.Efectivo && currentStore?.accountLabels?.cash) label = currentStore.accountLabels.cash as PaymentMethod;
                            if ([PaymentMethod.Nequi, PaymentMethod.Daviplata, PaymentMethod.QR].includes(method) && currentStore?.accountLabels?.qr) {
                                // If it's one of the QR methods, we might want to show the custom QR label
                                // But usually Nequi/Daviplata are specific. 
                                // The user said "las cuentas dónde llegan los qr son de diferentes para cada local"
                                // So maybe they want to rename Nequi/Daviplata too?
                                // For now let's just use the QR label for the QR method.
                                if (method === PaymentMethod.QR) label = currentStore.accountLabels.qr as PaymentMethod;
                            }
                            if ([PaymentMethod.Tarjeta, PaymentMethod.Sistecredito, PaymentMethod.Addi].includes(method) && currentStore?.accountLabels?.bank) {
                                // Same for bank
                            }
                            
                            return <option key={method} value={method}>{label}</option>;
                        })}
                    </select>
                  </div>
                </div>
                <div className="mt-6 flex justify-end space-x-3">
                    <button type="button" onClick={() => setIsLayawayModalOpen(false)} className="px-4 py-2 bg-slate-200 dark:bg-slate-700 rounded-md hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors">Cancelar</button>
                    <button onClick={handleLayawayConfirm} className="px-4 py-2 bg-accent text-white rounded-md hover:bg-accent-hover transition-colors">Confirmar</button>
                </div>
            </div>
        </div>
      )}
    </>
  );
};

export default CartPanel;
