-- Eski himoyasiz funksiyalar tashqaridan yopildi (o'chirish o'rniga).
revoke execute on function public.liga_push(uuid,int,int,text,int,int,text,text) from public, anon, authenticated;
revoke execute on function public.liga_push2(uuid,int,int,text,int,int,text,text,int,int,int) from public, anon, authenticated;
revoke execute on function public.liga_push3(uuid,int,int,text,int,int,text,text,int,int,int,jsonb) from public, anon, authenticated;
revoke execute on function public.liga_push4(uuid,int,int,text,int,int,text,text,int,int,int,jsonb,int) from public, anon, authenticated;
revoke execute on function public.liga_join(text,text,text,text) from public, anon, authenticated;
revoke execute on function public.liga_admin_list(text) from public, anon, authenticated;
revoke execute on function public.liga_pay_config() from public, anon, authenticated;
