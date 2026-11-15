import { Navigate, Route, Routes } from "react-router-dom";
import { AdminShell, LoginPage } from "./admin/Shell.tsx";
import { BrandPage, CategoriesPage, DashboardPage, OrdersPage, RestaurantsPage, TablesPage } from "./admin/pages.tsx";
import { ProductsPage } from "./admin/Products.tsx";
import { ARPage } from "./customer/AR.tsx";
import { CustomerShell, HomeRedirect, TableEntry } from "./customer/Shell.tsx";
import { AboutPage, DishPage, FavoritesPage, HomePage, MenuPage, OrderPage } from "./customer/pages.tsx";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomeRedirect />} />
      <Route path="/r/:slug/mesa/:token" element={<TableEntry />} />
      <Route path="/r/:slug" element={<CustomerShell />}>
        <Route index element={<HomePage />} />
        <Route path="cardapio" element={<MenuPage />} />
        <Route path="prato/:id" element={<DishPage />} />
        <Route path="ar/:id" element={<ARPage />} />
        <Route path="favoritos" element={<FavoritesPage />} />
        <Route path="pedido" element={<OrderPage />} />
        <Route path="sobre" element={<AboutPage />} />
      </Route>
      <Route path="/admin/login" element={<LoginPage />} />
      <Route path="/admin" element={<AdminShell />}>
        <Route index element={<DashboardPage />} />
        <Route path="pedidos" element={<OrdersPage />} />
        <Route path="produtos" element={<ProductsPage />} />
        <Route path="categorias" element={<CategoriesPage />} />
        <Route path="mesas" element={<TablesPage />} />
        <Route path="marca" element={<BrandPage />} />
        <Route path="restaurantes" element={<RestaurantsPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
