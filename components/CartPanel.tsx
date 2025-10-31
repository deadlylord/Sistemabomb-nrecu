

import React, { useState, useEffect } from 'react';
import { CartItem, PaymentMethod, Seller, Customer, Payment } from '../types';
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
}

const CartPanel: React.FC<CartPanelProps> = ({ cartItems, sellers, customers, onUpdateQuantity, onUpdateCartItemPrice, onRemoveFromCart, onClearCart, onProcessSale, onHoldSale, onCreateLayaway, saleDate, nextInvoiceNumber, isCartPulsing, initialCustomerInfo }) => {
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
  
  useEffect(() => {
    if (cartItems.length === 0) {
        setReceivedAmount('');
    }
  }, [cartItems]);

  const totalPrice = cartItems.reduce((total, item) => total + item.price * item.quantity, 0);
  const received = parseFloat(receivedAmount) || 0;
  const change = showChangeCalculator && received > 0 ? received - totalPrice : 0;

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
              setCustomerName(toTitleCase(foundCustomer.name));
            }
        }
    }
  };
  
  const handleLayawayConfirm = () => {
    const amount = parseFloat(initialAmount);
    if (customerPhone.trim().length !== 10) {
      alert("El número de celular debe tener exactamente 10 dígitos.");
      return;
    }
    if (customerName.trim() && customerPhone.trim() && invoiceNumber.trim() && layawaySeller && paymentMethod && amount > 0) {
      onCreateLayaway(customerName, customerPhone, invoiceNumber, layawaySeller, { amount, method: paymentMethod }, saleDate, isPreOrder, layawayDescription);
      setIsLayawayModalOpen(false);
      setCustomerName('');
      setCustomerPhone('');
      setInvoiceNumber('');
      setLayawaySeller('');
      setInitialAmount('');
      setPaymentMethod('');
      setLayawayDescription('');
    } else {
      alert("Por favor, completa todos los campos, incluyendo un abono inicial mayor a cero.");
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
      <div className={`bg-white dark:bg-secondary p-4 rounded-xl shadow-lg ${isCartPulsing ? 'animate-flash-bg' : ''}`}>
        <div className="flex justify-between items-center border-b-2 border-accent/30 pb-2 mb-3">
          <div>
            <h2 className="text-xl font-bold text-accent">Carrito</h2>
            <span className="text-sm font-mono text-gray-500 dark:text-text-dark">Factura #{nextInvoiceNumber}</span>
          </div>
          {cartItems.length > 0 && (
            <button onClick={onClearCart} className="text-sm text-gray-500 dark:text-text-dark hover:text-red-500 transition-colors">
              Vaciar Carrito
            </button>
          )}
        </div>

        {cartItems.length === 0 ? (
          <p className="text-gray-500 dark:text-text-dark text-center py-8">Tu carrito está vacío.</p>
        ) : (
          <>
            <div className="space-y-3">
              {cartItems.map(item => (
                <div key={item.id} className="flex items-center justify-between bg-gray-100 dark:bg-gray-800 p-2 rounded-lg">
                  <div className="flex-1 mr-2">
                    <p className="font-bold text-sm text-gray-800 dark:text-text-light truncate w-full">{item.name}</p>
                    <p className="text-xs text-gray-500 dark:text-text-dark truncate w-full">{item.supplier || 'N/A'}</p>
                    {editingItemId === item.id ? (
                        <input
                            type="number"
                            step="1000"
                            value={editedPrice}
                            onChange={(e) => setEditedPrice(e.target.value)}
                            onBlur={() => handlePriceBlur(item.id)}
                            onKeyDown={(e) => handlePriceKeyDown(e, item.id)}
                            className="w-24 bg-gray-200 dark:bg-gray-700 text-accent text-sm p-1 rounded outline-none ring-2 ring-accent"
                            autoFocus
                        />
                    ) : (
                        <p className="text-sm text-accent cursor-pointer" onClick={() => handlePriceClick(item)}>
                            {formatCOP(item.price)}
                        </p>
                    )}
                  </div>
                  <div className="flex items-center space-x-1.5">
                    <button onClick={() => onUpdateQuantity(item.id, item.quantity - 1)} className="p-1 rounded-full bg-gray-200 dark:bg-gray-700 hover:bg-accent text-gray-800 dark:text-text-light hover:text-white"><MinusIcon /></button>
                    <span className="w-6 text-center font-bold text-sm">{item.quantity}</span>
                    <button onClick={() => onUpdateQuantity(item.id, item.quantity + 1)} className="p-1 rounded-full bg-gray-200 dark:bg-gray-700 hover:bg-accent text-gray-800 dark:text-text-light hover:text-white"><PlusIcon /></button>
                  </div>
                  <button onClick={() => onRemoveFromCart(item.id)} className="ml-2 text-gray-500 dark:text-text-dark hover:text-red-500">
                    <TrashIcon />
                  </button>
                </div>
              ))}
            </div>

            <div id="cart-total-display" className="mt-4 border-t-2 border-accent/30 pt-3">
              <div className="mb-2">
                  <label htmlFor="change-toggle" className="flex items-center justify-end cursor-pointer">
                      <span className="mr-3 text-sm font-medium text-gray-600 dark:text-text-dark">Calcular Devolución</span>
                      <div className="relative">
                          <input type="checkbox" id="change-toggle" className="sr-only" checked={showChangeCalculator} onChange={() => setShowChangeCalculator(!showChangeCalculator)} />
                          <div className="block bg-gray-200 dark:bg-gray-700 w-12 h-6 rounded-full"></div>
                          <div className={`dot absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${showChangeCalculator ? 'translate-x-6 bg-accent' : ''}`}></div>
                      </div>
                  </label>
              </div>

              {showChangeCalculator && (
                  <div className="mb-3">
                      <label htmlFor="receivedAmount" className="block text-sm font-medium text-gray-500 dark:text-text-dark mb-1">Valor Recibido</label>
                      <input
                          type="number"
                          id="receivedAmount"
                          value={receivedAmount}
                          onChange={e => setReceivedAmount(e.target.value)}
                          className="w-full bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-md p-2 text-right font-bold text-lg focus:ring-2 focus:ring-accent focus:border-accent outline-none"
                          placeholder="0"
                          min="0"
                          step="1000"
                      />
                  </div>
              )}

              <div className="flex justify-between items-center text-2xl font-bold mb-3">
                <span className="text-gray-800 dark:text-text-light">Total:</span>
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
                    <button onClick={() => onHoldSale()} className="w-full bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-text-light font-bold py-2 px-3 rounded-lg flex items-center justify-center space-x-2 hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors">
                        <PauseIcon />
                        <span>En Espera</span>
                    </button>
                    <button onClick={() => handleLayawayClick(false)} className="w-full bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-text-light font-bold py-2 px-3 rounded-lg flex items-center justify-center space-x-2 hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors">
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
      />

      {isLayawayModalOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-secondary rounded-lg shadow-xl p-6 w-full max-w-sm">
                <h3 className="text-xl font-bold text-accent mb-4">
                  {isPreOrder ? 'Crear Abono por Traer (Encargo)' : 'Crear Abono'}
                </h3>
                <p className="text-gray-500 dark:text-text-dark mb-4">
                  {isPreOrder
                    ? 'El stock NO se descontará hasta que marques el producto como recibido.'
                    : 'Ingresa los datos para asociarlos a este abono.'}
                </p>
                <div className="space-y-4">
                  {isPreOrder && (
                      <div>
                          <label htmlFor="layawayDescription" className="block text-sm font-medium text-gray-500 dark:text-text-dark mb-1">
                              Descripción del Pedido (Talla, color, etc.)
                          </label>
                          <textarea
                              id="layawayDescription"
                              value={layawayDescription}
                              onChange={e => setLayawayDescription(e.target.value)}
                              rows={2}
                              className="w-full bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-md p-2 focus:ring-2 focus:ring-accent focus:border-accent outline-none"
                              placeholder="Detalles específicos del encargo..."
                          />
                      </div>
                  )}
                  <div>
                    <label htmlFor="customerPhone" className="block text-sm font-medium text-gray-500 dark:text-text-dark mb-1">Celular del Cliente</label>
                    <input
                        type="tel"
                        id="customerPhone"
                        value={customerPhone}
                        onChange={handleLayawayPhoneChange}
                        className="w-full bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-md p-2 focus:ring-2 focus:ring-accent focus:border-accent outline-none"
                        placeholder="Celular (10 dígitos)"
                        required
                        maxLength={10}
                    />
                  </div>
                  <div>
                    <label htmlFor="customerName" className="block text-sm font-medium text-gray-500 dark:text-text-dark mb-1">Nombre del Cliente</label>
                    <input
                        type="text"
                        id="customerName"
                        value={customerName}
                        onChange={e => setCustomerName(toTitleCase(e.target.value))}
                        className="w-full bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-md p-2 focus:ring-2 focus:ring-accent focus:border-accent outline-none"
                        placeholder="Ej: Ana Pérez"
                        required
                    />
                  </div>
                  <div>
                    <label htmlFor="invoiceNumber" className="block text-sm font-medium text-gray-500 dark:text-text-dark mb-1">Número de Factura</label>
                    <input
                        type="text"
                        id="invoiceNumber"
                        value={invoiceNumber}
                        onChange={e => setInvoiceNumber(e.target.value)}
                        className="w-full bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-md p-2 focus:ring-2 focus:ring-accent focus:border-accent outline-none"
                        placeholder="Ej: F-00123"
                        required
                    />
                  </div>
                  <div>
                    <label htmlFor="layawaySeller" className="block text-sm font-medium text-gray-500 dark:text-text-dark mb-1">Vendedor (Obligatorio)</label>
                    <select
                        id="layawaySeller"
                        value={layawaySeller}
                        onChange={e => setLayawaySeller(e.target.value)}
                        className="w-full bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-md p-2 focus:ring-2 focus:ring-accent focus:border-accent outline-none"
                        required
                    >
                        <option value="" disabled>Selecciona un vendedor</option>
                        {sellers.filter(s => !s.isDisabled).map(seller => (
                            <option key={seller.id} value={seller.name}>{seller.name}</option>
                        ))}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="initialAmount" className="block text-sm font-medium text-gray-500 dark:text-text-dark mb-1">Abono Inicial (Obligatorio)</label>
                    <input
                        type="number"
                        id="initialAmount"
                        value={initialAmount}
                        onChange={e => setInitialAmount(e.target.value)}
                        className="w-full bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-md p-2 focus:ring-2 focus:ring-accent focus:border-accent outline-none"
                        placeholder="0"
                        min="0"
                        step="1000"
                        required
                    />
                  </div>
                  <div>
                    <label htmlFor="paymentMethod" className="block text-sm font-medium text-gray-500 dark:text-text-dark mb-1">Método de Pago</label>
                    <select
                        id="paymentMethod"
                        value={paymentMethod}
                        onChange={e => setPaymentMethod(e.target.value as PaymentMethod)}
                        className="w-full bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-md p-2 focus:ring-2 focus:ring-accent focus:border-accent outline-none"
                        required
                    >
                        <option value="" disabled>Selecciona un método</option>
                        {Object.values(PaymentMethod).map(method => (
                            <option key={method} value={method}>{method}</option>
                        ))}
                    </select>
                  </div>
                </div>
                <div className="mt-6 flex justify-end space-x-3">
                    <button type="button" onClick={() => setIsLayawayModalOpen(false)} className="px-4 py-2 bg-gray-200 dark:bg-gray-700 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors">Cancelar</button>
                    <button onClick={handleLayawayConfirm} className="px-4 py-2 bg-accent text-white rounded-md hover:bg-accent-hover transition-colors">Confirmar</button>
                </div>
            </div>
        </div>
      )}
    </>
  );
};

export default CartPanel;
