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
import { Remitos } from "./pages/Remitos";
import { OrderDetail } from "./pages/OrderDetail";
import { CyclicCount } from "./pages/CyclicCount";
import { SupplyOrderBom } from "./pages/SupplyOrderBom";
import { DespachosTerceros } from "./pages/DespachosTerceros";
import { MaterialConfig } from "./pages/MaterialConfig";
import { UserManagement } from "./pages/UserManagement";
import { Proveedores } from "./pages/Proveedores";
import { PERMISOS_RUTA } from "./permisos";

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
            roles={PERMISOS_RUTA["/nuevo-pedido"]}
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
          <ProtectedRoute roles={PERMISOS_RUTA["/deposito"]}>
            <WarehouseOrders />
          </ProtectedRoute>
        ),
      },
      {
        path: "deposito/preparacion/:id",
        element: (
          <ProtectedRoute roles={PERMISOS_RUTA["/deposito"]}>
            <OrderPreparation />
          </ProtectedRoute>
        ),
      },
      {
        path: "remitos",
        element: (
          <ProtectedRoute
            roles={PERMISOS_RUTA["/remitos"]}
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
        path: "materiales",
        element: (
          <ProtectedRoute
            roles={PERMISOS_RUTA["/materiales"]}
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
            roles={PERMISOS_RUTA["/conteo"]}
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
            roles={PERMISOS_RUTA["/rundown"]}
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
            roles={PERMISOS_RUTA["/suministro-bom"]}
            blockedRoles={["deposito", "operario_deposito"]}
            blockedSectors={["CL2"]}
          >
            <SupplyOrderBom />
          </ProtectedRoute>
        ),
      },
      {
        path: "despachos-terceros",
        element: (
          <ProtectedRoute
            roles={PERMISOS_RUTA["/despachos-terceros"]}
            blockedRoles={["deposito", "operario_deposito"]}
            blockedSectors={["CL2"]}
          >
            <DespachosTerceros />
          </ProtectedRoute>
        ),
      },
      {
        path: "configuracion-materiales",
        element: (
          <ProtectedRoute roles={PERMISOS_RUTA["/configuracion-materiales"]}>
            <MaterialConfig />
          </ProtectedRoute>
        ),
      },
      {
        path: "proveedores",
        element: (
          <ProtectedRoute roles={PERMISOS_RUTA["/proveedores"]}>
            <Proveedores />
          </ProtectedRoute>
        ),
      },
      {
        path: "usuarios",
        element: (
          <ProtectedRoute roles={PERMISOS_RUTA["/usuarios"]}>
            <UserManagement />
          </ProtectedRoute>
        ),
      },
      {
        path: "stock",
        element: (
          <ProtectedRoute
            roles={PERMISOS_RUTA["/stock"]}
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
          <ProtectedRoute roles={PERMISOS_RUTA["/trazabilidad"]}>
            <Audit />
          </ProtectedRoute>
        ),
      },
      {
        path: "conteo-ciclico",
        element: (
          <ProtectedRoute
            roles={PERMISOS_RUTA["/conteo-ciclico"]}
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
