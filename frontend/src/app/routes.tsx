import { createBrowserRouter } from "react-router";
import { Layout } from "./components/Layout";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { Login } from "./pages/Login";
import { Home } from "./pages/Home";
import { NewOrder } from "./pages/NewOrder";
import { WarehouseOrders } from "./pages/WarehouseOrders";
import { OrderPreparation } from "./pages/OrderPreparation";
import { DeliveryNote } from "./pages/DeliveryNote";
import { Orders } from "./pages/Orders";
import { Materials } from "./pages/Materials";
import { StockCount } from "./pages/StockCount";
import { Stock } from "./pages/Stock";
import { RundownVivo } from "./pages/RundownVivo";
import { Audit } from "./pages/Audit";
import { DeliveryConfirm } from "./pages/DeliveryConfirm";
import { Remitos } from "./pages/Remitos";
import { OrderDetail } from "./pages/OrderDetail";
import { CyclicCount } from "./pages/CyclicCount";
import { SupplyOrderBom } from "./pages/SupplyOrderBom";
import { MaterialConfig } from "./pages/MaterialConfig";
import { UserManagement } from "./pages/UserManagement";

export const router = createBrowserRouter([
  {
    path: "/",
    index: true,
    Component: Login,
  },
  {
    path: "/login",
    Component: Login,
  },
  {
    path: "/",
    Component: Layout,
    children: [
      {
        path: "inicio",
        element: (
          <ProtectedRoute>
            <Home />
          </ProtectedRoute>
        ),
      },
      {
        path: "nuevo-pedido",
        element: (
          <ProtectedRoute
            roles={["administrador", "gerente", "jefe", "analista", "contador_ciclico", "solicitante", "operario_planta"]}
            blockedRoles={["deposito", "operario_deposito"]}
            blockedSectors={["CL2"]}
          >
            <NewOrder />
          </ProtectedRoute>
        ),
      },
      {
        path: "pedidos",
        element: (
          <ProtectedRoute>
            <Orders />
          </ProtectedRoute>
        ),
      },
      {
        path: "pedidos/:id",
        element: (
          <ProtectedRoute>
            <OrderDetail />
          </ProtectedRoute>
        ),
      },
      {
        path: "deposito",
        element: (
          <ProtectedRoute roles={["administrador", "gerente", "jefe", "analista", "deposito", "operario_deposito"]}>
            <WarehouseOrders />
          </ProtectedRoute>
        ),
      },
      {
        path: "deposito/preparacion/:id",
        element: (
          <ProtectedRoute roles={["administrador", "gerente", "jefe", "analista", "deposito", "operario_deposito"]}>
            <OrderPreparation />
          </ProtectedRoute>
        ),
      },
      {
        path: "remitos",
        element: (
          <ProtectedRoute
            roles={["administrador", "gerente", "jefe", "analista"]}
            blockedRoles={["deposito", "operario_deposito"]}
            blockedSectors={["CL2"]}
          >
            <Remitos />
          </ProtectedRoute>
        ),
      },
      {
        path: "remitos/:id",
        element: (
          <ProtectedRoute>
            <DeliveryNote />
          </ProtectedRoute>
        ),
      },
      {
        path: "confirmar-entrega/:id",
        element: (
          <ProtectedRoute>
            <DeliveryConfirm />
          </ProtectedRoute>
        ),
      },
      {
        path: "materiales",
        element: (
          <ProtectedRoute
            roles={["administrador", "gerente", "jefe", "analista"]}
            blockedRoles={["deposito", "operario_deposito"]}
            blockedSectors={["CL2"]}
          >
            <Materials />
          </ProtectedRoute>
        ),
      },
      {
        path: "conteo",
        element: (
          <ProtectedRoute
            roles={["administrador", "gerente", "jefe", "analista", "contador_ciclico", "operario_planta"]}
            blockedRoles={["deposito", "operario_deposito"]}
            blockedSectors={["CL2"]}
          >
            <StockCount />
          </ProtectedRoute>
        ),
      },
      {
        path: "rundown",
        element: (
          <ProtectedRoute
            roles={["administrador", "gerente", "jefe", "analista", "operario_planta", "supervisor"]}
            blockedRoles={["deposito", "operario_deposito"]}
            blockedSectors={["CL2"]}
          >
            <RundownVivo />
          </ProtectedRoute>
        ),
      },
      {
        path: "suministro-bom",
        element: (
          <ProtectedRoute
            roles={["administrador", "gerente", "jefe", "analista", "operario_planta", "supervisor"]}
            blockedRoles={["deposito", "operario_deposito"]}
            blockedSectors={["CL2"]}
          >
            <SupplyOrderBom />
          </ProtectedRoute>
        ),
      },
      {
        path: "configuracion-materiales",
        element: (
          <ProtectedRoute roles={["administrador", "gerente", "jefe", "analista", "supervisor"]}>
            <MaterialConfig />
          </ProtectedRoute>
        ),
      },
      {
        path: "usuarios",
        element: (
          <ProtectedRoute roles={["administrador"]}>
            <UserManagement />
          </ProtectedRoute>
        ),
      },
      {
        path: "stock",
        element: (
          <ProtectedRoute
            roles={["administrador", "gerente", "jefe", "analista", "operario_planta", "supervisor"]}
            blockedRoles={["deposito", "operario_deposito"]}
            blockedSectors={["CL2"]}
          >
            <Stock />
          </ProtectedRoute>
        ),
      },
      {
        path: "trazabilidad",
        element: (
          <ProtectedRoute roles={["administrador", "gerente", "jefe", "analista", "supervisor"]}>
            <Audit />
          </ProtectedRoute>
        ),
      },
      {
        path: "conteo-ciclico",
        element: (
          <ProtectedRoute
            roles={["administrador", "gerente", "jefe", "analista", "contador_ciclico"]}
            blockedRoles={["deposito", "operario_deposito"]}
            blockedSectors={["CL2"]}
          >
            <CyclicCount />
          </ProtectedRoute>
        ),
      },
    ],
  },
]);
