import {
  managementSchemas,
  managementRoute,
  managementResult,
} from "../../../packages/workspace/src/management-tools.js";
import { api } from "./api.js";
import {platformRequest,centralEnabled} from "./platform-client.js";
export const isManagementTool = (name: string) =>
  Object.hasOwn(managementSchemas, name);
export async function executeManagement(
  firmId: string,
  name: string,
  args: Record<string, unknown>,
) {
  try {
    if(["transcribe_session","session_minutes"].includes(name)){
      if(!centralEnabled())throw Error("Las sesiones requieren cuentas centrales activadas.");
      const result=await platformRequest("management",{firm:firmId,name,args,command_id:crypto.randomUUID()});window.dispatchEvent(new Event("law-order-work-changed"));return {ok:true,data:result.data};
    }
    const route = managementRoute(firmId, name, args);
    const data = await api(route.path, route.body);
    if (route.body !== undefined)
      window.dispatchEvent(new Event("law-order-work-changed"));
    return { ok: true, data: managementResult(name, args, data) };
  } catch (error) {
    return {
      ok: false,
      error: (error as { code?: string }).code ?? (error as Error).message,
    };
  }
}
