# Supabase Security Advisor Fixes

Run this SQL in Supabase SQL Editor to clear the `rls_auto_enable()` warnings:

```sql
revoke all on function public.rls_auto_enable() from public;
revoke all on function public.rls_auto_enable() from anon;
revoke all on function public.rls_auto_enable() from authenticated;
```

For `Leaked Password Protection Disabled`, open:

`Authentication -> Security -> Password protection`

Enable leaked password protection. This is an Auth dashboard setting, not a SQL migration.
