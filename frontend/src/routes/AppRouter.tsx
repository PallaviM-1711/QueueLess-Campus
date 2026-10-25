/**
 * AppRouter.tsx
 * Central routing configuration using React Router v7.
 * Placeholder pages are used for now — real implementations come in later phases.
 */

import { BrowserRouter, Routes, Route } from 'react-router-dom';

// Placeholder pages
import HomePage from '../pages/HomePage';
import LoginPage from '../pages/auth/LoginPage';
import RegisterPage from '../pages/auth/RegisterPage';
import MenuPage from '../pages/MenuPage';
import CheckoutPage from '../pages/CheckoutPage';
import OrderPage from '../pages/OrderPage';
import OrdersPage from '../pages/OrdersPage';
import NotFoundPage from '../pages/NotFoundPage';

export default function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public routes */}
        <Route path="/" element={<HomePage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/canteens/:canteenId/menu" element={<MenuPage />} />
        <Route path="/checkout/:canteenId" element={<CheckoutPage />} />
        <Route path="/orders" element={<OrdersPage />} />
        <Route path="/orders/:orderId" element={<OrderPage />} />

        {/* 404 fallback */}
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </BrowserRouter>
  );
}
