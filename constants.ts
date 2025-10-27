import { Product, Category, Seller, Role, View, Store, PaymentMethod } from './types';

export const formatCOP = (amount: number): string => {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
};

export const toTitleCase = (str: string): string => {
  if (!str) return '';
  return str
    .toLowerCase()
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

export const COMMISSION_RATES: { [key in PaymentMethod]?: number } = {
  [PaymentMethod.Addi]: 0.065,
  [PaymentMethod.Sistecredito]: 0.03,
  [PaymentMethod.Tarjeta]: 0.0515,
};

export const INITIAL_STORES: Store[] = [
  {
    id: '1',
    name: "Divino",
    receiptName: "Boutique Divino",
    logo: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMDAiIGhlaWdodD0iMTAwIiB2aWV3Qm94PSIwIDAgMTAwIDEwMCI+PHJlY3Qgd2lkdGg9IjEwMCIgaGVpZ2h0PSIxMDAiIGZpbGw9IiMxYTFhMWEiLz48dGV4dCB4PSI1MCIgeT0iNjgiIGZvbnQtZmFtaWx5PSJBcmlhbCwgc2Fucy1zZXJpZiIgZm9udC1zaXplPSI2MCIgZmlsbD0iI2ZmMDA3ZiIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZm9udC13ZWlnaHQ9ImJvbGQiPkQ8L3RleHQ+PC9zdmc+',
    contactInfo: 'Contacto Divino: 301 111 2222\nInstagram: @divino.tienda',
    footerText: '¡Gracias por tu compra en Divino!',
    whatsappFooterText: 'Este es tu recibo de Divino. ¡Gracias por preferirnos!',
    addiLink: 'https://www.addi.com/',
    sistecreditoLink: 'https://www.sistecredito.com/',
    autoPrint: false,
    autoSendWhatsApp: false,
    accentColor: '#ff007f',
    accentColorHover: '#e60073',
    nextInvoiceNumber: 1,
    loginBackgroundUrl: null,
    imageCompressionQuality: 'medium',
  },
  {
    id: '2',
    name: "Metro",
    receiptName: "Tienda Metro",
    logo: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMDAiIGhlaWdodD0iMTAwIiB2aWV3Qm94PSIwIDAgMTAwIDEwMCI+PHJlY3Qgd2lkdGg9IjEwMCIgaGVpZ2h0PSIxMDAiIGZpbGw9IiMxYTFhMWEiLz48dGV4dCB4PSI1MCIgeT0iNjgiIGZvbnQtZmFtaWx5PSJBcmlhbCwgc2Fucy1zZXJpZiIgZm9udC1zaXplPSI2MCIgZmlsbD0iI2ZmMDA3ZiIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZm9udC13ZWlnaHQ9ImJvbGQiPk08L3RleHQ+PC9zdmc+',
    contactInfo: 'Contacto Metro: 302 333 4444\nInstagram: @metro.tienda',
    footerText: '¡Gracias por tu compra en Metro!',
    whatsappFooterText: 'Este es tu recibo de Metro. ¡Vuelve pronto!',
    addiLink: 'https://www.addi.com/',
    sistecreditoLink: 'https://www.sistecredito.com/',
    autoPrint: true,
    autoSendWhatsApp: false,
    accentColor: '#9d00ff',
    accentColorHover: '#8c00e6',
    nextInvoiceNumber: 1,
    loginBackgroundUrl: null,
    imageCompressionQuality: 'medium',
  },
  {
    id: '3',
    name: "Centro Comercial",
    receiptName: "Bombon Centro Comercial",
    logo: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMDAiIGhlaWdodD0iMTAwIiB2aWV3Qm94PSIwIDAgMTAwIDEwMCI+PHJlY3Qgd2lkdGg9IjEwMCIgaGVpZ2h0PSIxMDAiIGZpbGw9IiMxYTFhMWEiLz48dGV4dCB4PSI1MCIgeT0iNjgiIGZvbnQtZmFtaWx5PSJBcmlhbCwgc2Fucy1zZXJpZiIgZm9udC1zaXplPSI1MCIgZmlsbD0iI2ZmMDA3ZiIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZm9udC13ZWlnaHQ9ImJvbGQiPkNDPC90ZXh0Pjwvc3ZnPg==',
    contactInfo: 'Contacto C.C.: 303 555 6666\nInstagram: @bombon.cc',
    footerText: '¡Gracias por tu compra en Bombon C.C.!',
    whatsappFooterText: 'Este es tu recibo de Bombon C.C. ¡No olvides seguirnos!',
    addiLink: 'https://www.addi.com/',
    sistecreditoLink: 'https://www.sistecredito.com/',
    autoPrint: false,
    autoSendWhatsApp: true,
    accentColor: '#00aaff',
    accentColorHover: '#0095e6',
    nextInvoiceNumber: 1,
    loginBackgroundUrl: null,
    imageCompressionQuality: 'medium',
  },
];

export const INITIAL_CATEGORIES: Category[] = [
  { id: '1', name: "Blusas y Bodys" },
  { id: '2', name: "Busos y Chaquetas" },
  { id: '3', name: "Jeans" },
  { id: '4', name: "Pantalones" },
  { id: '5', name: "Vestidos short" },
];

export const INITIAL_ROLES: Role[] = [
  {
    id: '1',
    name: "Administrator",
    permissions: [
      View.DASHBOARD,
      View.POS, 
      View.INVENTORY, 
      View.INVENTORY_TRANSFER, 
      View.LAYAWAY, 
      // @FIX: View.SALES does not exist in the enum. Sales view is now part of Dashboard.
      View.PURCHASES, 
      View.SELLERS, 
      View.STORES, 
      View.CUSTOMERS, 
      View.STOCK_TAKE_HISTORY, 
      View.PAYROLL, 
      View.SETTINGS, 
      View.INCIDENTS,
      View.ROLE_MANAGER
    ],
  },
  {
    id: '2',
    name: "Vendedor",
    permissions: [
      View.POS,
      View.LAYAWAY,
      View.CUSTOMERS,
      // @FIX: View.SALES does not exist. Replaced with View.DASHBOARD to give access to sales history.
      View.DASHBOARD,
      View.STOCK_TAKE_HISTORY,
      View.INCIDENTS,
    ],
  },
];

export const INITIAL_SELLERS: Seller[] = [
  { id: '1', name: "Paula", password: "123", roleId: '1', storeId: '1' },
  { id: '2', name: "Lucía", password: "123", roleId: '2', storeId: '2' },
  { id: '3', name: "Carlos", password: "123", roleId: '2', storeId: '3' },
];

export const INITIAL_PRODUCTS: Product[] = [
  {
    id: '1',
    sku: "BLU-PRI-01",
    name: "Blusa 'Primavera'",
    description: "Una blusa floral fresca y ligera, perfecta para cualquier ocasión.",
    price: 85990,
    cost: 55000,
    stock: 25,
    imageUrl: "",
    categoryId: '1',
    supplier: "ModaCo",
    storeId: '1', // Divino
  },
  {
    id: '2',
    sku: "CHA-REB-02",
    name: "Chaqueta de Jean 'Rebelde'",
    description: "Chaqueta de jean clásica con un toque moderno y desgastado.",
    price: 119990,
    cost: 90000,
    stock: 15,
    imageUrl: "",
    categoryId: '2',
    supplier: "Textiles SAS",
    storeId: '1', // Divino
  },
  {
    id: '3',
    sku: "JEA-SKI-03",
    name: "Jeans 'Skinny Fit'",
    description: "Jeans ajustados de tiro alto que realzan la figura.",
    price: 110000,
    cost: 75000,
    stock: 40,
    imageUrl: "",
    categoryId: '3',
    supplier: "DenimPro",
    storeId: '2', // Metro
  },
  {
    id: '4',
    sku: "PAN-EJE-04",
    name: "Pantalón 'Ejecutivo'",
    description: "Pantalón de tela formal, ideal para la oficina o eventos.",
    price: 98500,
    cost: 70000,
    stock: 20,
    imageUrl: "",
    categoryId: '4',
    supplier: "ModaCo",
    storeId: '2', // Metro
  },
  {
    id: '5',
    sku: "VES-VER-05",
    name: "Vestido Corto 'Verano'",
    description: "Vestido corto y fresco con estampado veraniego.",
    price: 95000,
    cost: 60000,
    stock: 30,
    imageUrl: "",
    categoryId: '5',
    supplier: "Estilos Frescos",
    storeId: '1', // Divino
  },
  {
    id: '6',
    sku: "BOD-SEN-06",
    name: "Body de Encaje 'Sensual'",
    description: "Body de encaje negro, elegante y atrevido.",
    price: 75500,
    cost: 45000,
    stock: 22,
    imageUrl: "",
    categoryId: '1',
    supplier: "ModaCo",
    storeId: '2', // Metro
  },
  {
    id: '7',
    sku: "BUS-CON-07",
    name: "Buso Tejido 'Confort'",
    description: "Buso de tejido suave, perfecto para un día frío.",
    price: 105000,
    cost: 80000,
    stock: 18,
    imageUrl: "",
    categoryId: '2',
    supplier: "Textiles SAS",
    storeId: '3', // Centro Comercial
  },
  {
    id: '8',
    sku: "JEA-MOM-08",
    name: "Jean 'Mom Fit'",
    description: "Jean estilo 'mom fit' de corte retro y cómodo.",
    price: 115000,
    cost: 78000,
    stock: 35,
    imageUrl: "",
    categoryId: '3',
    supplier: "DenimPro",
    storeId: '3', // Centro Comercial
  }
];