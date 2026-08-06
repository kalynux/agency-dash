import { z } from 'zod';
import type { GeoAddress } from '@/types/geo.types';
import type { AnyTFunction } from '@/i18n/tx';
import { buildPhoneSchema, validationMessage as v } from '@/lib/validation-schemas';
import { toSubmittablePhone, type CountryCode } from '@/lib/phone';

/**
 * Onboarding + settings form schemas.
 *
 * Every schema is a factory taking i18next's `t`, because a Zod schema built at
 * module scope would bake its messages into whatever language was active at
 * import time. Consumers do
 * `const schema = useMemo(() => buildLogisticsSchema(t), [t])` so the resolver
 * re-binds when the language changes.
 *
 * The exported `*FormValues` types are inferred from the factories' return
 * types, so they stay identical to what the resolver produces.
 */

type T = AnyTFunction;

// ─── Step 1: Logistics Setup ──────────────────────────────────────────────────

function supportContactSchema(t: T) {
    return z.object({
        // E.164, produced by `PhoneInput` and checked against the numbering rules
        // of the country it names — see lib/phone.ts.
        phone: buildPhoneSchema(t),
        email: z
            .string()
            .email(v(t, 'email'))
            .or(z.literal(''))
            .nullable()
            .optional(),
    });
}

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
function geoAddressSchema(t: T) {
    return z.custom<GeoAddress>(
        (value) =>
            !!value &&
            typeof value === 'object' &&
            'formatted_address' in value &&
            'coordinates' in value,
        { message: v(t, 'address.geoRequired') },
    );
}

export function buildHeadquartersAddressSchema(t: T) {
    return z.object({
        /** Human name for this location — the agency counterpart of a vendor address label. */
        label: z
            .string()
            .min(1, v(t, 'address.labelRequired'))
            .max(50, v(t, 'address.labelTooLong')),
        /**
         * DERIVED, not collected: the backend reads region/city off `geo.components`
         * and stores `null` when the geocode names neither. They stay in the form
         * only so the agency can optionally name a rural / landmark place the
         * provider left blank — never sent when `geo` carries a value.
         */
        region: z.string().max(100, v(t, 'address.regionTooLong')).optional(),
        city: z.string().max(100, v(t, 'address.cityTooLong')).optional(),
        address_description: z
            .string()
            .min(1, v(t, 'address.descriptionRequired'))
            .max(200, v(t, 'address.descriptionTooLong')),
        support_contact: supportContactSchema(t),
        /**
         * The canonical geospatial address. REQUIRED on every new or edited entry —
         * hand-typed coordinates are rejected with `400 ADDRESS_GEO_REQUIRED`, and an
         * address outside the agency's country with `400 ADDRESS_COUNTRY_MISMATCH`.
         * `location` is derived from `geo.coordinates` on submit.
         */
        geo: geoAddressSchema(t),
    });
}

export function buildLogisticsSchema(t: T) {
    return z.object({
        /**
         * Region keys of the agency's country from locations.json (e.g. "littoral").
         * At least 1 region must be selected.
         */
        coverage_areas: z
            .array(z.string().min(1))
            .min(1, v(t, 'logistics.coverageRequired')),
        headquarters_addresses: z
            .array(buildHeadquartersAddressSchema(t))
            .min(1, v(t, 'logistics.headquartersRequired')),
        version: z.number().int().optional(),
    });
}

export type LogisticsFormValues = z.infer<ReturnType<typeof buildLogisticsSchema>>;
export type HeadquartersAddressFormValues = z.infer<
    ReturnType<typeof buildHeadquartersAddressSchema>
>;

// ─── Step 2: Payout Setup ─────────────────────────────────────────────────────

function mobileMoneySchema(t: T) {
    return z.object({
        provider: z.string().min(1, v(t, 'payout.providerRequired')).trim(),
        /** E.164 — the wallet's own number, validated for its country. */
        phone_number: buildPhoneSchema(t),
        account_name: z.string().min(1, v(t, 'payout.accountNameRequired')).trim(),
    });
}

function bankSchema(t: T) {
    return z.object({
        bank_name: z.string().min(1, v(t, 'payout.bankNameRequired')).trim(),
        account_number: z.string().min(1, v(t, 'payout.accountNumberRequired')).trim(),
        account_name: z.string().min(1, v(t, 'payout.accountNameRequired')).trim(),
        /** Full country name, e.g. "Cameroon" */
        country: z.string().min(1, v(t, 'payout.countryRequired')).trim(),
    });
}

/**
 * A single payout method entry (discriminated union by `method`).
 * The `payout_details` array is an ordered list of these.
 */
export function buildPayoutMethodSchema(t: T) {
    return z.discriminatedUnion('method', [
        z.object({
            method: z.literal('mobile_money'),
            mobile_money: mobileMoneySchema(t),
            bank: z.null().optional(),
        }),
        z.object({
            method: z.literal('bank'),
            bank: bankSchema(t),
            mobile_money: z.null().optional(),
        }),
    ]);
}

export type PayoutMethodFormValue = z.infer<ReturnType<typeof buildPayoutMethodSchema>>;
export type PayoutMethodType = 'mobile_money' | 'bank';

/**
 * Full payout payload schema — ordered array, min 1, max 2 entries, no duplicate
 * method types (at most one mobile_money and one bank). Index 0 is preferred.
 */
