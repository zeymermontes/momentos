-- Add buy_x field for "buy X get Y free" promotions.
-- discount_value stores the Y (free items), buy_x stores the X (items to buy).
alter table promotion_rules add column buy_x int;

-- Add fotolibros to the scope options.
-- (Supabase enums can't be altered easily, so scope is stored as text
-- and validated in the application layer.)
