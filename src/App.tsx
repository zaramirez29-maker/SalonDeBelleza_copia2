/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { jsPDF } from 'jspdf';
import { 
  Users, 
  Calendar as CalendarIcon, 
  Scissors, 
  ShoppingBag, 
  Receipt, 
  LayoutDashboard,
  LogOut,
  Plus,
  Clock,
  ChevronRight,
  Search,
  Sun,
  Moon,
  Trash2,
  CheckCircle,
  BarChart3,
  TrendingUp,
  AlertCircle,
  FileText,
  DollarSign,
  CreditCard,
  Wallet,
  ShoppingCart,
  Printer,
  Download,
  ChevronLeft,
  ChevronRight as ChevronRightIcon,
  Tag
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, parseISO, isToday } from 'date-fns';
import { DayPicker } from 'react-day-picker';
import 'react-day-picker/dist/style.css';

const isPromotionActive = (promo: any) => {
  if (!promo?.start_date || !promo?.end_date) return false;
  const now = new Date();
  const start = new Date(promo.start_date);
  const end = new Date(promo.end_date);
  return !isNaN(start.getTime()) && !isNaN(end.getTime()) && now >= start && now <= end;
};

const filterActivePromotions = (promotions: any[]) => (promotions || []).filter(isPromotionActive);

import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  AreaChart,
  Area
} from 'recharts';

// --- CONFIGURACIÓN DEL SISTEMA ---
const API_URL = '/api';
const EXCHANGE_RATE = 36.62; // Tipo de cambio NIO/USD (Nicaragua)

const formatUsd = (value: number = 0) => `$${Number(value || 0).toFixed(2)}`;
const formatNio = (value: number = 0) => `C$ ${Number(value || 0).toFixed(2)}`;
const getSaleClientName = (sale: any) => sale?.client_name || sale?.full_name || 'Venta particular';
const getSaleItemName = (item: any) => item?.item_name || item?.name || item?.item_type || 'Item';
const getSaleSubtotal = (sale: any) => Number(sale?.subtotal || (sale?.items || []).reduce((acc: number, item: any) => acc + ((item.quantity || 1) * (item.unit_price || item.price || 0)), 0) || sale?.total || 0);
const getSaleDiscount = (sale: any) => Number(sale?.discount_amount || Math.max(0, getSaleSubtotal(sale) - Number(sale?.total || 0)));

// --- TIPOS DE DATOS ---
interface Stats {
  clients_count: number;
  employees_count: number;
  services_count: number;
  today_income: number;
  low_stock: number;
}

// --- UTILIDADES ---

/**
 * Hook para gestionar el Modo Oscuro de manera global en el documento.
 */
const useDarkMode = () => {
  const [isDark, setIsDark] = useState(false);
  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDark]);
  return { isDark, toggle: () => setIsDark(!isDark) };
};

/**
 * Componente para imprimir factura.
 * Diseñado para ser proporcional a la información.
 */
const ReceiptPrinter = ({ sale }: { sale: any }) => {
  if (!sale) return null;
  const subtotal = getSaleSubtotal(sale);
  const discount = getSaleDiscount(sale);
  
  return (
    <div id="printable-receipt" className="p-8 bg-white text-black font-sans w-[80mm] mx-auto text-xs hidden print:block">
      <div className="text-center mb-6 flex flex-col items-center">
        <Logo className="scale-75 mb-2 !p-0 !bg-transparent !shadow-none" />
        <h2 className="text-xl font-serif font-black italic">Beauty Team Management</h2>
        <p className="uppercase tracking-widest text-[8px] font-bold">Professional Salon</p>
        <div className="mt-4 border-t border-dashed border-black pt-2 w-full">
          <p>Factura #{sale.id}</p>
          <p>{new Date(sale.created_at).toLocaleString()}</p>
        </div>
      </div>

      <div className="space-y-2 mb-6">
        <p><strong>Cliente:</strong> {sale.client_name || 'Particular'}</p>
        <p><strong>Teléfono:</strong> {sale.client_phone || '---'}</p>
        <p><strong>Atendido por:</strong> {sale.employee_name || 'Staff'}</p>
        {sale.payment_method && <p><strong>Pago:</strong> {sale.payment_method}</p>}
        {sale.promotion_title && <p><strong>Promo:</strong> {sale.promotion_title} ({sale.promotion_discount || 0}%)</p>}
      </div>

      <table className="w-full text-left mb-6 border-collapse">
        <thead className="border-b border-dashed border-black">
          <tr>
            <th className="py-1">Cant</th>
            <th className="py-1">Descripción</th>
            <th className="py-1 text-right">P/U</th>
            <th className="py-1 text-right">Total</th>
          </tr>
        </thead>
        <tbody>
          {sale.items?.map((item: any, idx: number) => (
            <tr key={idx}>
              <td className="py-1">{item.quantity || 1}</td>
              <td className="py-1">
                <span>{getSaleItemName(item)}</span>
                <span className="block text-[7px] uppercase opacity-60">{item.item_type === 'product' ? 'Producto' : item.item_type === 'service' ? 'Servicio' : item.item_type || 'Detalle'}</span>
                {item.employee_name && <span className="block text-[7px] uppercase opacity-60">Atendio: {item.employee_name}</span>}
              </td>
              <td className="py-1 text-right">${(item.unit_price || item.price || 0).toFixed(2)}</td>
              <td className="py-1 text-right">${((item.quantity || 1) * (item.unit_price || item.price || 0)).toFixed(2)}</td>
            </tr>
          ))}
          {!sale.items?.length && (
            <tr>
              <td colSpan={4} className="py-2 text-center text-slate-400">No hay descripción de items disponibles.</td>
            </tr>
          )}
        </tbody>
      </table>

      <div className="border-t border-dashed border-black pt-4 space-y-1 text-right">
        <div className="flex justify-between">
          <span>Subtotal:</span>
          <span>${subtotal.toFixed(2)}</span>
        </div>
        {discount > 0 && (
          <div className="flex justify-between">
            <span>Descuento:</span>
            <span>-${discount.toFixed(2)}</span>
          </div>
        )}
        <div className="flex justify-between text-lg font-black italic">
          <span>TOTAL:</span>
          <span>${sale.total.toFixed(2)}</span>
        </div>
        <p className="text-[9px] opacity-60">Equiv: C$ {(sale.total * EXCHANGE_RATE).toFixed(2)} NIO</p>
      </div>

      <div className="mt-8 text-center space-y-1">
        <p className="font-bold">¡Gracias por su visita!</p>
        <p className="text-[7px] uppercase tracking-tighter">Este documento no es una factura fiscal</p>
        
      </div>
    </div>
  );
};

/**
 * Pantalla de acceso. Nota: Se conecta al endpoint /api/login del backend.
 */
/**
 * Logo personalizado con estética de salón.
 */
const Logo = ({ className, invert = false }: { className?: string, invert?: boolean }) => {
  const [imageError, setImageError] = useState(false);
  const fill = invert ? '#ffffff' : '#173c36';
  const accent = '#c9a46a';
  const secondary = '#5b8f86';
  const gradientId = `logoGrad-${invert ? 'light' : 'dark'}`;

  return (
    <div className={`relative flex items-center justify-center overflow-hidden ${className}`}>
      {!imageError ? (
        <img
          src="/beauty-team-logo.jpeg"
          alt="Beauty Team Management"
          className="max-h-full max-w-full object-contain"
          onError={() => setImageError(true)}
        />
      ) : (
        <div className="flex items-center gap-3">
          <svg viewBox="0 0 120 60" className="w-16 h-auto" role="img" aria-label="Beauty Team Management logo">
            <defs>
              <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor={secondary} />
                <stop offset="100%" stopColor={accent} />
              </linearGradient>
            </defs>
            <path d="M16,30 C16,14 38,14 38,30 C38,46 16,46 16,30 Z M38,30 C38,14 60,14 60,30 C60,46 38,46 38,30 Z M64,30 C64,16 86,16 86,30 C86,44 64,44 64,30 Z"
              fill="none" stroke={`url(#${gradientId})`} strokeWidth="8" strokeLinecap="round" />
            <path d="M34,30 L62,30" fill="none" stroke={`url(#${gradientId})`} strokeWidth="8" strokeLinecap="round" />
          </svg>
          <div className="leading-none">
            <p className="brand-wordmark text-2xl font-bold" style={{ color: fill }}>Beauty Team</p>
            <p className="text-[9px] font-extrabold uppercase tracking-[0.28em]" style={{ color: accent }}>Management</p>
          </div>
        </div>
      )}
    </div>
  );
};

