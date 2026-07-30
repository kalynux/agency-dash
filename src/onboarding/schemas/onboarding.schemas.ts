import { z } from 'zod';
import type { GeoAddress } from '@/types/geo.types';

// ─── Phone regex (matches backend) ───────────────────────────────────────────

const phoneRegex = /^\+?[0-9\s\-()]+$/;

// ─── Step 1: Logistics Setup ──────────────────────────────────────────────────

const supportContactSchema = z.object({
    phone: z
        .string()
        .min(6, 'Phone number is too short (min 6 chars)')
        .max(20, 'Phone number is too long (max 20 chars)')
        .regex(phoneRegex, 'Invalid phone format (use digits, +, spaces, hyphens or parentheses)'),
    email: z
        .string()
        .email('Must be a valid email address')
        .or(z.literal(''))
        .nullable()
        .optional(),
});

/**
 * A geocoded address the user SELECTED from `GET /api/geo/search`.
 * See api-doc/geo/README.md — the backend stores this verbatim and derives the
 * bare `location` point from `coordinates`.
 *
 * Validated as an opaque `GeoAddress` rather than re-declared field-by-field:
 * the object is never hand-built, it comes straight off our own geo service, so
 * the only thing worth asserting in the form is that one was actually picked.
 * This also keeps the inferred form type identical to the app-wide `GeoAddress`.
 */
const geoAddressSchema = z.custom<GeoAddress>(
    (v) => !!v && typeof v === 'object' && 'formatted_address' in v && 'coordinates' in v,
    { message: 'Search for and select this location’s address' },
);

export const headquartersAddressSchema = z.object({
    /** Human name for this location — the agency counterpart of a vendor address label. */
    label: z
        .string()
        .min(1, 'Label is required')
        .max(50, 'Label must be 50 characters or fewer'),
    /**
     * DERIVED, not collected: the backend reads region/city off `geo.components`
     * and stores `null` when the geocode names neither. They stay in the form
     * only so the agency can optionally name a rural / landmark place the
     * provider left blank — never sent when `geo` carries a value.
     */
    region: z.string().max(100, 'Region too long (max 100 chars)').optional(),
    city: z.string().max(100, 'City too long (max 100 chars)').optional(),
    address_description: z
        .string()
        .min(1, 'Address description is required')
        .max(200, 'Address description too long (max 200 chars)'),
    support_contact: supportContactSchema,
    /**
     * The canonical geospatial address. REQUIRED on every new or edited entry —
     * hand-typed coordinates are rejected with `400 ADDRESS_GEO_REQUIRED`, and an
     * address outside the agency's country with `400 ADDRESS_COUNTRY_MISMATCH`.
     * `location` is derived from `geo.coordinates` on submit.
     */
    geo: geoAddressSchema,
});

export const logisticsSchema = z.object({
    /**
     * Region keys of the agency's country from locations.json (e.g. "littoral").
     * At least 1 region must be selected.
     */
    coverage_areas: z
        .array(z.string().min(1))
        .min(1, 'Select at least one coverage region'),
    headquarters_addresses: z
        .array(headquartersAddressSchema)
        .min(1, 'At least one headquarters address is required'),
    version: z.number().int().optional(),
});

export type LogisticsFormValues = z.infer<typeof logisticsSchema>;
export type HeadquartersAddressFormValues = z.infer<typeof headquartersAddressSchema>;

// ─── Step 2: Payout Setup ─────────────────────────────────────────────────────

const mobileMoneySchema = z.object({
    provider: z.string().min(1, 'Provider is required').trim(),
    phone_number: z
        .string()
        .min(6, 'Phone number too short')
        .max(20, 'Phone number too long')
        .regex(phoneRegex, 'Invalid phone format')
        .trim(),
    account_name: z.string().min(1, 'Account name is required').trim(),
});

const bankSchema = z.object({
    bank_name: z.string().min(1, 'Bank name is required').trim(),
    account_number: z.string().min(1, 'Account number is required').trim(),
    account_name: z.string().min(1, 'Account name is required').trim(),
    /** Full country name, e.g. "Cameroon" */
    country: z.string().min(1, 'Country is required').trim(),
});

/**
 * A single payout method entry (discriminated union by `method`).
 * The `payout_details` array is an ordered list of these.
 */
export const payoutMethodSchema = z.discriminatedUnion('method', [
    z.object({
        method: z.literal('mobile_money'),
        mobile_money: mobileMoneySchema,
        bank: z.null().optional(),
    }),
    z.object({
        method: z.literal('bank'),
        bank: bankSchema,
        mobile_money: z.null().optional(),
    }),
]);

