-- Allow cart items without a product (photobook items use customization jsonb instead).
alter table cart_items alter column product_id drop not null;

-- Allow order items without a product.
alter table order_items alter column product_id drop not null;
