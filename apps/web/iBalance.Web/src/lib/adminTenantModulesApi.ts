import { api } from './api';

export type TenantModuleActivationItemDto = {
  code: string;
  name: string;
  displayOrder: number;
  isEnabled: boolean;
  totalPermissionCount: number;
  activePermissionCount: number;
  canBeManaged: boolean;
};

export type TenantModuleActivationResponse = {
  tenant: {
    id: string;
    name: string;
    key: string;
    status: number;
  };
  count: number;
  items: TenantModuleActivationItemDto[];
};

export type SaveTenantModuleActivationRequest = {
  items: {
    moduleCode: string;
    isEnabled: boolean;
  }[];
};

export async function getTenantModuleActivation(tenantId: string) {
  const response = await api.get<TenantModuleActivationResponse>(
    `/api/admin/platform/tenant-modules/${encodeURIComponent(tenantId)}`
  );
  return response.data;
}

export async function saveTenantModuleActivation(
  tenantId: string,
  payload: SaveTenantModuleActivationRequest
) {
  const response = await api.put(
    `/api/admin/platform/tenant-modules/${encodeURIComponent(tenantId)}`,
    payload
  );
  return response.data;
}
