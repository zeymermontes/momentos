-- Add 'fotolibros' to the promotion_rule_scope enum.
alter type promotion_rule_scope add value if not exists 'fotolibros';

-- Add 'buy_x_get_y' to the promotion_rule_type enum.
alter type promotion_rule_type add value if not exists 'buy_x_get_y';