function LoginPage({ onLogin, isDark, setIsDark }: { onLogin: (user: any) => void, isDark: boolean, setIsDark: (val: boolean) => void }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const resp = await fetch(`${API_URL}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const data = await resp.json();
      if (resp.ok) {
        onLogin(data.user);
      } else {
        setError(data.message || 'Credenciales no autorizadas');
      }
    } catch (err) {
      console.error(err);
      setError("Error de conexión");
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }} animate={{ opacity: 1 }}
      className={`login-backdrop min-h-screen ${isDark ? 'dark' : ''} flex items-center justify-center p-4 sm:p-6 transition-colors duration-500 overflow-hidden`}
    >
      <div className="grid lg:grid-cols-[1.05fr_0.95fr] bg-white/92 dark:bg-[#141d1a]/95 rounded-[28px] shadow-2xl overflow-hidden max-w-6xl w-full border border-white/80 dark:border-white/10 relative z-10 backdrop-blur">
        
        {/* Lado Decorativo */}
        <div className="hidden lg:flex flex-col justify-between p-12 min-h-[680px] bg-[#121a17] text-[#f4e8b4] relative overflow-hidden">
          <div className="absolute inset-0">
             <img
               src="https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&w=1600&q=80"
               alt="Salón Beauty Team"
               className="h-full w-full object-cover opacity-70"
             />
             <div className="absolute inset-0 bg-[#121a17]/75" />
          </div>
          <div className="relative z-10 flex flex-col gap-6">
             <img src="/beauty-team-logo.jpeg" alt="Beauty Team Logo" className="h-32 w-auto rounded-2xl bg-white/95 p-6 shadow-sm object-contain" />
             <div>
                <h2 className="brand-wordmark text-6xl font-bold text-white leading-none">Beauty Team</h2>
                <span className="text-[11px] font-extrabold uppercase tracking-[0.45em] text-[#c9a46a] mt-3 block">Professional Salon</span>
             </div>
          </div>
          <div className="relative z-10 max-w-md">
            <p className="brand-wordmark text-4xl leading-tight text-white/95">Elegancia, cuidado y control en cada detalle.</p>
          </div>
          <p className="hidden">
            Elegancia, cuidado y perfección en cada detalle. Tu belleza, nuestra pasión.
          </p>
        </div>

        {/* Formulario */}
        <div className="flex flex-col justify-center p-8 sm:p-12 lg:p-14 w-full dark:text-white relative">
          <button 
            onClick={() => setIsDark(!isDark)}
            className="absolute top-5 right-5 h-11 w-11 rounded-full bg-[#f3e0a0] dark:bg-[#7f612e]/20 text-[#826036] hover:bg-[#c9a46a] hover:text-[#121a17] transition-all shadow-sm flex items-center justify-center"
            aria-label="Cambiar modo"
          >
            {isDark ? <Sun size={20} /> : <Moon size={20} />}
          </button>

          <div className="mb-10 text-center lg:text-left">
            <div className="lg:hidden mb-8 flex justify-center">
               <Logo className="h-28 w-56 rounded-2xl bg-[#f8f6f1] p-5" />
            </div>
{/*             <p className="text-[11px] font-extrabold uppercase tracking-[0.35em] text-[#c9a46a] mb-4">Portal privado</p>
 */}           <h2 className="brand-wordmark text-6xl font-bold mb-4 text-[#173c36] dark:text-white leading-none">Acceso Staff</h2>
            <p className="text-slate-400 font-bold tracking-widest uppercase text-[10px]">Portal de Gestión Administrativa</p>
          </div>

          <AnimatePresence>
            {error && (
              <motion.div 
                initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                className="bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/30 text-red-500 p-4 rounded-2xl mb-8 flex items-center justify-center gap-3 overflow-hidden text-center"
              >
                <AlertCircle size={20} />
                <p className="text-xs font-black uppercase tracking-tight">{error}</p>
              </motion.div>
            )}
          </AnimatePresence>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-[#5b8f86] ml-1">Correo Corporativo</label>
              <input 
                type="email" 
                value={username} 
                onChange={e => setUsername(e.target.value)} 
                placeholder="staff@beautyteam.com"
                className="w-full bg-[#f8f6f1] dark:bg-white/5 p-5 rounded-2xl outline-none focus:ring-4 focus:ring-[#5b8f86]/20 transition-all font-bold dark:text-white border border-[#e7e0d6] dark:border-white/10"
                required 
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-[#4d8b81] ml-2">Contraseña</label>
              <input 
                type="password" 
                value={password} 
                onChange={e => setPassword(e.target.value)} 
                className="w-full bg-[#f8f6f1] dark:bg-white/5 p-5 rounded-2xl outline-none focus:ring-4 focus:ring-[#5b8f86]/20 transition-all font-bold dark:text-white border border-[#e7e0d6] dark:border-white/10"
                required 
              />
            </div>

            <button 
              type="submit" 
              disabled={loading}
              className="w-full bg-[#173c36] text-white font-extrabold py-5 rounded-2xl text-base hover:bg-[#5b8f86] active:scale-[0.99] transition-all shadow-xl shadow-[#173c36]/15 disabled:opacity-50 mt-4 flex items-center justify-center gap-3"
            >
              {loading ? 'Validando...' : <>Entrar al Sistema <ChevronRight /></>}
            </button>
          </form>
        </div>
      </div>

      <div className="absolute bottom-10 left-10 grid grid-cols-5 gap-4 opacity-10">
        {[...Array(15)].map((_, i) => <div key={i} className="w-2 h-2 bg-[#c9a46a] rounded-full"></div>)}
      </div>
    </motion.div>
  );
}


// --- COMPONENTES UI REUTILIZABLES ---

const StatBox = ({ label, value, icon: Icon, color, isGreen, isWarning }: any) => (
  <div className={`p-6 rounded-[35px] shadow-sm border-2 border-white dark:border-slate-800 transition-all hover:scale-105 ${
    isGreen ? 'bg-emerald-50 dark:bg-emerald-900/10' : 
    isWarning ? 'bg-red-50 dark:bg-red-900/10' : 
    'bg-white dark:bg-slate-900/60'
  }`}>
    <div className="flex items-center justify-between mb-4">
      <div className={`p-3 rounded-2xl ${isGreen ? 'bg-emerald-500/10 text-emerald-500' : 'bg-[#4d8b81]/10 text-[#4d8b81]'}`}>
        <Icon size={24} />
      </div>
    </div>
    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-1">{label}</p>
    <h4 className={`text-2xl font-black font-display ${isGreen ? 'text-emerald-600' : isWarning ? 'text-red-500' : 'text-[#1a3a35] dark:text-white'}`}>{value}</h4>
  </div>
);

const HeaderTab = ({ active, label, icon: Icon, onClick }: any) => (
  <button
    onClick={onClick}
    className={`flex items-center gap-2 px-5 py-3 rounded-2xl font-extrabold text-sm transition-all duration-300 ${
      active 
      ? 'bg-[#173c36] text-white shadow-lg shadow-[#173c36]/10' 
      : 'text-[#66736d] dark:text-slate-400 hover:text-[#173c36] dark:hover:text-white hover:bg-white/60 dark:hover:bg-white/5'
    }`}
  >
    <Icon size={18} />
    {label}
  </button>
);

const SectionCard = ({ children, title, icon: Icon, className }: any) => (
  <div className={`card-primary dark:bg-slate-900/50 backdrop-blur-sm ${className}`}>
    <div className="flex items-center justify-between mb-8">
      <h3 className="text-3xl font-black font-display text-[#1a3a35] dark:text-white flex items-center gap-3">
        {Icon && <Icon size={28} className="text-[#4d8b81]" />}
        {title}
      </h3>
    </div>
    {children}
  </div>
);

// --- COMPONENTE PRINCIPAL ---

export default function App() {
  const [user, setUser] = useState<any>(() => {
    const saved = localStorage.getItem('currentUser');
    return saved ? JSON.parse(saved) : null;
  });
  const [activeTab, setActiveTab] = useState('Dashboard');
  const [isDark, setIsDark] = useState(() => {
    const saved = localStorage.getItem('theme');
    if (saved) return saved === 'dark';
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });
  const [stats, setStats] = useState<Stats | null>(null);
  const [data, setData] = useState<any>({
    clients: [], employees: [], services: [], products: [], appointments: [], sales: [], promotions: []
  });
  const [editingItem, setEditingItem] = useState<any>(null);

  const getDisplayName = (user: any) => {
    if (!user) return 'Invitado';
    const explicitName = user?.name || user?.full_name || user?.first_name || user?.display_name;
    if (explicitName) return explicitName;
    if (user?.username && user.username.includes('@')) {
      const namePart = user.username.split('@')[0];
      return namePart.charAt(0).toUpperCase() + namePart.slice(1);
    }
    return user?.username || 'Invitado';
  };

  const displayName = getDisplayName(user);

  useEffect(() => {
    const savedUser = localStorage.getItem('currentUser');
    if (savedUser) setUser(JSON.parse(savedUser));
  }, []);

  const handleLogin = (u: any) => {
    setUser(u);
    localStorage.setItem('currentUser', JSON.stringify(u));
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('currentUser');
  };

  // Efecto para dark mode persistente
  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDark]);

  // Carga de datos
  useEffect(() => {
    if (user) {
      refreshData();
    }
  }, [user, activeTab]);

  const refreshData = async () => {
    try {
      const endpoints = ['stats', 'clients', 'employees', 'services', 'products', 'appointments', 'sales', 'promotions'];
      for (const ep of endpoints) {
        const resp = await fetch(`${API_URL}/${ep}`);
        const json = await resp.json();
        if (ep === 'stats') setStats(json);
        else setData((prev: any) => ({ ...prev, [ep]: json }));
      }
    } catch (e) {
      console.error("Error al refrescar datos:", e);
    }
  };

  const handleDelete = async (id: number, type: string) => {
    if (!confirm('¿Estás seguro de eliminar este registro?')) return;
    try {
      const resp = await fetch(`${API_URL}/${type}s/${id}`, { method: 'DELETE' });
      if (resp.ok) refreshData();
    } catch (e) { console.error(e); }
  };

  const generateInvoicePdf = (sale: any) => {
    const doc = new jsPDF({ unit: 'pt', format: 'a4' });
    const margin = 40;
    const subtotal = getSaleSubtotal(sale);
    const discount = getSaleDiscount(sale);
    let y = 40;

    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.text('Beauty Team Management', margin, y);

    y += 30;
    doc.setFontSize(10);
    doc.text(`Factura #${sale.id}`, margin, y);
    doc.text(new Date(sale.created_at).toLocaleString('es-ES'), margin, y + 14);
    doc.text(`Cliente: ${sale.client_name || 'Particular'}`, margin, y + 34);
    doc.text(`Telefono: ${sale.client_phone || '---'}`, margin, y + 50);
    doc.text(`Atendido por: ${sale.employee_name || 'Staff'}`, margin, y + 66);
    doc.text(`Metodo de pago: ${sale.payment_method || 'N/A'}`, margin, y + 82);
    if (sale.promotion_title) doc.text(`Promocion: ${sale.promotion_title} (${sale.promotion_discount || 0}%)`, margin, y + 98);
    if (sale.payment_detail) doc.text(`Detalle: ${sale.payment_detail}`, margin, y + 114);

    y += 138;
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Cant', margin, y);
    doc.text('Descripción', margin + 80, y);
    doc.text('Precio', margin + 320, y, { align: 'right' });
    doc.text('Total', margin + 460, y, { align: 'right' });

    doc.setLineWidth(0.5);
    doc.line(margin, y + 4, 555, y + 4);
    y += 20;

    doc.setFont('helvetica', 'normal');
    (sale.items || []).forEach((item: any, idx: number) => {
      const cantidad = item.quantity || 1;
      const unitPrice = item.unit_price || item.price || 0;
      const totalLine = cantidad * unitPrice;
      doc.text(`${cantidad}`, margin, y);
      const description = item.item_name || item.name || item.item_type || 'Item';
      const itemLabel = `${item.item_type ? `${item.item_type === 'product' ? 'Producto' : item.item_type === 'service' ? 'Servicio' : item.item_type}: ` : ''}${description}${item.employee_name ? ` - Atendio: ${item.employee_name}` : ''}`;
      const descLines = doc.splitTextToSize(itemLabel, 220);
      doc.text(descLines, margin + 80, y);
      doc.text(`$${unitPrice.toFixed(2)}`, margin + 320, y, { align: 'right' });
      doc.text(`$${totalLine.toFixed(2)}`, margin + 460, y, { align: 'right' });
      y += Math.max(16, descLines.length * 14);
      if (y > 720) {
        doc.addPage();
        y = 40;
      }
    });

    y += 20;
    doc.setLineWidth(0.5);
    doc.line(margin, y, 555, y);
    y += 18;
    doc.setFont('helvetica', 'bold');
    doc.text(`Subtotal: $${subtotal.toFixed(2)}`, margin + 460, y, { align: 'right' });
    if (discount > 0) {
      y += 16;
      doc.text(`Descuento: -$${discount.toFixed(2)}`, margin + 460, y, { align: 'right' });
    }
    y += 18;
    doc.text(`Total: $${(sale.total || 0).toFixed(2)}`, margin + 460, y, { align: 'right' });
    y += 18;
    doc.setFont('helvetica', 'normal');
    doc.text(`Equiv: C$ ${((sale.total || 0) * EXCHANGE_RATE).toFixed(2)}`, margin + 460, y, { align: 'right' });

    doc.save(`factura-${sale.id}.pdf`);
  };

  const handlePrint = (saleId: number) => {
    const sale = data.sales.find((s: any) => s.id === saleId);
    if (!sale) return;
    setEditingItem({ isPrint: true, data: sale });
    setTimeout(() => {
      window.print();
      window.onafterprint = () => setEditingItem(null);
    }, 800);
  };

  const handleDownloadPdf = (saleId: number) => {
    const sale = data.sales.find((s: any) => s.id === saleId);
    if (!sale) return;
    generateInvoicePdf(sale);
  };

  if (!user || user.role === 'guest') {
    return <LoginPage onLogin={handleLogin} isDark={isDark} setIsDark={setIsDark} />;
  }

  return (
    <div className={`min-h-screen ${isDark ? 'dark bg-[#111715]' : 'bg-[#f3f0ea]'} text-[#173c36] dark:text-slate-100 font-sans transition-colors duration-500 overflow-x-hidden print:bg-white print:p-0`}>
      
      {/* HEADER COMPACTO */}
      <header className="p-4 sm:p-6 max-w-[1700px] mx-auto print:hidden">
        <div className="glass rounded-3xl p-3 pr-5 flex flex-wrap items-center justify-between gap-4 shadow-sm">
          
          <div className="flex items-center gap-4 pl-3">
             <img src="/beauty-team-logo.jpeg" alt="Beauty Team Logo" className="h-16 w-auto rounded-2xl bg-white/80 dark:bg-white/5 p-2 object-contain" />
             <div className="flex flex-col">
                <span className="brand-wordmark text-2xl md:text-3xl font-bold text-[#173c36] dark:text-white leading-none">Beauty Team</span>
                <span className="text-[9px] md:text-[10px] font-extrabold uppercase tracking-[0.28em] text-[#c9a46a] mt-1 ml-0.5 whitespace-nowrap">Professional Salon</span>
{/*                 <span className="mt-2 text-sm font-semibold text-[#826036] dark:text-[#f7e4a1]">Bienvenido, {displayName}</span>
 */}             </div>
          </div>


          <nav className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0 hide-scrollbar">
            <HeaderTab active={activeTab === 'Dashboard'} label="Resumen" icon={LayoutDashboard} onClick={() => setActiveTab('Dashboard')} />
            <HeaderTab active={activeTab === 'Promos'} label="Promos" icon={Tag} onClick={() => setActiveTab('Promos')} />
            <HeaderTab active={activeTab === 'Clientes'} label="Clientes" icon={Users} onClick={() => setActiveTab('Clientes')} />
            <HeaderTab active={activeTab === 'Agenda'} label="Agenda" icon={CalendarIcon} onClick={() => setActiveTab('Agenda')} />
            <HeaderTab active={activeTab === 'Staff'} label="Staff" icon={Scissors} onClick={() => setActiveTab('Staff')} />
            <HeaderTab active={activeTab === 'Servicios'} label="Servicios" icon={ShoppingBag} onClick={() => setActiveTab('Servicios')} />
            <HeaderTab active={activeTab === 'Productos'} label="Productos" icon={ShoppingBag} onClick={() => setActiveTab('Productos')} />
            <HeaderTab active={activeTab === 'Ventas'} label="Ventas" icon={Receipt} onClick={() => setActiveTab('Ventas')} />
            <HeaderTab active={activeTab === 'Reportes'} label="Gráfico de Ventas" icon={BarChart3} onClick={() => setActiveTab('Reportes')} />
          </nav>

          <div className="flex items-center gap-4">
             <button onClick={() => setIsDark(!isDark)} className="w-10 h-10 rounded-full bg-white dark:bg-slate-800 shadow-sm flex items-center justify-center hover:bg-slate-50 transition-colors">
                {isDark ? <Sun className="text-yellow-400" size={18} /> : <Moon className="text-[#4d8b81]" size={18} />}
             </button>
             <button onClick={handleLogout} className="w-10 h-10 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center hover:text-red-500 transition-all">
                <LogOut size={18} />
             </button>
          </div>
        </div>
      </header>

      {/* CONTENIDO PRINCIPAL SEGÚN PESTAÑA */}
      <main className="max-w-[1700px] mx-auto p-4 sm:p-6 pt-0 pb-20 print:hidden">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            {activeTab === 'Dashboard' && <Dashboard stats={stats} appointments={data.appointments} sales={data.sales} promotions={data.promotions} displayName={displayName} />}
            {activeTab === 'Promos' && <PromotionsSection data={data.promotions} onUpdate={refreshData} />}
            {activeTab === 'Clientes' && <GenericSection title="Clientes" data={data.clients} icon={Users} type="client" onUpdate={refreshData} onDelete={handleDelete} onEdit={setEditingItem} />}
            {activeTab === 'Agenda' && <AgendaSection appointments={data.appointments} clients={data.clients} employees={data.employees} services={data.services} onUpdate={refreshData} onDelete={handleDelete} onEdit={setEditingItem} />}
            {activeTab === 'Staff' && <GenericSection title="Staff" data={data.employees} icon={Scissors} type="employee" onUpdate={refreshData} onDelete={handleDelete} onEdit={setEditingItem} />}
            {activeTab === 'Servicios' && <GenericSection title="Menú de Servicios" data={data.services} icon={ShoppingBag} type="service" onUpdate={refreshData} onDelete={handleDelete} onEdit={setEditingItem} />}
            {activeTab === 'Productos' && <GenericSection title="Inventario" data={data.products} icon={ShoppingBag} type="product" onUpdate={refreshData} onDelete={handleDelete} onEdit={setEditingItem} isProductSection={true} />}
            {activeTab === 'Ventas' && <GenericSection title="Ventas Totales" data={data.sales} icon={Receipt} type="sale" onUpdate={refreshData} onDelete={handleDelete} onEdit={setEditingItem} clients={data.clients} appointments={data.appointments} services={data.services} products={data.products} onPrint={handlePrint} onDownloadPdf={handleDownloadPdf} />}
            {activeTab === 'Reportes' && <ReportesSection stats={stats} sales={data.sales} />}
          </motion.div>
        </AnimatePresence>
      </main>

      <ReceiptPrinter sale={editingItem?.isPrint ? editingItem.data : null} />

      {/* MODAL PARA COBRAR CITA */}
      <AnimatePresence>
        {activeTab === 'Agenda' && editingItem?.isCheckout && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/40 backdrop-blur-sm">
             <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-white dark:bg-slate-900 rounded-[40px] shadow-2xl p-10 max-w-4xl w-full max-h-[90vh] overflow-y-auto custom-scrollbar">
                <div className="flex justify-between items-center mb-8">
                   <h3 className="text-3xl font-black font-display flex items-center gap-3 italic text-[#4d8b81]"><Wallet /> Finalizar Servicio y Cobrar</h3>
                </div>
                <CheckoutAppointmentForm 
                  appointment={editingItem.data} 
                  onSuccess={() => { setEditingItem(null); refreshData(); setActiveTab('Ventas'); }} 
                  clients={data.clients} employees={data.employees} services={data.services} products={data.products} appointments={data.appointments}
                />
                <button onClick={() => setEditingItem(null)} className="mt-6 w-full text-slate-400 font-bold uppercase text-[10px] tracking-widest hover:text-slate-600">Cancelar Operación</button>
             </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL DE EDICIÓN */}
      <AnimatePresence>
        {editingItem && !editingItem.isCheckout && !editingItem.isPrint && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/40 backdrop-blur-sm">
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-white dark:bg-slate-900 rounded-[30px] shadow-2xl p-8 max-w-4xl w-full max-h-[90vh] overflow-y-auto custom-scrollbar">
               <h3 className="text-2xl font-black mb-6 flex items-center gap-3 uppercase italic"><Plus className="rotate-45" /> {editingItem.data ? 'Editar' : 'Registrar'} {editingItem.type}</h3>
               <FormRouter 
                  type={editingItem.type} 
                  initialData={editingItem.data} 
                  onSuccess={() => { setEditingItem(null); refreshData(); }} 
                  clients={data.clients} employees={data.employees} services={data.services} products={data.products}
               />
               <button onClick={() => setEditingItem(null)} className="mt-8 w-full p-3 text-slate-400 font-bold hover:text-slate-600 transition-colors uppercase tracking-widest text-[10px]">Cerrar Ventana</button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* FONDO DECORATIVO CON DIFUMINADO (GLOW EFFECTS) */}
      <div className="fixed top-0 left-0 -z-20 w-full h-full pointer-events-none transition-colors duration-500 overflow-hidden">
         <div className="absolute top-0 right-0 w-[1000px] h-[1000px] bg-[#4d8b81]/5 rounded-full blur-[180px] -mr-[500px] -mt-[500px]"></div>
         <div className="absolute bottom-0 left-0 w-[1000px] h-[1000px] bg-white/20 dark:bg-slate-900 rounded-full blur-[180px] -ml-[500px] -mb-[500px]"></div>
         <div className="absolute bottom-10 right-10 h-48 opacity-[0.08] grayscale pointer-events-none flex flex-col items-center">
             <p className="text-3xl font-serif font-black italic tracking-tighter uppercase">Management</p>
             <p className="text-xs font-black tracking-widest mt-1 uppercase">Salon & Spa Professional</p>
         </div>

         {isDark && <div className="absolute top-[30%] left-[20%] w-[500px] h-[500px] bg-indigo-900/10 rounded-full blur-[150px]"></div>}
      </div>
    </div>
  );
}

