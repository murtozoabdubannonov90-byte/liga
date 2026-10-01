-- Yangi ilova (liga_save/liga_join2) joylangandan keyin: kalitsiz yozish funksiyalarini o'chirish
drop function if exists public.liga_push(uuid,int,int,text,int,int,text,text);
drop function if exists public.liga_push2(uuid,int,int,text,int,int,text,text,int,int,int);
drop function if exists public.liga_push3(uuid,int,int,text,int,int,text,text,int,int,int,jsonb);
drop function if exists public.liga_push4(uuid,int,int,text,int,int,text,text,int,int,int,jsonb,int);
drop function if exists public.liga_join(text,text,text,text);
drop function if exists public.safari_limit();
