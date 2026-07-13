-- Lock down helper trigger function flagged by Supabase Security Advisor.
-- This function is executed by the sales_order_items trigger and should not be
-- directly callable by anon or signed-in users.

revoke all on function public.capture_sales_item_cost() from public;
revoke all on function public.capture_sales_item_cost() from anon;
revoke all on function public.capture_sales_item_cost() from authenticated;
grant execute on function public.capture_sales_item_cost() to service_role;