// --- SECCIONES ESPECÍFICAS ---

/**
 * Dashboard principal con tarjetas de resumen rápido.
 */
function Dashboard({ stats, appointments, sales, promotions, displayName }: any) {
  const activePromotions = filterActivePromotions(promotions);

  return (
    <div className="space-y-8 pb-10">
      {/* Banner Superior Compacto */}
      <div className="relative overflow-hidden rounded-[40px] border border-[#c9a46a]/20 bg-[#121a17] p-10 md:p-14 text-white shadow-xl shadow-[#c9a46a]/20">
{/*          <img src="/beauty-team-logo.jpeg" alt="Beauty Team Logo" className="absolute top-6 right-6 h-24 w-auto opacity-90 z-20 rounded-3xl bg-white/10 p-3" />
 */}         <div className="absolute inset-0 opacity-40">
            <img
              src="https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&w=1600&q=80"
              alt="Salón Beauty Team"
              className="h-full w-full object-cover"
            />
            <div className="absolute inset-0 bg-[#121a17]/70" />
         </div>
         <div className="relative z-10 max-w-3xl">
{/*             <p className="text-sm uppercase tracking-[0.35em] text-[#c9a46a]/90 mb-4">Beauty Team</p>
 */}            <h2 className="text-4xl md:text-5xl font-black font-display tracking-tight mb-2">Bienvenido, {displayName}</h2>
            <p className="text-base md:text-lg font-medium text-[#f4e8b4] max-w-2xl">Accede a tu salón en un espacio sobrio, elegante y contenido.</p>
         </div>
      </div>

      {/* Grid de Estadísticas Compacto */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
         <StatBox label="Clientes" value={stats?.clients_count ?? 0} icon={Users} color="teal" />
         <StatBox label="Staff" value={stats?.employees_count ?? 0} icon={Scissors} color="teal" />
         <StatBox label="Ventas" value={`$${stats?.today_income?.toFixed(2) ?? 0}`} icon={DollarSign} color="teal" isGreen />
         <StatBox label="Stock Bajo" value={stats?.low_stock ?? 0} icon={AlertCircle} color="teal" isWarning={stats?.low_stock > 0} />
      </div>

      <AnimatePresence>
        {stats?.low_stock > 0 && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }} 
            animate={{ opacity: 1, scale: 1 }}
            className="p-4 bg-red-50 dark:bg-red-900/20 border-2 border-red-100 dark:border-red-900/30 rounded-3xl flex items-center gap-4 text-red-600 dark:text-red-400"
          >
             <AlertCircle className="animate-bounce" />
             <div>
                <p className="font-black text-sm uppercase">Atención: Stock Crítico</p>
                <p className="text-xs opacity-80">Hay {stats.low_stock} productos que requieren reposición inmediata.</p>
             </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
         <SectionCard title="Próximas Citas" icon={CalendarIcon} className="shadow-lg">
            <div className="space-y-3">
               {(appointments || []).slice(0, 4).map((a: any) => (
                 <div key={a.id} className="flex justify-between items-center p-4 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border-2 border-white dark:border-slate-800 hover:border-[#4d8b81]/30 transition-all">
                    <div className="flex items-center gap-4">
                       <div className="w-10 h-10 bg-[#4d8b81]/10 rounded-full flex items-center justify-center font-bold text-[#4d8b81]">{a.client_name?.[0]}</div>
                       <div>
                          <p className="font-black text-sm text-[#1a3a35] dark:text-white">{a.client_name}</p>
                          <p className="text-[10px] text-slate-500 font-bold uppercase">{a.service_name}</p>
                       </div>
                    </div>
                    <p className="text-xs font-black text-[#4d8b81] bg-white dark:bg-slate-900 px-3 py-1 rounded-full border border-slate-100 dark:border-slate-800">{a.time}</p>
                 </div>
               ))}
            </div>
         </SectionCard>

         <SectionCard title="Ventas Recientes" icon={Receipt}>
            <div className="space-y-3">
               {(sales || []).slice(0, 4).map((s: any) => (
                 <div key={s.id} className="flex justify-between items-center p-4 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-100 dark:border-slate-800">
                    <div>
                        <p className="font-black text-lg">${s.total.toFixed(2)}</p>
                        <p className="text-[9px] text-slate-400 uppercase font-black tracking-widest">{s.client_name || 'Particular'}</p>
                    </div>
                    <div className="text-right">
                        <span className="text-[9px] font-black uppercase text-slate-400 block">{s.payment_method}</span>
                        {s.payment_detail && <span className="text-[7px] font-bold text-[#4d8b81] uppercase block truncate max-w-[100px]">{s.payment_detail}</span>}
                    </div>
                 </div>
               ))}
            </div>
         </SectionCard>

         <SectionCard title="Promociones Activas" icon={Tag}>
            <div className="space-y-3">
               {(promotions || []).slice(0, 3).map((p: any) => (
                 <div key={p.id} className="p-4 bg-[#4d8b81]/5 border border-[#4d8b81]/20 rounded-2xl">
                    <h4 className="text-sm font-black uppercase text-[#4d8b81]">{p.title}</h4>
                    <p className="text-[10px] text-slate-500 font-bold mt-1 line-clamp-1">{p.description}</p>
                    <div className="flex justify-between items-center mt-3 pt-3 border-t border-[#4d8b81]/10">
                       <span className="text-xs font-black text-[#4d8b81]">{p.discount_percent}% OFF</span>
                       <span className="text-[8px] font-black uppercase text-slate-400">Vence: {p.end_date}</span>
                    </div>
                 </div>
               ))}
               {activePromotions.length === 0 && <p className="text-center text-[10px] py-10 opacity-40 font-black uppercase tracking-widest">No hay promociones vigentes</p>}
            </div>
         </SectionCard>
      </div>
    </div>
  );
}

/**
 * Sección genérica para mostrar tablas y formularios de registro.
 */
