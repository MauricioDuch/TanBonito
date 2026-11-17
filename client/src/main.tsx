import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import './index.css';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Sales from './pages/Sales';
import Purchases from './pages/Purchases';
import Supplies from './pages/Supplies';
import Products from './pages/Products';
import Settings from './pages/Settings';
import Recipes from './pages/Recipes';
import Stock from './pages/Stock';
import SimpleCrud from './components/SimpleCrud';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="ventas" element={<Sales />} />
          <Route path="compras" element={<Purchases />} />
          <Route path="insumos" element={<Supplies />} />
          <Route path="productos" element={<Products />} />
          <Route path="recetas" element={<Recipes />} />
          <Route path="stock" element={<Stock />} />
          <Route
            path="aromas"
            element={
              <SimpleCrud
                key="aromas"
                title="Aromas"
                endpoint="/scents"
                fields={[
                  { name: 'name', label: 'Aroma' },
                  { name: 'seasonal', label: 'De temporada', type: 'checkbox' },
                  { name: 'active', label: 'Activo (aparece en ventas)', type: 'checkbox', default: 1 }
                ]}
              />
            }
          />
          <Route
            path="proveedores"
            element={
              <SimpleCrud
                key="proveedores"
                title="Proveedores"
                endpoint="/suppliers"
                fields={[
                  { name: 'name', label: 'Nombre' },
                  { name: 'contact', label: 'Contacto' },
                  { name: 'notes', label: 'Notas' }
                ]}
              />
            }
          />
          <Route path="configuracion" element={<Settings />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
);