export function buildPayoutSchema(t: T) {
    return z.object({
        payout_details: z
            .array(buildPayoutMethodSchema(t))
            .min(1, v(t, 'payout.atLeastOne'))
            .max(2, v(t, 'payout.atMostTwo'))
            .superRefine((methods, ctx) => {
                const seen = new Set<string>();
                for (const m of methods) {
                    if (seen.has(m.method)) {
                        ctx.addIssue({
                            code: z.ZodIssueCode.custom,
                            message: v(t, 'payout.duplicateType'),
                        });
                        break;
                    }
                    seen.add(m.method);
                }
            }),
        version: z.number().int().optional(),
    });
}

export type PayoutFormValues = z.infer<ReturnType<typeof buildPayoutSchema>>;

/**
 * Payout methods, ready for the wire: every mobile-money number as E.164.
 *
 * Onboarding and Account → Payout both edit this array, and both seed it from
 * whatever is already stored — which, for an agency that signed up before phone
 * numbers were normalized, is a local-format string the user may never touch.
 * Running the array through here on submit upgrades those rows on the next save
 * instead of writing the legacy shape straight back.
 */
export function toSubmittablePayoutDetails(
    methods: PayoutFormValues['payout_details'],
    country?: CountryCode | null,
): PayoutFormValues['payout_details'] {
    return methods.map((method) =>
        method.method === 'mobile_money' && method.mobile_money
            ? {
                ...method,
                mobile_money: {
                    ...method.mobile_money,
                    phone_number: toSubmittablePhone(method.mobile_money.phone_number, country),
                },
            }
            : method,
    );
}

// ─── Step 3: Branding Setup (Optional / Skippable) ───────────────────────────

// The logo is picked from the media library, so the form carries the file `id`
// the API wants plus the resolved URL used only to render the preview. No
// user-facing messages here, so it needs no `t`.
export const brandingSchema = z.object({
    logo_file_id: z.string().nullable().optional(),
    logo_preview_url: z.string().nullable().optional(),
    timezone: z.string().optional(),
});

export type BrandingFormValues = z.infer<typeof brandingSchema>;

// ─── Step 4: Policy Setup ─────────────────────────────────────────────────────

/** Coerces an input to a non-negative number; empty/null/undefined defaults to 0 */
function requiredFee(t: T) {
    return z.preprocess(
        (value) => (value === '' || value === null || value === undefined ? 0 : Number(value)),
        z.number(v(t, 'number')).nonnegative(v(t, 'nonNegative')),
    );
}

/** Non-negative integer; empty/null/undefined defaults to 0 */
function requiredIntFee(t: T) {
    return z.preprocess(
        (value) => (value === '' || value === null || value === undefined ? 0 : Number(value)),
        z
            .number(v(t, 'number'))
            .int(v(t, 'wholeNumber'))
            .nonnegative(v(t, 'nonNegative')),
    );
}

/** Optional non-negative number (empty → undefined) */
function optionalFee(t: T) {
    return z.preprocess(
        (value) =>
            value === '' || value === null || value === undefined ? undefined : Number(value),
        z.number().nonnegative(v(t, 'nonNegative')).optional(),
    );
}

/** Nullable non-negative number; empty/null/undefined normalizes to null (no cap). */
function nullableCap(t: T) {
    return z.preprocess(
        (value) => (value === '' || value === null || value === undefined ? null : Number(value)),
        z.number(v(t, 'number')).nonnegative(v(t, 'nonNegative')).nullable(),
    );
}

export function buildPoliciesSchema(t: T) {
    const notes = z.string().max(700, v(t, 'policies.notesTooLong')).optional();

    const pricingSchema = z
        .object({
            storage_based: z.object({
                enabled: z.boolean(),
                monthly_storage_fee_per_sku: requiredFee(t),
                pick_pack_fee_per_order: requiredFee(t),
                local_delivery_fee: requiredFee(t),
                out_of_region_delivery_fee: requiredFee(t),
            }),
            pickup_based: z.object({
                enabled: z.boolean(),
                base_rate_first_kg: requiredFee(t),
                additional_per_kg: requiredFee(t),
                out_of_region_surcharge: requiredFee(t),
            }),
            additional_fees: z.object({
                cod_handling_fee: z.object({
                    type: z.enum(['percentage', 'fixed'], v(t, 'policies.codFeeTypeRequired')),
                    value: requiredFee(t),
                }),
                failed_delivery_fee: requiredFee(t),
                rto_fee: requiredFee(t),
                peak_season_surcharge: optionalFee(t),
            }),
            notes,
        })
        .refine((data) => data.storage_based.enabled || data.pickup_based.enabled, {
            message: v(t, 'policies.onePricingModel'),
            path: ['storage_based', 'enabled'],
        });

    return z.object({
        pricing: pricingSchema,
        returns: z.object({
            payer: z.enum(['vendor', 'agency', 'customer'], v(t, 'policies.returnPayerRequired')),
            handling_fee: requiredFee(t),
            return_window_days: requiredIntFee(t),
            notes,
        }),
        damage: z.object({
            claim_deadline_days: requiredIntFee(t),
            max_refund_per_item: requiredFee(t),
            notes,
        }),
        cod: z.object({
            enabled: z.boolean(),
            max_order_amount: nullableCap(t),
        }),
    });
}

export type PoliciesFormValues = z.infer<ReturnType<typeof buildPoliciesSchema>>;