export type PayoutMethodFormValue = z.infer<typeof payoutMethodSchema>;
export type PayoutMethodType = 'mobile_money' | 'bank';

/**
 * Full payout payload schema — ordered array, min 1, max 2 entries, no duplicate
 * method types (at most one mobile_money and one bank). Index 0 is preferred.
 */
export const payoutSchema = z
    .object({
        payout_details: z
            .array(payoutMethodSchema)
            .min(1, 'At least one payout method is required')
            .max(2, 'You may add at most 2 payout methods (one mobile money and one bank)')
            .superRefine((methods, ctx) => {
                const seen = new Set<string>();
                for (const m of methods) {
                    if (seen.has(m.method)) {
                        ctx.addIssue({
                            code: z.ZodIssueCode.custom,
                            message: 'You can only add one method of each type (mobile money / bank).',
                        });
                        break;
                    }
                    seen.add(m.method);
                }
            }),
        version: z.number().int().optional(),
    });

export type PayoutFormValues = z.infer<typeof payoutSchema>;

// ─── Step 3: Branding Setup (Optional / Skippable) ───────────────────────────

// The logo is picked from the media library, so the form carries the file `id`
// the API wants plus the resolved URL used only to render the preview.
export const brandingSchema = z.object({
    logo_file_id: z.string().nullable().optional(),
    logo_preview_url: z.string().nullable().optional(),
    timezone: z.string().optional(),
});

export type BrandingFormValues = z.infer<typeof brandingSchema>;

// ─── Step 4: Policy Setup ─────────────────────────────────────────────────────

/** Coerces an input to a non-negative number; empty/null/undefined defaults to 0 */
const requiredFee = z.preprocess(
    (v) => (v === '' || v === null || v === undefined ? 0 : Number(v)),
    z.number('Must be a number').nonnegative('Must be 0 or greater'),
);

/** Non-negative integer; empty/null/undefined defaults to 0 */
const requiredIntFee = z.preprocess(
    (v) => (v === '' || v === null || v === undefined ? 0 : Number(v)),
    z.number('Must be a number').int('Must be a whole number').nonnegative('Must be 0 or greater'),
);

/** Optional non-negative number (empty → undefined) */
const optionalFee = z.preprocess(
    (v) => (v === '' || v === null || v === undefined ? undefined : Number(v)),
    z.number().nonnegative('Must be 0 or greater').optional(),
);

const codHandlingFeeSchema = z.object({
    type: z.enum(['percentage', 'fixed'], 'COD fee type is required'),
    value: requiredFee,
});

const pricingSchema = z.object({
    storage_based: z.object({
        enabled: z.boolean(),
        monthly_storage_fee_per_sku: requiredFee,
        pick_pack_fee_per_order: requiredFee,
        local_delivery_fee: requiredFee,
        out_of_region_delivery_fee: requiredFee,
    }),
    pickup_based: z.object({
        enabled: z.boolean(),
        base_rate_first_kg: requiredFee,
        additional_per_kg: requiredFee,
        out_of_region_surcharge: requiredFee,
    }),
    additional_fees: z.object({
        cod_handling_fee: codHandlingFeeSchema,
        failed_delivery_fee: requiredFee,
        rto_fee: requiredFee,
        peak_season_surcharge: optionalFee,
    }),
    notes: z.string().max(700, 'Notes too long (max 700 chars)').optional(),
}).refine(
    (data) => data.storage_based.enabled || data.pickup_based.enabled,
    {
        message: 'At least one pricing model must be enabled',
        path: ['storage_based', 'enabled'],
    },
);

const returnsSchema = z.object({
    payer: z.enum(['vendor', 'agency', 'customer'], 'Return cost payer is required'),
    handling_fee: requiredFee,
    return_window_days: requiredIntFee,
    notes: z.string().max(700, 'Notes too long (max 700 chars)').optional(),
});

const damageSchema = z.object({
    claim_deadline_days: requiredIntFee,
    max_refund_per_item: requiredFee,
    notes: z.string().max(700, 'Notes too long (max 700 chars)').optional(),
});

/** Nullable non-negative number; empty/null/undefined normalizes to null (no cap). */
const nullableCap = z.preprocess(
    (v) => (v === '' || v === null || v === undefined ? null : Number(v)),
    z.number('Must be a number').nonnegative('Must be 0 or greater').nullable(),
);

const codSchema = z.object({
    enabled: z.boolean(),
    max_order_amount: nullableCap,
});

export const policiesSchema = z.object({
    pricing: pricingSchema,
    returns: returnsSchema,
    damage: damageSchema,
    cod: codSchema,
});

export type PoliciesFormValues = z.infer<typeof policiesSchema>;
