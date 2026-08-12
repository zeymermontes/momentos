-- Keep MercadoPago's `status_detail` alongside the status.
--
-- We already stored `payment_status` ("rejected"), which is far too coarse to
-- act on: a mistyped CVV, an empty balance and a fraud block all landed as
-- "rejected", so the checkout showed one generic error for every one of them
-- and the customer had no idea what to correct.
--
-- Stored rather than passed through the redirect URL so it survives a reload,
-- is set by the webhook too (which has no browser to redirect), and is visible
-- to admins looking at why an order never got paid.
alter table orders
  add column if not exists payment_status_detail text;

comment on column orders.payment_status_detail is
  'MercadoPago status_detail for the last payment attempt, e.g. cc_rejected_bad_filled_security_code.';
