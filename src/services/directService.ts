import axios from 'axios'

const BASE = import.meta.env.REACT_APP_UBER_SERVICE_URL || 'http://localhost:3004'
const API = `${BASE}/api/direct/v1`

// 配送费规则类型
export type DeliveryFeeRule = 'REALTIME' | 'FLAT_FEE' | 'MERCHANT_SUBSIDY' | 'FREE'

export interface DirectOrganization {
  id: string
  merchantId: string
  orgId: string
  parentOrgId: string
  name: string
  email: string
  phone?: string
  pickupStreet?: string
  pickupCity?: string
  pickupProvince?: string
  pickupPostalCode?: string
  pickupCountry?: string
  pickupLatitude?: number
  pickupLongitude?: number
  pickupNotes?: string
  // 配送费规则
  deliveryFeeRule: DeliveryFeeRule
  deliveryFlatFee?: number        // 固定配送费（分）
  deliveryFreeAbove?: number      // 免运费阈值（分）
  merchantSubsidyAmount?: number  // 商家承担金额（分），MERCHANT_SUBSIDY 规则使用
  minOrderAmount?: number         // 配送起送金额（分），undefined=不限
  type: string
  status: string
  createdAt: string
  updatedAt: string
}

export interface DirectDelivery {
  id: string
  status: string
  external_delivery_id?: string
  pickup: { address: string; name: string }
  dropoff: { address: string; name: string }
  fee: number
  currency: string
  tracking_url: string
  pickup_eta?: string
  dropoff_eta?: string
  courier?: { name: string; vehicle_type: string; location?: { lat: number; lng: number } }
  created: string
  updated: string
}

export interface CreateDeliveryParams {
  merchantId: string
  externalDeliveryId?: string
  pickupAddress: string
  pickupName: string
  pickupPhone: string
  pickupNotes?: string
  dropoffAddress: string
  dropoffName: string
  dropoffPhone: string
  dropoffNotes?: string
  manifestItems?: Array<{ name: string; quantity: number; size: string; price: number }>
}

const directService = {
  // ===== Organization =====

  async getOrganization(merchantId: string): Promise<DirectOrganization | null> {
    const res = await axios.get(`${API}/organizations`, { params: { merchantId } })
    const orgs = res.data?.data || []
    return orgs.length > 0 ? orgs[0] : null
  },

  async createOrganization(
    merchantId: string,
    name: string,
    email: string,
    phone?: string,
    address?: { street1: string; city: string; state: string; zipcode: string; country_iso2: string },
    latitude?: number,
    longitude?: number
  ): Promise<DirectOrganization> {
    const res = await axios.post(`${API}/organizations`, { merchantId, name, email, phone, address, latitude, longitude })
    if (!res.data?.success) throw new Error(res.data?.error || '创建失败')
    return res.data.data
  },

  // ===== Delivery =====

  async listDeliveries(merchantId?: string): Promise<DirectDelivery[]> {
    const res = await axios.get(`${API}/deliveries`, { params: merchantId ? { merchantId } : {} })
    return res.data?.data?.data || res.data?.data || []
  },

  async createDelivery(params: CreateDeliveryParams): Promise<DirectDelivery> {
    const res = await axios.post(`${API}/deliveries`, params)
    if (!res.data?.success) throw new Error(res.data?.error || '创建配送单失败')
    return res.data.data
  },

  async getDelivery(deliveryId: string): Promise<DirectDelivery> {
    const res = await axios.get(`${API}/deliveries/${deliveryId}`)
    return res.data.data
  },

  async cancelDelivery(deliveryId: string): Promise<void> {
    await axios.post(`${API}/deliveries/${deliveryId}/cancel`)
  },

  // 更新 Organization（取货地址、电话、取货指引、配送费规则等）
  async updateOrganization(
    merchantId: string,
    orgId: string,
    updates: {
      phone?: string
      pickupStreet?: string
      pickupCity?: string
      pickupProvince?: string
      pickupPostalCode?: string
      pickupCountry?: string
      pickupLatitude?: number
      pickupLongitude?: number
      pickupNotes?: string
      deliveryFeeRule?: DeliveryFeeRule
      deliveryFlatFee?: number | null
      deliveryFreeAbove?: number | null
      merchantSubsidyAmount?: number | null
      minOrderAmount?: number | null
    }
  ): Promise<DirectOrganization> {
    const res = await axios.patch(`${API}/organizations/${orgId}?merchantId=${merchantId}`, updates)
    if (!res.data?.success) throw new Error(res.data?.error || '更新失败')
    return res.data.data
  },
}

export default directService
