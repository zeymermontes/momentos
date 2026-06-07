-- Two features bundled because they only differ in the table they touch:
--
-- (1) Conditional customization fields per variant.
--     Lets an admin scope a customization_field to a subset of variants so
--     it only renders on the storefront when the customer picks one of
--     those variants. Empty array = visible regardless of variant.
--
-- (2) New `photobook_cta` landing section type.
--     Dedicated call-to-action block for the fotolibro flow that the
--     admin can drop into the landing page (configurable title, image,
--     starting price, features, button).

alter table customization_fields
  add column if not exists visible_variant_ids jsonb not null default '[]'::jsonb;

alter type home_section_type add value if not exists 'photobook_cta';
