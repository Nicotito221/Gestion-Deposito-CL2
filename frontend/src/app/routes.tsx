import { createBrowserRouter } from "react-router";
import { Layout } from "./components/Layout";
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
      { path: "inicio", Component: Home },
      { path: "nuevo-pedido", Component: NewOrder },
      { path: "pedidos", Component: Orders },
      { path: "pedidos/:id", Component: OrderDetail },
      { path: "deposito", Component: WarehouseOrders },
      { path: "deposito/preparacion/:id", Component: OrderPreparation },
      { path: "remitos", Component: Remitos },
      { path: "remitos/:id", Component: DeliveryNote },
      { path: "confirmar-entrega/:id", Component: DeliveryConfirm },
      { path: "materiales", Component: Materials },
      { path: "conteo", Component: StockCount },
      { path: "rundown", Component: RundownVivo },
      { path: "suministro-bom", Component: SupplyOrderBom },
      { path: "configuracion-materiales", Component: MaterialConfig },
      { path: "usuarios", Component: UserManagement },
      { path: "stock", Component: Stock },
      { path: "trazabilidad", Component: Audit },
      { path: "conteo-ciclico", Component: CyclicCount },
    ],
  },
]);
