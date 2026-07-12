export interface VendorFilters {
  city: string;
  state: string;
  returnEligible: boolean;
  cancellable: boolean;
}

export const INITIAL_VENDOR_FILTERS: VendorFilters = {
  city: '',
  state: '',
  returnEligible: false,
  cancellable: false,
};

export function countActiveVendorFilters(f: VendorFilters): number {
  return [f.city !== '', f.state !== '', f.returnEligible, f.cancellable].filter(Boolean).length;
}
