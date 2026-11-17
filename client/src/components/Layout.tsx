import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { api } from '../api';

const LINKS = [
  { to: '/', label: 'Estadísticas' },
  { to: '/ventas', label: 'Ventas' },
  { to: '/stock', label: 'Stock' },
  { to: '/productos', label: 'Productos' },
  { to: '/recetas', label: 'Recetas' },
  { to: '/insumos', label: 'Insumos' },
  { to: '/compras', label: 'Compras' },
  { to: '/aromas', label: 'Aromas' },
  { to: '/proveedores', label: 'Proveedores' },
  { to: '/configuracion', label: 'Gastos fijos y precios' }
];

export default function Layout() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [ready, setReady] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    api.get('/auth/me').then(() => setReady(true)).catch(() => navigate('/login', { replace: true }));
  }, [navigate]);

  // Al elegir una pestaña, el menú se cierra (también al tocar la que ya está abierta: ver onClick del nav)
  useEffect(() => { setMenuOpen(false); }, [pathname]);

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setMenuOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [menuOpen]);

  const logout = async () => {
    await api.post('/auth/logout', {});
    navigate('/login', { replace: true });
  };

  if (!ready) return null;

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="logo"><img src="/logo.png" alt="Tan Bonito" /></div>
        <button
          type="button"
          className="burger"
          aria-label={menuOpen ? 'Cerrar menú' : 'Abrir menú'}
          aria-expanded={menuOpen}
          aria-controls="main-menu"
          onClick={() => setMenuOpen(!menuOpen)}
        >
          <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            {menuOpen
              ? <path d="M6 6l12 12M18 6L6 18" />
              : <path d="M4 7h16M4 12h16M4 17h16" />}
          </svg>
        </button>
        <nav id="main-menu" className={menuOpen ? 'open' : ''} onClick={(e) => { if ((e.target as HTMLElement).closest('a')) setMenuOpen(false); }}>
          {LINKS.map((l) => (
            <NavLink key={l.to} to={l.to} end={l.to === '/'}>
              {l.label}
            </NavLink>
          ))}
          <button className="link" onClick={logout}>Salir</button>
        </nav>
      </aside>
      {menuOpen && <div className="menu-backdrop" onClick={() => setMenuOpen(false)} />}
      <main className="content">
        <Outlet />
      </main>
    </div>
  );
}