function PromotionsSection({ data, onUpdate }: any) {
  const [showForm, setShowForm] = useState(false);
  
  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-5xl font-black font-display uppercase tracking-tight text-[#77b489] leading-none">Promociones</h2>
          <p className="text-[#6fa965] font-bold tracking-widest uppercase text-xs mt-2 ml-1">Ofertas y Eventos Especiales</p>
        </div>
        <button 
          onClick={() => setShowForm(!showForm)}
          className="bg-[#4d8b81] text-white px-8 py-3 rounded-2xl font-black text-sm shadow-xl hover:scale-105 transition-all flex items-center gap-2"
        >
          <Plus size={18} /> {showForm ? 'Cerrar' : 'Nueva Promo'}
        </button>
      </div>

      <AnimatePresence>
        {showForm && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden mb-8">
             <div className="bg-white dark:bg-slate-900 p-8 rounded-[40px] border-2 border-[#4d8b81]/20">
                <FormRouter type="promotion" onSuccess={() => { setShowForm(false); onUpdate(); }} />
             </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {(data || []).map((promo: any) => (
          <motion.div 
            key={promo.id} 
            whileHover={{ y: -5 }}
            className="card-primary dark:bg-slate-900/60 p-8 flex flex-col relative overflow-hidden group cursor-default"
          >
            <div className="absolute -right-6 -top-6 w-24 h-24 bg-[#4d8b81]/10 rounded-full flex items-center justify-center pt-6 pr-6 group-hover:bg-[#4d8b81]/20 transition-colors">
               <Tag className="text-[#4d8b81]" size={32} />
            </div>
            
            <div className="mb-6">
               <span className="text-[10px] font-black uppercase text-[#4d8b81] bg-[#4d8b81]/10 px-3 py-1 rounded-full mb-3 inline-block">Vence: {promo.end_date}</span>
               <h3 className="text-3xl font-black font-display leading-tight dark:text-white uppercase">{promo.title}</h3>
            </div>
            
            <p className="text-slate-500 dark:text-slate-400 font-medium leading-relaxed mb-6 flex-grow">{promo.description}</p>
            
            <div className="flex items-center justify-between border-t border-slate-100 dark:border-slate-800 pt-6">
               <div className="flex flex-col">
                  <span className="text-3xl font-black text-[#4d8b81]">{promo.discount_percent}% OFF</span>
                  <span className="text-[8px] font-black uppercase tracking-widest text-slate-400">Descuento aplicado</span>
               </div>
               <button onClick={async () => {
                 if (confirm('¿Eliminar promoción?')) {
                   await fetch(`${API_URL}/promotions/${promo.id}`, { method: 'DELETE' });
                   onUpdate();
                 }
               }} className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-400 hover:text-red-500 transition-all">
                 <Trash2 size={18} />
               </button>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

function AgendaSection({ appointments, clients, employees, services, onUpdate, onDelete, onEdit }: any) {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [viewMode, setViewMode] = useState<'calendar' | 'list'>('calendar');

  const appointmentsForDate = (appointments || []).filter((a: any) => isSameDay(parseISO(a.date), selectedDate));

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 mb-4">
         <div>
            <h2 className="text-5xl font-black font-display uppercase tracking-tight text-[#77b489]">Agenda Interactiva</h2>
            <div className="flex items-center gap-2 mt-2">
               <button 
                 onClick={() => setViewMode('calendar')}
                 className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${viewMode === 'calendar' ? 'bg-[#4d8b81] text-white shadow-lg' : 'bg-white dark:bg-slate-800 text-slate-400'}`}
               >
                 Calendario
               </button>
               <button 
                 onClick={() => setViewMode('list')}
                 className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${viewMode === 'list' ? 'bg-[#4d8b81] text-white shadow-lg' : 'bg-white dark:bg-slate-800 text-slate-400'}`}
               >
                 Lista Completa
               </button>
            </div>
         </div>
         
         <button 
           onClick={() => onEdit({ type: 'appointment', data: { start_time: format(selectedDate, "yyyy-MM-dd") + "T10:00" } })}
           className="bg-[#4d8b81] text-white px-10 py-4 rounded-2xl font-black text-sm shadow-xl hover:scale-105 transition-all flex items-center gap-2"
         >
           <Plus size={20} /> Agendar Nueva Cita
         </button>
      </div>

      {viewMode === 'calendar' ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Calendario Lateral */}
          <div className="lg:col-span-1">
             <div className="card-primary dark:bg-slate-900/60 p-6">
                <DayPicker
                  mode="single"
                  selected={selectedDate}
                  onSelect={(date) => date && setSelectedDate(date)}
                  locale={undefined}
                  className="mx-auto"
                  modifiers={{
                    hasEvent: (date) => (appointments || []).some((a: any) => isSameDay(parseISO(a.date), date))
                  }}
                  modifiersStyles={{
                    hasEvent: { 
                      fontWeight: 'bold', 
                      backgroundColor: '#4d8b8122',
                      borderRadius: '10px'
                    }
                  }}
                />
             </div>
          </div>

          {/* Citas del Día */}
          <div className="lg:col-span-2 space-y-6">
             <div className="flex items-center justify-between px-2">
                <h3 className="text-2xl font-black font-display uppercase italic tracking-tighter dark:text-white">
                  Citas para el {format(selectedDate, 'dd/MM/yyyy')}
                </h3>
                <span className="text-[10px] font-black uppercase tracking-widest text-[#4d8b81]">{appointmentsForDate.length} Servicios</span>
             </div>

             <div className="space-y-4">
                {appointmentsForDate.length === 0 ? (
                  <div className="card-primary dark:bg-slate-900 p-20 flex flex-col items-center justify-center text-center opacity-40">
                     <CalendarIcon size={48} className="mb-4" />
                     <p className="font-black uppercase tracking-widest text-sm">No hay citas para este día</p>
                  </div>
                ) : (
                  appointmentsForDate.map((a: any) => (
                    <motion.div 
                      key={a.id}
                      initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                      className="group bg-white dark:bg-slate-900 rounded-[30px] p-6 border-2 border-transparent hover:border-[#4d8b81]/30 transition-all shadow-sm flex flex-col md:flex-row justify-between items-center gap-6"
                    >
                      <div className="flex items-center gap-6 w-full">
                         <div className="w-16 h-16 bg-[#4d8b81]/10 rounded-2xl flex flex-col items-center justify-center font-black text-[#4d8b81]">
                            <span className="text-lg leading-none">{a.time.split(':')[0]}</span>
                            <span className="text-[10px] uppercase opacity-60">{a.time.split(':')[1]}</span>
                         </div>
                         <div className="flex-1">
                            <h4 className="text-xl font-black uppercase dark:text-white leading-tight group-hover:text-[#4d8b81] transition-colors">{a.client_name}</h4>
                            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mt-1">
                               <span className="text-[10px] font-bold uppercase text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded flex items-center gap-1">
                                  <Scissors size={10} /> {a.service_name}
                               </span>
                               <span className="text-[10px] font-bold uppercase text-slate-400 flex items-center gap-1">
                                  <Users size={10} /> {a.employee_name}
                               </span>
                            </div>
                         </div>
                      </div>
                      
                      <div className="flex items-center gap-3 w-full md:w-auto">
                        {a.status === 'Programada' && (
                          <button 
                            onClick={() => onEdit({ type: 'appointment', data: a, isCheckout: true })}
                            className="bg-[#4d8b81] text-white px-6 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-lg shadow-[#4d8b81]/20 hover:scale-105 active:scale-95 transition-all flex items-center gap-2"
                          >
                            <DollarSign size={14} /> Cobrar
                          </button>
                        )}
                        <span className={`px-4 py-2 rounded-2xl text-[9px] font-black uppercase tracking-widest ${a.status === 'Completada' ? 'bg-green-100 text-green-600' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'}`}>
                          {a.status}
                        </span>
                        <div className="flex gap-1">
                           <button onClick={() => onEdit({ type: 'appointment', data: a })} className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl hover:text-[#4d8b81] transition-all"><Plus size={16} className="rotate-45" /></button>
                           <button onClick={() => onDelete(a.id, 'appointment')} className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl hover:text-red-500 transition-all"><Trash2 size={16} /></button>
                        </div>
                      </div>
                    </motion.div>
                  ))
                )}
             </div>
          </div>
        </div>
      ) : (
        <GenericSection 
          title="Listado de Agenda" 
          data={appointments} 
          icon={CalendarIcon} 
          type="appointment" 
          onUpdate={onUpdate} 
          onDelete={onDelete} 
          onEdit={onEdit} 
          clients={clients} 
          employees={employees} 
          services={services} 
        />
      )}
    </div>
  );
}

function GenericSection({ title, data, icon, type, onUpdate, onDelete, onEdit, clients, employees, services, products, appointments, isProductSection, onPrint, onDownloadPdf }: any) {
  const [showForm, setShowForm] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [showStockEntry, setShowStockEntry] = useState(false);
  const [paymentFilter, setPaymentFilter] = useState('Todos');

  const saleMethods = ['Todos', ...Array.from(new Set((data || []).filter((item: any) => item.payment_method).map((item: any) => item.payment_method)))];
  const filteredData = data.filter((item: any) => {
    const searchVal = searchTerm.toLowerCase();
    const matchesSearch = (
      (item.name || '').toLowerCase().includes(searchVal) ||
      (item.full_name || '').toLowerCase().includes(searchVal) ||
      (item.brand || '').toLowerCase().includes(searchVal) ||
      (item.client_name || '').toLowerCase().includes(searchVal) ||
      (item.service_name || '').toLowerCase().includes(searchVal) ||
      (item.payment_method || '').toLowerCase().includes(searchVal) ||
      (item.payment_detail || '').toLowerCase().includes(searchVal) ||
      (item.items || []).some((detail: any) => getSaleItemName(detail).toLowerCase().includes(searchVal))
    );
    const matchesPayment = type !== 'sale' || paymentFilter === 'Todos' || item.payment_method === paymentFilter;
    return matchesSearch && matchesPayment;
  });
  const saleSummary = type === 'sale' ? filteredData.reduce((acc: any, sale: any) => {
    acc.total += Number(sale.total || 0);
    acc.items += (sale.items || []).reduce((sum: number, detail: any) => sum + Number(detail.quantity || 1), 0);
    return acc;
  }, { total: 0, items: 0 }) : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
         <div>
            <h2 className="text-4xl font-black font-display text-[#77b489] uppercase tracking-tight">{title}</h2>
            <p className="text-[#6fa965] font-bold uppercase tracking-widest text-[9px]">{filteredData.length} resultados encontrados</p>
         </div>
         <div className="flex items-center gap-3 w-full md:w-auto">
            <div className="relative flex-1 md:w-64">
               <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
               <input 
                 type="text" 
                 placeholder={`Buscar ${title.toLowerCase()}...`}
                 value={searchTerm}
                 onChange={e => setSearchTerm(e.target.value)}
                 className="w-full pl-9 pr-4 py-2 bg-white dark:bg-slate-900 rounded-xl text-xs outline-none border border-slate-100 dark:border-slate-800 focus:ring-1 focus:ring-[#4d8b81]"
               />
            </div>
            {isProductSection && (
               <button onClick={() => setShowStockEntry(!showStockEntry)} className="bg-slate-950 text-white px-5 py-2 rounded-xl font-black text-[10px] uppercase tracking-widest hover:scale-105 transition-all shadow-lg flex items-center gap-2">
                 <Plus size={14} /> Stock
               </button>
            )}
            <button onClick={() => setShowForm(!showForm)} className="bg-[#4d8b81] text-white px-6 py-2 rounded-xl font-black text-xs flex items-center gap-2 shadow-lg hover:scale-105 transition-all whitespace-nowrap">
               {showForm ? 'Cerrar' : <><Plus size={16} /> Registrar {type === 'sale' ? 'Venta' : ''}</>}
            </button>
         </div>
      </div>

      {type === 'sale' && (
        <div className="grid grid-cols-1 xl:grid-cols-[1.3fr_0.9fr] gap-5">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="bg-white dark:bg-slate-900/70 rounded-2xl p-5 border border-white/70 dark:border-slate-800 shadow-sm">
              <p className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400">Facturado</p>
              <p className="mt-2 text-3xl font-black text-[#4d8b81]">{formatUsd(saleSummary?.total || 0)}</p>
              <p className="text-[10px] font-bold text-slate-400">{formatNio((saleSummary?.total || 0) * EXCHANGE_RATE)} NIO</p>
            </div>
            <div className="bg-white dark:bg-slate-900/70 rounded-2xl p-5 border border-white/70 dark:border-slate-800 shadow-sm">
              <p className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400">Facturas</p>
              <p className="mt-2 text-3xl font-black text-[#1a3a35] dark:text-white">{filteredData.length}</p>
              <p className="text-[10px] font-bold text-slate-400">{saleSummary?.items || 0} items cobrados</p>
            </div>
            <div className="bg-white dark:bg-slate-900/70 rounded-2xl p-5 border border-white/70 dark:border-slate-800 shadow-sm">
              <p className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400">Promedio</p>
              <p className="mt-2 text-3xl font-black text-[#1a3a35] dark:text-white">{formatUsd(filteredData.length ? (saleSummary?.total || 0) / filteredData.length : 0)}</p>
              <p className="text-[10px] font-bold text-slate-400">por factura filtrada</p>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900/70 rounded-2xl p-4 border border-white/70 dark:border-slate-800 shadow-sm">
            <p className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400 mb-3">Método de pago</p>
            <div className="flex flex-wrap gap-2">
              {saleMethods.map((method: any) => (
                <button
                  key={method}
                  type="button"
                  onClick={() => setPaymentFilter(method)}
                  className={`px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${paymentFilter === method ? 'bg-[#4d8b81] text-white shadow-lg shadow-[#4d8b81]/20' : 'bg-slate-50 dark:bg-slate-800 text-slate-500 hover:text-[#4d8b81]'}`}
                >
                  {method}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <AnimatePresence>
         {showStockEntry && isProductSection && (
           <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
              <div className="bg-white dark:bg-slate-900 p-8 rounded-[40px] border-2 border-slate-950 mb-6 shadow-2xl">
                 <div className="flex items-center gap-4 mb-6">
                    <div className="w-12 h-12 bg-slate-950 rounded-2xl flex items-center justify-center text-white">
                       <Plus size={24} />
                    </div>
                    <div>
                       <h3 className="text-xl font-black uppercase italic tracking-tighter dark:text-white leading-none">Entrada de Mercancía</h3>
                       <p className="text-[9px] text-[#4d8b81] font-black uppercase tracking-widest mt-1">Suma unidades al inventario existente</p>
                    </div>
                 </div>
                 <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="space-y-1">
                       <label className="text-[9px] font-black uppercase text-[#4d8b81] ml-1">Producto</label>
                       <select id="stock-entry-prod" className="w-full bg-slate-50 dark:bg-slate-800 p-4 rounded-2xl text-xs font-bold outline-none border-2 border-transparent focus:border-[#4d8b81]">
                          <option value="">Seleccionar...</option>
                          {data.map((p: any) => <option key={p.id} value={p.id}>{p.name} — {p.brand} ({p.stock} ups)</option>)}
                       </select>
                    </div>
                    <div className="space-y-1">
                       <label className="text-[9px] font-black uppercase text-[#4d8b81] ml-1">Nuevas Unidades</label>
                       <input type="number" id="stock-entry-qty" className="w-full bg-slate-50 dark:bg-slate-800 p-4 rounded-2xl text-xs font-bold outline-none border-2 border-transparent focus:border-[#4d8b81]" placeholder="0" />
                    </div>
                    <div className="flex items-end">
                       <button 
                         onClick={async () => {
                            const pId = (document.getElementById('stock-entry-prod') as HTMLSelectElement).value;
                            const qty = (document.getElementById('stock-entry-qty') as HTMLInputElement).value;
                            if (!pId || !qty) return alert('Datos incompletos');
                            const pObj = data.find((x: any) => x.id === parseInt(pId));
                            const newStock = (pObj.stock || 0) + parseInt(qty);
                            await fetch(`${API_URL}/products/${pId}`, {
                               method: 'PUT',
                               headers: { 'Content-Type': 'application/json' },
                               body: JSON.stringify({ ...pObj, stock: newStock })
                            });
                            setShowStockEntry(false);
                            onUpdate();
                         }}
                         className="w-full bg-[#4d8b81] text-white font-black py-4 rounded-2xl text-[10px] uppercase tracking-widest hover:brightness-110 shadow-lg shadow-[#4d8b81]/20"
                       >
                          Actualizar Inventario
                       </button>
                    </div>
                 </div>
              </div>
           </motion.div>
         )}
      </AnimatePresence>

      <AnimatePresence>
        {showForm && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden mb-6">
             <div className="bg-white dark:bg-slate-900/60 p-6 rounded-[30px] border-2 border-[#4d8b81]/20">
                <FormRouter 
                  type={type} 
                  onSuccess={() => { setShowForm(false); onUpdate(); }} 
                  clients={clients} 
                  employees={employees} 
                  services={services} 
                  products={products}
                  appointments={appointments}
                />
             </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="card-primary dark:bg-slate-900/50 p-4 rounded-[30px] overflow-hidden">
         <div className="overflow-x-auto">
            <table className="w-full text-left">
               <thead className="text-[9px] uppercase font-black tracking-[0.2em] text-slate-400 border-b dark:border-slate-800">
                  <tr>
                     <th className="pb-4 pl-2 w-16">ID</th>
                     <th className="pb-4">Nombre / Info</th>
                               <th className="pb-4">{type === 'employee' ? 'Teléfono / Contacto' : (type === 'service' || type === 'product') ? 'Precio' : type === 'appointment' ? 'Fecha / Hora' : 'Contacto'}</th>
                     <th className="pb-4">{type === 'employee' ? 'Especialidad' : type === 'product' ? 'Stock / Valor' : type === 'service' ? 'Detalles' : type === 'sale' ? 'Detalle / Valor' : type === 'appointment' ? 'Estado / Pago' : 'Detalle / Valor'}</th>
                     <th className="pb-4 text-right pr-2">Acciones</th>
                  </tr>
               </thead>
               <tbody className="divide-y dark:divide-slate-800">
                  {filteredData.map((item: any) => (
                    <tr key={item.id} className="group hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors">
                       <td className="py-3 pl-2 font-black text-[#4d8b81]">#{item.id}</td>
                       <td className="py-3">
                          <p className="font-black text-sm group-hover:text-[#4d8b81] transition-colors">
                            {item.name || item.client_name || item.full_name}
                            {item.brand && <span className="ml-2 text-[10px] text-slate-400 font-bold opacity-60">({item.brand})</span>}
                          </p>
                          <p className="text-[10px] text-slate-400 font-bold truncate max-w-[200px]">{item.description || item.email || item.specialty || item.category}</p>
                       </td>
                       <td className="py-3">
                          <div className="flex flex-col">
                             {type === 'service' || type === 'product' ? (
                               <span className="text-emerald-600 font-black">${Number(item.price).toFixed(2)}</span>
                             ) : type === 'employee' ? (
                               <>
                                  <span className="text-sm font-black text-[#1a3a35] dark:text-white">{item.phone || '---'}</span>
                                  {item.email && <p className="text-[9px] text-slate-400 font-bold uppercase">{item.email}</p>}
                               </>
                             ) : type === 'appointment' ? (
                               <>
                                  <span className="text-sm font-black text-[#1a3a35] dark:text-white">{item.time} - {item.date}</span>
                                  <span className="text-[9px] text-slate-400 font-bold uppercase">{item.client_name || item.employee_name}</span>
                               </>
                             ) : (
                               <span className="text-sm font-black text-[#1a3a35] dark:text-white">{item.phone || item.email || '---'}</span>
                             )}
                          </div>
                       </td>
                       <td className="py-3">
                          {type === 'product' ? (
                            <div className="flex flex-col">
                               <span className={`text-[10px] font-black ${item.stock <= 5 ? 'text-red-500 animate-pulse' : 'text-slate-400'}`}>
                                 {item.stock} Unid. {item.stock <= 5 && '⚠️ BAJO'}
                               </span>
                               <span className="text-[9px] text-slate-400 opacity-60">${Number(item.price).toFixed(2)}</span>
                            </div>
                          ) : type === 'service' ? (
                            <div className="flex flex-col">
                               <span className="text-[10px] text-slate-400">{item.description || item.category || '---'}</span>
                               <span className="text-[9px] text-slate-400 opacity-60">{item.category || ''}</span>
                            </div>
                          ) : type === 'employee' ? (
                            <span className="text-[10px] text-slate-400 font-black uppercase">{item.specialty || item.category || '---'}</span>
                          ) : type === 'appointment' ? (
                            <div className="flex flex-col">
                               <span className={`text-[10px] font-black uppercase ${item.status === 'Completada' ? 'text-green-500' : 'text-[#4d8b81]'}`}>{item.status}</span>
                               <span className="text-[9px] text-slate-400 font-bold">{item.time} - {item.date}</span>
                            </div>
                          ) : type === 'sale' ? (
                             <div className="flex flex-col gap-1">
                                <span className="text-sm font-black text-emerald-600">${item.total.toFixed(2)}</span>
                                <div className="space-y-0.5">
                                   {item.items?.map((detail: any, idx: number) => (
                                      <div key={idx} className="flex items-center gap-1.5 text-[8px] font-bold text-slate-400 leading-none">
                                         <span className="bg-slate-100 dark:bg-slate-800 px-1 rounded uppercase tracking-tighter">
                                           {detail.quantity}x {detail.item_type === 'product' ? '📦' : '✂️'}
                                         </span>
                                         <span className="truncate max-w-[80px]">{detail.item_name}</span>
                                         <span className="text-[#4d8b81]">${detail.unit_price}</span>
                                      </div>
                                   ))}
                                </div>
                                <span className="text-[9px] font-black uppercase opacity-40 mt-1">
                                   {item.payment_method} 
                                   {item.payment_detail && <span className="ml-1 text-[#4d8b81]">— {item.payment_detail}</span>}
                                </span>
                             </div>
                           ) :
                           <span className="text-[10px] italic text-slate-400 truncate max-w-[150px] inline-block">{item.notes || '---'}</span>}
                       </td>
                       <td className="py-3 text-right pr-2">
                          <div className={`flex justify-end gap-1 transition-opacity ${type === 'sale' ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                             {type === 'appointment' && item.status === 'Programada' && (
                               <button 
                                 onClick={(e) => { e.stopPropagation(); onEdit({ type, data: item, isCheckout: true }); }} 
                                 className="p-2 bg-[#4d8b81] text-white rounded-lg flex items-center gap-1 text-[10px] font-black uppercase px-3 shadow-md active:scale-95 transition-all"
                               >
                                 <DollarSign size={12} /> Cobrar
                               </button>
                             )}
                             <button onClick={(e) => { e.stopPropagation(); onEdit({ type, data: item }); }} className="p-2 bg-slate-100 dark:bg-slate-800 rounded-lg hover:text-[#4d8b81] transition-all"><Plus size={14} className="rotate-45" /></button>
                             <button onClick={(e) => { e.stopPropagation(); onDelete(item.id, type); }} className="p-2 bg-slate-100 dark:bg-slate-800 rounded-lg hover:text-red-500 transition-all"><Trash2 size={14} /></button>
                             {type === 'sale' && onPrint && (
                                <>
                                  <button 
                                    onClick={(e) => { e.stopPropagation(); onPrint(item.id); }} 
                                    className="p-2 bg-[#4d8b81]/20 text-[#4d8b81] rounded-lg hover:bg-[#4d8b81] hover:text-white transition-all shadow-sm"
                                    title="Imprimir Factura"
                                  >
                                    <Printer size={14} />
                                  </button>
                                  <button 
                                    onClick={(e) => { e.stopPropagation(); onDownloadPdf?.(item.id); }} 
                                    className="p-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-all shadow-sm"
                                    title="Descargar Factura PDF"
                                  >
                                    <Download size={14} />
                                  </button>
                                </>
                              )}
                          </div>
                       </td>
                    </tr>
                  ))}
               </tbody>
            </table>
         </div>
      </div>
    </div>
  );
}

/**
 * Sección de Reportes con visualización de datos.
 */
function ReportesSection({ stats, sales }: any) {
  // Procesar datos para el gráfico de ventas
  const chartData = (sales || []).slice(0, 15).reverse().map((s: any) => ({
    name: new Date(s.created_at).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' }),
    total: s.total
  }));

  const allItems = (sales || []).flatMap((sale: any) => (sale.items || []).map((item: any) => ({
    ...item,
    item_name: item.item_name || item.name || 'Sin nombre',
    item_type: item.item_type || 'product'
  })));

  const countItems = (items: any[]) => items.reduce((acc: any, item: any) => {
    const key = item.item_name;
    acc[key] = acc[key] || { item_name: key, quantity: 0, revenue: 0 };
    const qty = Number(item.quantity || 1);
    const price = Number(item.unit_price || item.price || 0);
    acc[key].quantity += qty;
    acc[key].revenue += qty * price;
    return acc;
  }, {});

  const serviceSummary = Object.values(countItems(allItems.filter((item: any) => item.item_type === 'service')));
  const productSummary = Object.values(countItems(allItems.filter((item: any) => item.item_type === 'product')));
  const topService = (serviceSummary.sort((a: any, b: any) => b.quantity - a.quantity) as any[])[0];
  const topProducts = (productSummary.sort((a: any, b: any) => b.quantity - a.quantity) as any[]).slice(0, 8);

  return (
    <div className="space-y-10">
       <div className="space-y-2">
          <h2 className="text-6xl font-black font-display uppercase tracking-tight text-[#77b489]">Gráfico de Ventas</h2>
          <p className="text-[#6fa965] font-bold tracking-widest uppercase text-sm">Rendimiento Comercial Salon Pro</p>
       </div>

       <div className="grid grid-cols-1 gap-10">
          <SectionCard title="Crecimiento de Ventas ($)" icon={TrendingUp}>
             <div className="h-[400px] w-full pt-10">
                <ResponsiveContainer width="100%" height="100%">
                   <AreaChart data={chartData}>
                      <defs>
                         <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#4d8b81" stopOpacity={0.3}/>
                            <stop offset="95%" stopColor="#4d8b81" stopOpacity={0}/>
                         </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} strokeOpacity={0.1} />
                      <XAxis 
                        dataKey="name" 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{ fontSize: 10, fontWeight: 'bold', fill: '#94a3b8' }} 
                      />
                      <YAxis 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{ fontSize: 10, fontWeight: 'bold', fill: '#94a3b8' }} 
                        tickFormatter={(v) => `$${v}`}
                      />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#fff', borderRadius: '15px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                        itemStyle={{ color: '#4d8b81', fontWeight: 'bold' }}
                      />
                      <Area 
                        type="monotone" 
                        dataKey="total" 
                        stroke="#4d8b81" 
                        strokeWidth={4}
                        fillOpacity={1} 
                        fill="url(#colorTotal)" 
                      />
                   </AreaChart>
                </ResponsiveContainer>
             </div>
          </SectionCard>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
             <SectionCard title="Métricas de Calidad" icon={BarChart3}>
                <div className="space-y-8">
                   <ProgressRow label="Eficiencia del Personal" value={88} color="teal" />
                   <ProgressRow label="Retención de Clientes" value={74} color="indigo" />
                   <ProgressRow label="Meta de Ventas" value={92} color="emerald" />
                   <ProgressRow label="Satisfacción" value={95} color="orange" />
                </div>
             </SectionCard>

             <SectionCard title="Distribución de Ingresos" icon={DollarSign}>
                <div className="flex flex-col justify-center h-full space-y-6">
                   <div className="p-6 bg-slate-50 dark:bg-slate-800 rounded-3xl">
                      <p className="text-[10px] font-black uppercase text-slate-400 mb-1">Total Histórico</p>
                      <h3 className="text-4xl font-black text-[#4d8b81]">${(sales?.reduce((acc: any, curr: any) => acc + curr.total, 0) || 0).toFixed(2)}</h3>
                   </div>
                   <div className="grid grid-cols-2 gap-4">
                      <div className="p-4 border-2 border-slate-50 dark:border-slate-800 rounded-2xl">
                         <p className="text-[9px] font-black uppercase text-slate-400">Promedio Ticket</p>
                         <p className="text-xl font-black">${(sales?.length > 0 ? sales.reduce((a:any,c:any)=>a+c.total,0)/sales.length : 0).toFixed(2)}</p>
                      </div>
                      <div className="p-4 border-2 border-slate-50 dark:border-slate-800 rounded-2xl">
                         <p className="text-[9px] font-black uppercase text-slate-400">Total Transacciones</p>
                         <p className="text-xl font-black">{sales?.length || 0}</p>
                      </div>
                   </div>
                </div>
             </SectionCard>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
             <SectionCard title="Servicio más vendido" icon={Scissors}>
                <div className="space-y-4">
                   <p className="text-[10px] uppercase tracking-[0.2em] text-slate-400">Top servicio por cantidad vendida</p>
                   {topService ? (
                     <div className="space-y-2">
                        <h3 className="text-3xl font-black text-[#4d8b81]">{topService.item_name}</h3>
                        <p className="text-sm uppercase tracking-[0.2em] text-slate-500">Cantidad: {topService.quantity}</p>
                        <p className="text-sm font-bold text-slate-600">Ingresos: ${topService.revenue.toFixed(2)}</p>
                     </div>
                   ) : (
                     <p className="text-sm text-slate-500">No hay datos de servicios vendidos aún.</p>
                   )}
                </div>
             </SectionCard>

             <SectionCard title="Top 8 Productos" icon={ShoppingBag} className="lg:col-span-2">
                <div className="space-y-3">
                   {topProducts.length > 0 ? topProducts.map((product: any, idx: number) => (
                     <div key={product.item_name} className="flex items-center justify-between gap-4 p-3 bg-slate-50 dark:bg-slate-800 rounded-3xl border border-slate-100 dark:border-slate-900">
                        <div>
                           <p className="font-black text-sm">#{idx + 1} {product.item_name}</p>
                           <p className="text-[10px] uppercase tracking-[0.2em] text-slate-400">Vendidos: {product.quantity}</p>
                        </div>
                        <div className="text-right">
                           <p className="font-black text-[#4d8b81]">${product.revenue.toFixed(2)}</p>
                           <p className="text-[10px] text-slate-400">Precio promedio: ${(product.revenue / product.quantity).toFixed(2)}</p>
                        </div>
                     </div>
                   )) : (
                     <p className="text-sm text-slate-500">Aún no hay productos registrados en ventas.</p>
                   )}
                </div>
             </SectionCard>
          </div>
       </div>
    </div>
  );
}

// --- MICRO-COMPONENTE PARA REPORTES ---

function ProgressRow({ label, value, color }: any) {
  return (
    <div className="space-y-3">
       <div className="flex justify-between items-center px-2 font-black text-xs uppercase tracking-widest opacity-60">
          <span>{label}</span>
          <span>{value}%</span>
       </div>
       <div className="h-4 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
          <motion.div 
            initial={{ width: 0 }} animate={{ width: `${value}%` }} transition={{ duration: 1, ease: 'easeOut' }}
            className={`h-full bg-${color}-500 rounded-full`}
            style={{ backgroundColor: color === 'teal' ? '#4d8b81' : undefined }}
          />
       </div>
    </div>
  );
}

// --- ROUTER DE FORMULARIOS ---

function FormField({ label, field, type = 'text', value, onChange, required = true }: any) {
  const inputType = field === 'phone' ? 'tel' : type;
  const inputMode = field === 'phone' ? 'numeric' : undefined;
  const maxLength = field === 'phone' ? 8 : undefined;

  return (
    <div className="space-y-1">
       <label className="text-[10px] font-black uppercase tracking-widest text-[#4d8b81] ml-1">{label}</label>
       <input 
         required={required} 
         type={inputType} 
         inputMode={inputMode}
         maxLength={maxLength}
         value={value || ''}
         className="w-full bg-slate-50 dark:bg-slate-800 p-3 rounded-xl border-none outline-none focus:ring-2 focus:ring-[#4d8b81]/30 dark:text-white text-sm"
         onChange={onChange} 
       />
    </div>
  );
}

function FormRouter({ type, onSuccess, initialData, clients, employees, services, products, appointments }: any) {
  const [formData, setFormData] = useState<any>(initialData || (
    type === 'appointment' ? { start_time: format(new Date(), "yyyy-MM-dd'T'HH:mm"), status: 'Programada' } :
    type === 'product' ? { category: 'General', brand: 'Genérica', stock: 0 } :
    type === 'client' ? { name: '', phone: '', email: '' } :
    type === 'employee' ? { name: '', specialty: '', phone: '', commission_percent: 0 } :
    { items: [] }
  ));
  const [error, setError] = useState('');
  const [cart, setCart] = useState<any[]>(initialData?.items || []);
  const [currency, setCurrency] = useState('USD');
  const [montoRecibido, setMontoRecibido] = useState<number | string>('');
  const [promotions, setPromotions] = useState<any[]>([]);
  const [selectedPromo, setSelectedPromo] = useState<any>(null);

  useEffect(() => {
    if (type === 'sale') {
      fetch(`${API_URL}/promotions`).then(r => r.json()).then(setPromotions).catch(console.error);
    }
  }, [type]);

  const validPromotions = filterActivePromotions(promotions);
  const calculateCartSubtotal = () => cart.reduce((acc, curr) => acc + (curr.price * curr.quantity), 0);
  const calculateCartDiscount = () => selectedPromo ? (calculateCartSubtotal() * Number(selectedPromo.discount_percent || 0)) / 100 : 0;
  const calculateCartTotal = () => Math.max(0, calculateCartSubtotal() - calculateCartDiscount());
  const dueAppointments = (appointments || []).filter((appt: any) => {
    if (type !== 'sale' || !formData.client_id) return false;
    return String(appt.client_id) === String(formData.client_id) && appt.status === 'Programada';
  }).sort((a: any, b: any) => new Date(a.start_time || `${a.date}T${a.time}`).getTime() - new Date(b.start_time || `${b.date}T${b.time}`).getTime());

  const checkCartStock = () => {
    for (const item of cart) {
      if (item.type === 'product') {
        const prod = products?.find((p: any) => p.id === item.id);
        if (prod && prod.stock < item.quantity) {
          return { available: false, name: prod.name, stock: prod.stock };
        }
      }
    }
    return { available: true };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if ((type === 'client' || type === 'employee') && (!formData.phone || String(formData.phone).replace(/\D/g, '').length !== 8)) {
      setError('El teléfono debe tener exactamente 8 dígitos.');
      return;
    }

    if (type === 'sale') {
      if (cart.length === 0) {
        setError('Debes agregar al menos un producto o servicio.');
        return;
      }
      const stockStatus = checkCartStock();
      if (!stockStatus.available) {
        setError(`Stock insuficiente para ${stockStatus.name} (Disponible: ${stockStatus.stock})`);
        return;
      }
    }

    if (type === 'appointment') {
      const selectedTime = new Date(formData.start_time);
      const now = new Date();
      if (selectedTime < now) {
        setError('No puedes programar citas en el pasado.');
        return;
      }
    }

    const method = initialData ? 'PUT' : 'POST';
    let url = initialData ? `${API_URL}/${type}s/${initialData.id}` : `${API_URL}/${type}s`;
    if (type === 'sale' && !initialData) url = `${API_URL}/sales_detailed`;

    try {
      const body = { ...formData };
      
      if (type === 'sale') {
        if (!body.payment_method) {
          setError('Selecciona un método de pago.');
          return;
        }
        if ((body.payment_method === 'Transferencia' || body.payment_method === 'Tarjeta') && !body.payment_detail) {
          setError('Selecciona el detalle de pago.');
          return;
        }

        const subtotal = calculateCartSubtotal();
        const discountAmount = calculateCartDiscount();
        const total = calculateCartTotal();
        const appointmentItem = cart.find(item => item.appointment_id);
        body.items = cart;
        body.subtotal = subtotal;
        body.discount_amount = discountAmount;
        body.promotion_title = selectedPromo?.title || null;
        body.promotion_discount = selectedPromo?.discount_percent || 0;
        body.employee_id = appointmentItem?.employee_id || null;
        body.appointment_id = appointmentItem?.appointment_id || null;
        body.total = total;
        body.created_by_id = JSON.parse(localStorage.getItem('currentUser') || '{}').id || 1;
        
        if (body.payment_method === 'Efectivo' && montoRecibido) {
           const recibido = Number(montoRecibido);
           const totalEnMoneda = currency === 'NIO' ? total * EXCHANGE_RATE : total;
           const cambio = currency === 'NIO' ? (recibido - totalEnMoneda) : ((recibido - total) * EXCHANGE_RATE);
           body.payment_detail = `Recibido: ${currency} ${recibido} | Cambio: C$ ${cambio.toFixed(2)}`;
        }
      }

      const resp = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      if (resp.ok) {
        onSuccess();
      } else {
        const errData = await resp.json();
        setError(errData.message || errData.error || 'Error al procesar la solicitud');
      }
    } catch (e) {
      setError('Error de conexión');
    }
  };

  const updateField = (field: string, val: any) => {
    let sanitized = val;
    if (field === 'phone') {
      sanitized = String(val).replace(/\D/g, '').slice(0, 8);
    }
    if (field === 'name' || field === 'specialty') {
      sanitized = String(val).replace(/[^a-zA-ZÀ-ÿ\s]/g, '').replace(/\s{2,}/g, ' ');
    }
    setFormData({ ...formData, [field]: sanitized });
  };

  const addToCart = (item: any, itemType: 'product' | 'service') => {
    const existing = cart.find(c => c.id === item.id && c.type === itemType);
    if (existing) {
      setCart(cart.map(c => c.id === item.id && c.type === itemType ? { ...c, quantity: c.quantity + 1 } : c));
    } else {
      setCart([...cart, { ...item, type: itemType, quantity: 1 }]);
    }
  };

  const addAppointmentToCart = (appointment: any) => {
    if (cart.some(item => item.appointment_id === appointment.id)) return;
    const service = services?.find((s: any) => s.id === appointment.service_id);
    setCart([
      ...cart,
      {
        id: appointment.service_id,
        type: 'service',
        name: appointment.service_name || service?.name || 'Servicio agendado',
        price: appointment.price || service?.price || 0,
        quantity: 1,
        appointment_id: appointment.id,
        employee_id: appointment.employee_id,
        employee_name: appointment.employee_name
      }
    ]);
  };

  const updateCartQuantity = (itemId: any, itemType: any, quantity: number) => {
    if (quantity <= 0) {
      setCart(cart.filter(c => !(c.id === itemId && c.type === itemType)));
      return;
    }
    setCart(cart.map(c => c.id === itemId && c.type === itemType ? { ...c, quantity } : c));
  };

  return (
    <div className="space-y-4">
      {error && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-red-50 text-red-500 p-3 rounded-xl text-xs font-bold border border-red-100 italic">
           ⚠️ {error}
        </motion.div>
      )}
      
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className={`grid grid-cols-1 md:grid-cols-2 ${type === 'sale' ? 'lg:grid-cols-1' : 'lg:grid-cols-3'} gap-5`}>
          {type === 'client' && (
            <>
                <FormField label="Nombre" field="name" value={formData.name} onChange={(e: any) => updateField('name', e.target.value)} />
                <FormField label="Teléfono" field="phone" value={formData.phone} onChange={(e: any) => updateField('phone', e.target.value)} />
                <FormField label="Email" field="email" type="email" value={formData.email} onChange={(e: any) => updateField('email', e.target.value)} required={false} />
            </>
          )}

          {type === 'appointment' && (
            <>
                <div className="space-y-1">
                   <label className="text-[10px] font-black uppercase tracking-widest text-[#4d8b81] ml-1">Cliente</label>
                   <select required className="select-primary" value={formData.client_id || ''} onChange={e => updateField('client_id', e.target.value)}>
                     <option value="">Seleccionar Cliente</option>
                     {clients?.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                   </select>
                </div>
                <div className="space-y-1">
                   <label className="text-[10px] font-black uppercase tracking-widest text-[#4d8b81] ml-1">Especialista</label>
                   <select required className="select-primary" value={formData.employee_id || ''} onChange={e => updateField('employee_id', e.target.value)}>
                     <option value="">Seleccionar Staff</option>
                     {employees?.map((e: any) => <option key={e.id} value={e.id}>{e.name}</option>)}
                   </select>
                </div>
                <div className="space-y-1">
                   <label className="text-[10px] font-black uppercase tracking-widest text-[#4d8b81] ml-1">Servicio</label>
                   <select required className="select-primary" value={formData.service_id || ''} onChange={e => updateField('service_id', e.target.value)}>
                     <option value="">Seleccionar Servicio</option>
                     {services?.map((s: any) => <option key={s.id} value={s.id}>{s.name} - ${s.price}</option>)}
                   </select>
                </div>
                <FormField label="Fecha y Hora" field="start_time" type="datetime-local" value={formData.start_time} onChange={(e: any) => updateField('start_time', e.target.value)} />
            </>
          )}

          {type === 'sale' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="space-y-1">
                     <label className="text-[10px] font-black uppercase tracking-widest text-[#4d8b81]">Cliente (Opcional)</label>
                     <select className="select-primary" value={formData.client_id || ''} onChange={e => updateField('client_id', e.target.value)}>
                       <option value="">Venta Particular</option>
                       {clients?.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                     </select>
                  </div>
                  {dueAppointments.length > 0 && (
                    <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-900/40 rounded-2xl space-y-3">
                      <p className="text-[10px] font-black uppercase tracking-widest text-amber-700">Citas pendientes de cobro</p>
                      {dueAppointments.map((appt: any) => (
                        <div key={appt.id} className="flex items-center justify-between gap-3 text-xs">
                          <div className="min-w-0">
                            <p className="font-black truncate">{appt.service_name}</p>
                            <p className="text-[10px] font-bold text-amber-700/70">{appt.employee_name} - {appt.date} {appt.time}</p>
                          </div>
                          <button type="button" onClick={() => addAppointmentToCart(appt)} className="px-3 py-2 rounded-xl bg-amber-600 text-white text-[9px] font-black uppercase tracking-widest disabled:opacity-40" disabled={cart.some(item => item.appointment_id === appt.id)}>
                            {cart.some(item => item.appointment_id === appt.id) ? 'Agregada' : 'Cobrar'}
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="space-y-1">
                     <label className="text-[10px] font-black uppercase tracking-widest text-[#4d8b81]">Promocion</label>
                     <select className="select-primary" value={selectedPromo?.id || ''} onChange={e => {
                       const promo = validPromotions.find((p: any) => p.id === parseInt(e.target.value));
                       setSelectedPromo(promo || null);
                     }}>
                       <option value="">Sin promocion</option>
                       {validPromotions.map((promo: any) => <option key={promo.id} value={promo.id}>{promo.title} ({promo.discount_percent}%)</option>)}
                     </select>
                  </div>
                  <div className="space-y-1">
                     <label className="text-[10px] font-black uppercase tracking-widest text-[#4d8b81]">Método de Pago</label>
                     <select required className="select-primary" value={formData.payment_method || ''} onChange={e => updateField('payment_method', e.target.value)}>
                       <option value="">Seleccionar...</option>
                       <option value="Efectivo">Efectivo</option>
                       <option value="Transferencia">Transferencia BAC</option>
                       <option value="Tarjeta">Tarjeta / POS</option>
                     </select>
                  </div>

                  <AnimatePresence>
                    {formData.payment_method === 'Transferencia' && (
                      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-3">
                        <div className="space-y-1">
                           <label className="text-[10px] font-black uppercase text-[#4d8b81] ml-1">Cuenta de Destino</label>
                           <select required className="select-primary" value={formData.payment_detail || ''} onChange={e => updateField('payment_detail', e.target.value)}>
                             <option value="">Seleccionar Cuenta...</option>
                             <option value="BAC Dólares (363214589)">BAC Dólares (***589)</option>
                             <option value="BAC Córdobas (351478236)">BAC Córdobas (***236)</option>
                           </select>
                        </div>
                        <div className="p-4 bg-[#f7eed5] dark:bg-[#2f291d]/70 border border-[#d4b67c] rounded-2xl">
                           <p className="text-[10px] font-black uppercase mb-3 text-[#8b6d34] dark:text-[#efd089] flex items-center gap-2"><CreditCard size={14} /> Información BAC</p>
                           <div className="space-y-2 text-[11px] font-bold text-[#2f2415] dark:text-[#f5e4aa]">
                              <div className="flex justify-between border-b border-[#ddc292] pb-1">
                                 <span className="opacity-60">Dólares:</span>
                                 <span>363214589</span>
                              </div>
                              <div className="flex justify-between">
                                 <span className="opacity-60">Córdobas:</span>
                                 <span>351478236</span>
                              </div>
                           </div>
                        </div>
                      </motion.div>
                    )}
                    {formData.payment_method === 'Tarjeta' && (
                      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-1">
                         <label className="text-[10px] font-black uppercase text-[#4d8b81] ml-1">Terminal / Banco</label>
                         <select required className="select-primary w-full" value={formData.payment_detail || ''} onChange={e => updateField('payment_detail', e.target.value)}>
                            <option value="">Seleccionar Banco...</option>
                            <option value="BAC Credomatic">BAC Credomatic</option>
                            <option value="LAFISE">LAFISE</option>
                            <option value="BANPRO">BANPRO</option>
                            <option value="FICHOSA">FICHOSA</option>
                         </select>
                      </motion.div>
                    )}
                    {formData.payment_method === 'Efectivo' && (
                      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="p-5 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 rounded-3xl space-y-4">
                         <div className="flex justify-between items-center mb-2">
                             <div className="flex gap-2">
                                <button type="button" onClick={() => setCurrency('USD')} className={`px-2 py-1 rounded text-[8px] font-black uppercase ${currency === 'USD' ? 'bg-emerald-600 text-white' : 'bg-white text-emerald-600'}`}>USD</button>
                                <button type="button" onClick={() => setCurrency('NIO')} className={`px-2 py-1 rounded text-[8px] font-black uppercase ${currency === 'NIO' ? 'bg-emerald-600 text-white' : 'bg-white text-emerald-600'}`}>NIO</button>
                             </div>
                             <span className="text-[10px] font-black text-emerald-700">Total: {currency === 'NIO' ? `C$ ${(calculateCartTotal() * EXCHANGE_RATE).toFixed(2)}` : `$ ${calculateCartTotal().toFixed(2)}`}</span>
                         </div>
                         <div className="space-y-1">
                            <label className="text-[10px] font-black uppercase text-emerald-600">Monto Recibido ({currency})</label>
                            <div className="grid grid-cols-2 gap-2">
                               <input 
                                 type="number" 
                                 step="0.01"
                                 value={montoRecibido}
                                 className="bg-white dark:bg-slate-800 p-3 rounded-xl text-xs font-bold outline-none border-2 border-emerald-100"
                                 placeholder={`0.00 ${currency}`}
                                 onChange={(e) => setMontoRecibido(e.target.value)}
                               />
                               <div className="flex flex-col justify-center">
                                  <p className="text-[9px] font-black text-slate-400 uppercase leading-none">Cambio NIO:</p>
                                  <p className="text-xs font-black text-emerald-600">
                                    C$ {montoRecibido ? (
                                      currency === 'USD' 
                                        ? ((Number(montoRecibido) - calculateCartTotal()) * EXCHANGE_RATE).toFixed(2)
                                        : (Number(montoRecibido) - (calculateCartTotal() * EXCHANGE_RATE)).toFixed(2)
                                    ) : '0.00'}
                                  </p>
                               </div>
                            </div>
                         </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                   <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1 text-left">
                         <label className="text-[10px] font-black uppercase tracking-widest text-[#4d8b81]">Agregar Servicio</label>
                         <select className="bg-slate-50 dark:bg-slate-800 p-3 rounded-xl w-full text-[10px] font-bold outline-none" onChange={(e) => {
                           const s = services.find((x: any) => x.id === parseInt(e.target.value));
                           if (s) addToCart(s, 'service');
                         }}>
                           <option value="">Servicios...</option>
                           {services?.map((s: any) => <option key={s.id} value={s.id}>{s.name} (${s.price})</option>)}
                         </select>
                      </div>
                      <div className="space-y-1 text-left">
                         <div className="flex justify-between items-center">
                            <label className="text-[10px] font-black uppercase tracking-widest text-[#4d8b81]">Agregar Producto</label>
                            <button 
                              type="button"
                              onClick={() => {
                                const name = prompt('Nombre del nuevo producto:');
                                if (!name) return;
                                const brand = prompt('Marca:');
                                const price = parseFloat(prompt('Precio:') || '0');
                                const stock = parseInt(prompt('Stock Inicial:') || '0');
                                
                                // Registrar en DB y luego agregar al carrito
                                fetch(`${API_URL}/products`, {
                                  method: 'POST',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({ name, brand, price, stock, category: 'General' })
                                }).then(r => r.json()).then(() => {
                                   alert('Producto registrado. Búscalo en la lista para agregarlo.');
                                   onSuccess(); // Para refrescar la lista global
                                });
                              }}
                              className="text-[8px] font-black uppercase text-[#4d8b81] hover:underline"
                            >
                              + Nuevo
                            </button>
                         </div>
                         <select className="bg-slate-50 dark:bg-slate-800 p-3 rounded-xl w-full text-[10px] font-bold outline-none" onChange={(e) => {
                           const p = products.find((x: any) => x.id === parseInt(e.target.value));
                           if (p) addToCart(p, 'product');
                         }}>
                           <option value="">Productos...</option>
                           {products?.map((p: any) => <option key={p.id} value={p.id}>{p.name} (${p.price})</option>)}
                         </select>
                      </div>
                   </div>
                </div>

                <div className="bg-slate-50 dark:bg-slate-800/40 p-6 rounded-[30px] border-2 border-dashed border-slate-200 dark:border-slate-800">
                  <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-[#4d8b81] mb-4 flex items-center gap-2"><ShoppingCart size={14} /> Resumen de Cobro</h4>
                  <div className="space-y-3 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                    {cart.map((item, idx) => (
                      <div key={`${item.type}-${item.id}-${idx}`} className="flex justify-between items-center text-xs gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="font-black truncate max-w-[150px]">{item.name}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <button type="button" onClick={() => updateCartQuantity(item.id, item.type, item.quantity - 1)} className="px-2 py-1 rounded-full bg-slate-100 dark:bg-slate-700 text-[10px] font-black">-</button>
                            <span className="text-[11px] font-black">{item.quantity}</span>
                            <button type="button" onClick={() => updateCartQuantity(item.id, item.type, item.quantity + 1)} className="px-2 py-1 rounded-full bg-slate-100 dark:bg-slate-700 text-[10px] font-black">+</button>
                            <span className="text-[9px] text-slate-400">${item.price}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                           <span className="font-black">${(item.price * item.quantity).toFixed(2)}</span>
                           <button type="button" onClick={() => setCart(cart.filter((_, i) => i !== idx))} className="text-red-500"><Trash2 size={12} /></button>
                        </div>
                      </div>
                    ))}
                    {cart.length === 0 && <p className="text-center text-slate-400 text-[10px] py-10 font-bold">Carrito vacío</p>}
                  </div>
                  <div className="mt-8 pt-4 border-t border-slate-200 dark:border-slate-800 space-y-2">
                     <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest text-slate-400">
                       <span>Subtotal:</span>
                       <span>${calculateCartSubtotal().toFixed(2)}</span>
                     </div>
                     {selectedPromo && (
                       <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest text-[#4d8b81]">
                         <span>{selectedPromo.title}</span>
                         <span>-${calculateCartDiscount().toFixed(2)}</span>
                       </div>
                     )}
                     <div className="flex justify-between items-center">
                       <span className="text-[10px] font-black uppercase tracking-widest">Total:</span>
                       <span className="text-2xl font-black text-[#4d8b81]">${calculateCartTotal().toFixed(2)}</span>
                     </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {type === 'promotion' && (
            <>
                <FormField label="Título" field="title" value={formData.title} onChange={(e: any) => updateField('title', e.target.value)} />
                <FormField label="Descripción" field="description" value={formData.description} onChange={(e: any) => updateField('description', e.target.value)} />
                <FormField label="Descuento (%)" field="discount_percent" type="number" value={formData.discount_percent} onChange={(e: any) => updateField('discount_percent', (e.target.value))} />
                <div className="grid grid-cols-2 gap-4">
                  <FormField label="Fecha Inicio" field="start_date" type="date" value={formData.start_date} onChange={(e: any) => updateField('start_date', e.target.value)} />
                  <FormField label="Fecha Fin" field="end_date" type="date" value={formData.end_date} onChange={(e: any) => updateField('end_date', e.target.value)} />
                </div>
            </>
          )}
          {(type === 'product' || type === 'service' || type === 'employee') && (
               <>
                 <FormField label="Nombre" field="name" value={formData.name} onChange={(e: any) => updateField('name', e.target.value)} />
                 {type === 'employee' && (
                    <>
                      <FormField label="Especialidad" field="specialty" value={formData.specialty} onChange={(e: any) => updateField('specialty', e.target.value)} />
                      <FormField label="Teléfono" field="phone" value={formData.phone} onChange={(e: any) => updateField('phone', e.target.value)} />
                    </>
                 )}
                 {type === 'product' && (
                    <>
                      <FormField label="Marca" field="brand" value={formData.brand} onChange={(e: any) => updateField('brand', e.target.value)} />
                      <FormField label="Categoría" field="category" value={formData.category} onChange={(e: any) => updateField('category', e.target.value)} />
                    </>
                 )}
                 <FormField label="Precio / Valor" field="price" type="number" value={formData.price} onChange={(e: any) => updateField('price', (e.target.value))} />
                 {type === 'product' && <FormField label="Stock" field="stock" type="number" value={formData.stock} onChange={(e: any) => updateField('stock', e.target.value)} />}
               </>
          )}
        </div>

        <button type="submit" className="w-full bg-[#4d8b81] text-white font-black py-4 rounded-2xl text-md flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-95 transition-all shadow-xl shadow-[#4d8b81]/20">
           {initialData ? 'Actualizar Registro' : 'Completar Acción'}
        </button>
      </form>
    </div>
  );
}

const CheckoutAppointmentForm = ({ appointment, onSuccess, clients, employees, services, products, appointments }: any) => {
  const [method, setMethod] = useState('Efectivo');
  const [currency, setCurrency] = useState('USD');
  const [detail, setDetail] = useState('');
  const [montoRecibido, setMontoRecibido] = useState<number | string>('');
  const billableAppointments = (appointments || [])
    .filter((appt: any) => {
      return String(appt.client_id) === String(appointment.client_id) && appt.status === 'Programada';
    })
    .sort((a: any, b: any) => new Date(a.start_time || `${a.date}T${a.time}`).getTime() - new Date(b.start_time || `${b.date}T${b.time}`).getTime());
  const appointmentsToCharge = billableAppointments.length ? billableAppointments : [appointment];
  const [items, setItems] = useState<any[]>(appointmentsToCharge.map((appt: any) => {
    const service = services?.find((s: any) => s.id === appt.service_id);
    return {
      id: appt.service_id,
      type: 'service',
      price: appt.price || service?.price || 0,
      name: appt.service_name || service?.name || 'Servicio',
      quantity: 1,
      appointment_id: appt.id,
      employee_id: appt.employee_id,
      employee_name: appt.employee_name
    };
  }));
  const [promotions, setPromotions] = useState<any[]>([]);
  const appointmentDateTime = new Date(appointment.start_time || `${appointment.date}T${appointment.time}`);
  const canCheckout = new Date() >= appointmentDateTime;
  const [selectedPromo, setSelectedPromo] = useState<any>(null);
  const [error, setError] = useState('');
  const validPromotions = filterActivePromotions(promotions);

  useEffect(() => {
    fetch(`${API_URL}/promotions`).then(r => r.json()).then(setPromotions).catch(console.error);
  }, []);

  const addToCart = (item: any, type: 'product' | 'service') => {
    const existing = items.find(i => i.id === item.id && i.type === type);
    if (existing) {
      setItems(items.map(i => i.id === item.id && i.type === type ? { ...i, quantity: i.quantity + 1 } : i));
    } else {
      setItems([...items, { ...item, type, quantity: 1, price: item.price }]);
    }
  };

  const updateItemQuantity = (itemId: any, itemType: any, quantity: number) => {
    if (quantity <= 0) {
      setItems(items.filter(i => !(i.id === itemId && i.type === itemType)));
      return;
    }
    setItems(items.map(i => i.id === itemId && i.type === itemType ? { ...i, quantity } : i));
  };

  const calculateSubtotal = () => items.reduce((acc, curr) => acc + (curr.price * curr.quantity), 0);
  
  const calculateTotal = () => {
    const subtotal = calculateSubtotal();
    if (selectedPromo) {
      const discount = (subtotal * selectedPromo.discount_percent) / 100;
      return subtotal - discount;
    }
    return subtotal;
  };

  const checkStockAvailability = () => {
    for (const item of items) {
      if (item.type === 'product') {
        const prod = products.find((p: any) => p.id === item.id);
        if (prod && prod.stock < item.quantity) {
          return { available: false, name: prod.name, stock: prod.stock };
        }
      }
    }
    return { available: true };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const stockStatus = checkStockAvailability();
    if (!stockStatus.available) {
      setError(`Stock insuficiente para ${stockStatus.name} (Disponible: ${stockStatus.stock})`);
      return;
    }

    try {
      const total = calculateTotal();
      let paymentDetail = detail;
      
      if (selectedPromo) {
        paymentDetail += (paymentDetail ? ' | ' : '') + `Promo: ${selectedPromo.title} (${selectedPromo.discount_percent}%)`;
      }

      if (method === 'Efectivo' && montoRecibido) {
        const recibido = Number(montoRecibido);
        const totalEnMoneda = currency === 'NIO' ? total * EXCHANGE_RATE : total;
        const cambio = currency === 'NIO' ? (recibido - totalEnMoneda) : ((recibido - total) * EXCHANGE_RATE);
        paymentDetail = (paymentDetail ? paymentDetail + ' | ' : '') + `Recibido: ${currency} ${recibido} | Cambio: C$ ${cambio.toFixed(2)}`;
      }

      if (!canCheckout) {
        setError('El pago de la cita sólo está permitido después de la fecha y hora programada.');
        return;
      }

      if (!method) {
        setError('Selecciona un método de pago.');
        return;
      }
      if ((method === 'Transferencia' || method === 'Tarjeta') && !detail) {
        setError('Selecciona un detalle de pago válido.');
        return;
      }

      const resp = await fetch(`${API_URL}/appointments/${appointment.id}/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          payment_method: method,
          payment_detail: paymentDetail,
          items,
          subtotal: calculateSubtotal(),
          discount_amount: selectedPromo ? (calculateSubtotal() * selectedPromo.discount_percent) / 100 : 0,
          promotion_title: selectedPromo?.title || null,
          promotion_discount: selectedPromo?.discount_percent || 0,
          total,
          created_by_id: JSON.parse(localStorage.getItem('currentUser') || '{}').id || 1
        })
      });
      if (resp.ok) onSuccess();
      else {
         const errData = await resp.json();
         setError(errData.error || 'Error al procesar el pago');
      }
    } catch (e) { setError('Error de red'); }
  };

  const totalUSD = calculateTotal();
  const totalNIO = totalUSD * EXCHANGE_RATE;
  
  const totalTarget = currency === 'NIO' ? totalNIO : totalUSD;
  const cambio = montoRecibido ? (Number(montoRecibido) - totalTarget) : 0;
  const cambioFinal = currency === 'USD' ? cambio * EXCHANGE_RATE : cambio;

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <AnimatePresence>
        {error && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="p-4 bg-red-50 text-red-600 rounded-2xl text-[10px] font-black uppercase text-center border-2 border-red-100">
            {error}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-[#1a3a35] dark:text-white">
        <div className="space-y-6">
           <div className="p-6 bg-slate-50 dark:bg-slate-800 rounded-3xl border-2 border-white dark:border-slate-800">
              <p className="text-[10px] font-black uppercase text-slate-500 dark:text-slate-400 mb-2">Cita de:</p>
              <h4 className="text-2xl font-black mb-1 text-[#1a3a35] dark:text-white">{appointment.client_name}</h4>
              <p className="text-xs font-bold text-[#4d8b81]">{appointment.service_name} • {appointment.employee_name}</p>
           </div>

           <div className="p-6 bg-[#4d8b81]/5 rounded-3xl border-2 border-[#4d8b81]/10 space-y-3">
              <label className="text-[10px] font-black uppercase tracking-widest text-[#4d8b81] flex items-center gap-1">
                <Tag size={12} /> Aplicar Descuento / Promo
              </label>
              <select className="select-primary w-full text-[#1a3a35] dark:text-white" value={selectedPromo?.id || ''} onChange={e => {
                 const p = validPromotions.find(x => x.id === parseInt(e.target.value));
                 setSelectedPromo(p || null);
              }}>
                 <option value="">Sin Promoción</option>
                 {validPromotions.map(p => (
                   <option key={p.id} value={p.id}>{p.title} ({p.discount_percent}%)</option>
                 ))}
              </select>
           </div>

           <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-[#4d8b81]">Método de Pago</label>
              <div className="grid grid-cols-3 gap-3">
                 {['Efectivo', 'Transferencia', 'Tarjeta'].map(m => (
                   <button 
                     key={m} type="button" onClick={() => { setMethod(m); setDetail(''); setError(''); }}
                     className={`p-4 rounded-2xl border-2 transition-all font-black text-xs ${method === m ? 'border-[#4d8b81] bg-[#4d8b81]/5 text-[#4d8b81]' : 'border-slate-100 dark:border-slate-800 text-slate-400'}`}
                   >
                     {m}
                   </button>
                 ))}
              </div>
           </div>

           <AnimatePresence mode="wait">
              {method === 'Transferencia' && (
                <motion.div key="trans" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="space-y-3">
                   <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase text-[#4d8b81] ml-1">Cuenta de Destino</label>
                      <select required className="select-primary w-full" value={detail} onChange={e => setDetail(e.target.value)}>
                        <option value="">Seleccionar Cuenta...</option>
                        <option value="BAC Dólares (363214589)">BAC Dólares (***589)</option>
                        <option value="BAC Córdobas (351478236)">BAC Córdobas (***236)</option>
                      </select>
                   </div>
                   <div className="p-5 bg-[#f7eed5] dark:bg-[#2f291d]/70 rounded-3xl border border-[#d4b67c] font-bold">
                      <p className="text-[10px] font-black uppercase text-[#8b6d34] mb-4 flex items-center gap-2 tracking-widest"><CreditCard size={14} /> Información BAC</p>
                      <div className="space-y-3 text-xs text-[#2f2415] dark:text-[#f5e4aa]">
                         <div className="flex justify-between items-center">
                            <span className="opacity-50">Dólares:</span>
                            <span className="text-[#8b6d34] dark:text-[#f0d78f]">363214589</span>
                         </div>
                         <div className="flex justify-between items-center text-xs font-bold">
                            <span className="opacity-50">Córdobas:</span>
                            <span className="text-[#8b6d34] dark:text-[#f0d78f]">351478236</span>
                         </div>
                      </div>
                   </div>
                </motion.div>
              )}
              {method === 'Tarjeta' && (
                <motion.div key="card" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="space-y-4">
                   <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase text-[#4d8b81] ml-1">Terminal de Pago (Banco)</label>
                      <select required className="select-primary w-full" value={detail} onChange={e => setDetail(e.target.value)}>
                        <option value="">Seleccionar Banco de la Terminal...</option>
                        <option value="BAC Credomatic (Amex/Visa/MC)">BAC Credomatic</option>
                        <option value="LAFISE (Visa/MC)">LAFISE</option>
                        <option value="BANPRO (Visa/MC)">BANPRO</option>
                        <option value="FICHOSA (Visa/MC)">FICHOSA</option>
                        <option value="AVANZA">AVANZA</option>
                      </select>
                   </div>
                   <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl border-2 border-slate-100 dark:border-slate-800">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 text-center italic">Confirma que el total coincida con el voucher</p>
                   </div>
                </motion.div>
              )}
              {method === 'Efectivo' && (
                <motion.div key="cash" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="p-6 bg-emerald-50 dark:bg-emerald-900/20 rounded-[30px] border-2 border-emerald-100 space-y-4">
                   <div className="flex justify-between items-center mb-2">
                       <div className="flex gap-2">
                          <button type="button" onClick={() => setCurrency('USD')} className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase ${currency === 'USD' ? 'bg-emerald-600 text-white' : 'bg-white text-emerald-600'}`}>USD</button>
                          <button type="button" onClick={() => setCurrency('NIO')} className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase ${currency === 'NIO' ? 'bg-emerald-600 text-white' : 'bg-white text-emerald-600'}`}>NIO</button>
                       </div>
                       <span className="text-xs font-black text-emerald-700">Total a Cobrar: {currency === 'NIO' ? `C$ ${totalNIO.toFixed(2)}` : `$ ${totalUSD.toFixed(2)}`}</span>
                   </div>
                   <div className="space-y-2">
                       <label className="text-[10px] font-black uppercase text-emerald-600">Monto Entregado ({currency}):</label>
                       <input 
                         type="number" 
                         step="0.01"
                         value={montoRecibido}
                         onChange={e => setMontoRecibido(e.target.value)}
                         placeholder={`0.00 ${currency}`}
                         className="w-full bg-white dark:bg-slate-800 p-4 rounded-2xl text-lg font-black outline-none border-2 border-emerald-100"
                       />
                   </div>
                   {montoRecibido && (
                     <div className="pt-2 border-t border-emerald-100">
                        <p className="text-[10px] font-black uppercase text-slate-400">Su Cambio (en Córdobas):</p>
                        <p className="text-2xl font-black text-emerald-600">C$ {cambioFinal.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
                     </div>
                   )}
                </motion.div>
              )}
           </AnimatePresence>

           <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                 <div className="flex justify-between items-center">
                    <label className="text-[10px] font-black uppercase tracking-widest text-[#4d8b81]">Agregar Producto</label>
                    <button 
                      type="button"
                      onClick={() => {
                        const name = prompt('Nombre del nuevo producto:');
                        if (!name) return;
                        const brand = prompt('Marca:');
                        const price = parseFloat(prompt('Precio:') || '0');
                        const stock = parseInt(prompt('Stock Inicial:') || '0');
                        
                        fetch(`${API_URL}/products`, {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ name, brand, price, stock, category: 'General' })
                        }).then(r => r.json()).then(() => {
                           alert('Producto disponible. Búscalo en la lista.');
                           onSuccess();
                        });
                      }}
                      className="text-[8px] font-black uppercase text-[#4d8b81] hover:underline"
                    >
                      + Nuevo
                    </button>
                 </div>
                 <select className="bg-slate-50 dark:bg-slate-800 p-4 rounded-2xl w-full text-xs font-bold outline-none" onChange={e => {
                    const p = products.find((x: any) => x.id === parseInt(e.target.value));
                    if (p) addToCart(p, 'product');
                 }}>
                    <option value="">Añadir...</option>
                    {products?.map((p: any) => <option key={p.id} value={p.id}>{p.name} (${p.price})</option>)}
                 </select>
              </div>
              <div className="space-y-1">
                 <label className="text-[10px] font-black uppercase tracking-widest text-[#4d8b81]">Mas Servicios</label>
                 <select className="bg-slate-50 dark:bg-slate-800 p-4 rounded-2xl w-full text-xs font-bold outline-none" onChange={e => {
                    const s = services.find((x: any) => x.id === parseInt(e.target.value));
                    if (s) addToCart(s, 'service');
                 }}>
                    <option value="">Añadir...</option>
                    {services?.map((s: any) => <option key={s.id} value={s.id}>{s.name} (${s.price})</option>)}
                 </select>
              </div>
           </div>
        </div>

        <div className="bg-slate-50 dark:bg-slate-800/40 p-8 rounded-[40px] border-2 border-dashed border-slate-200 dark:border-slate-800 flex flex-col">
           <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-[#4d8b81] mb-6">Resumen de Cuenta</h4>
           <div className="space-y-4 flex-1">
              {items.map((item, idx) => (
                <div key={idx} className="flex justify-between items-center font-bold text-sm gap-4">
                   <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                         <span className="text-[10px] opacity-40">#{idx+1}</span>
                         <span className="truncate">{item.name}</span>
                      </div>
                      <div className="flex items-center gap-2 text-[10px] text-slate-500 mt-1">
                         <button type="button" onClick={() => updateItemQuantity(item.id, item.type, item.quantity - 1)} className="px-2 py-1 rounded-full bg-slate-100 dark:bg-slate-700 font-black">-</button>
                         <span>{item.quantity}</span>
                         <button type="button" onClick={() => updateItemQuantity(item.id, item.type, item.quantity + 1)} className="px-2 py-1 rounded-full bg-slate-100 dark:bg-slate-700 font-black">+</button>
                         <span>${item.price}</span>
                      </div>
                   </div>
                   <span>${(item.price * item.quantity).toFixed(2)}</span>
                </div>
              ))}
           </div>
           <div className="mt-10 pt-6 border-t-2 border-[#1a3a35]/10 dark:border-slate-800 space-y-2">
              <div className="flex justify-between items-center text-[#1a3a35] dark:text-white opacity-50 text-[10px] font-black uppercase tracking-widest">
                 <span>Subtotal:</span>
                 <span>${calculateSubtotal().toFixed(2)}</span>
              </div>
              {selectedPromo && (
                <div className="flex justify-between items-center text-[#4d8b81] font-bold text-xs bg-[#4d8b81]/10 px-3 py-1 rounded-lg">
                   <span>-{selectedPromo.discount_percent}% {selectedPromo.title}</span>
                   <span>-${((calculateSubtotal() * selectedPromo.discount_percent) / 100).toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between items-center pt-2">
                 <span className="text-[10px] font-black uppercase tracking-tighter text-[#1a3a35] dark:text-white">Total Final:</span>
                 <span className="text-4xl font-black text-[#4d8b81]">${calculateTotal().toFixed(2)}</span>
              </div>
              <p className="text-[8px] font-bold text-slate-400 text-center uppercase tracking-widest">Equivalente: C$ {totalNIO.toFixed(2)} NIO</p>
           </div>
        </div>
      </div>

      <button type="submit" disabled={!canCheckout} className="w-full bg-[#4d8b81] text-white font-black py-6 rounded-3xl text-xl hover:scale-[1.01] transition-all shadow-2xl shadow-[#4d8b81]/30 mt-6 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed">
         Confirmar Pago Final
      </button>
      {!canCheckout && (
        <p className="text-[10px] text-slate-500 text-center">El pago sólo puede procesarse después de la hora de la cita programada.</p>
      )}
    </form>
  );
}

