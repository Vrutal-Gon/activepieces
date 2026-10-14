-- =====================================================================
-- Proyecto Supabase: Vrutal 1st — panel de control de staff/clientes (apmhvqlvwjcrwfaixgju).
-- NO lo ejecutes en el proyecto VrutalOS de un cliente: esas tablas no existen ahi.
-- VRUTAL 1st · Migración 027 · Catálogo de Sistemas: falta Anthropic
--
-- El founder señaló que VrutalOS → Integraciones deja pegar una clave de Anthropic
-- (`app/src/lib/providers.ts`, categoría `llm`) pero Stack/Sistemas no tenía ninguna fila
-- `llm` — dos catálogos que deberían estar sincronizados y no lo estaban, no por diseño
-- (migración 026 ya corrigió que una categoría pueda tener varios sistemas a la vez, pero
-- no añadía ninguno). Esto se repetirá con DeepSeek/Qwen/OpenAI en cuanto se añadan a
-- `providers.ts`: cada proveedor de clave que entra ahí debe tener su fila aquí.
-- =====================================================================

insert into catalog.system_option (system_category, name, version, connection_notes, docs_url)
select 'llm', 'Anthropic', null,
       'Clave de API, la pega el Admin del cliente en VrutalOS → Integraciones (vive en su Vault, nunca en Vrutal1st).',
       'https://docs.anthropic.com/'
where not exists (
  select 1 from catalog.system_option where system_category = 'llm' and name = 'Anthropic'
);
